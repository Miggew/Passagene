"""
EmbryoScore v2 — DINOv2 + MLP Cloud Run Service

Endpoints:
  POST /analyze-embryo  — Process crops → embedding + MLP classification + kinetics
  GET  /health          — Health check

Pipeline per embryo:
  1. Decode JPEG crops (base64)
  2. Align crops to first (template matching)
  3. Select sharpest crop (Laplacian variance)
  4. Compute motion map (pixel diff + noise subtraction)
  5. Compose image (morphology + motion side by side)
  6. DINOv2 embedding (768d)
  7. MLP classification (optional, if weights available)

Deploy: gcloud run deploy with GPU L4
"""

import io
import os
import base64
import json
import logging
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("embryoscore-dinov2")

app = FastAPI(title="EmbryoScore DINOv2", version="2.0")

# ─── Model loading (once at startup) ───

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")

# DINOv2 ViT-B/14 (~85MB, 768d embeddings)
logger.info("Loading DINOv2 model...")
model = torch.hub.load("facebookresearch/dinov2", "dinov2_vitb14")
model.eval().to(device)
logger.info("DINOv2 loaded successfully")

# Image transform (ImageNet normalization)
img_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

# ─── MLP Classifier (optional) ───

class EmbryoClassifier(nn.Module):
    """Simple MLP trained on cross-species embeddings."""

    CLASSES = ["BE", "BN", "BX", "BL", "BI", "Mo", "Dg"]

    def __init__(self, input_dim: int = 768, hidden_dim: int = 256, num_classes: int = 7):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

    def predict(self, embedding_tensor: torch.Tensor) -> dict:
        with torch.no_grad():
            logits = self.forward(embedding_tensor)
            probs = torch.softmax(logits, dim=-1)
            top_prob, top_idx = probs.max(dim=-1)
            return {
                "classification": self.CLASSES[top_idx.item()],
                "confidence": round(top_prob.item() * 100),
                "probabilities": {
                    cls: round(p.item() * 100)
                    for cls, p in zip(self.CLASSES, probs[0])
                },
            }


classifier = None
CLASSIFIER_PATH = Path("embryo_classifier.pth")
if CLASSIFIER_PATH.exists():
    logger.info("Loading MLP classifier...")
    classifier = EmbryoClassifier()
    classifier.load_state_dict(torch.load(CLASSIFIER_PATH, map_location="cpu"))
    classifier.eval().to(device)
    logger.info("MLP classifier loaded")
else:
    logger.warning("No MLP classifier found (embryo_classifier.pth). MLP predictions disabled.")

# ─── Constants ───

BORDER_PCT = 0.15
NOISE_MARGIN = 1.2
MAX_ALIGNMENT_OFFSET = 20


# ─── Image processing functions ───

def decode_crops(frame_list: list[str]) -> list[np.ndarray]:
    """Decode base64 JPEG strings to OpenCV BGR arrays."""
    crops = []
    for b64 in frame_list:
        try:
            img_bytes = base64.b64decode(b64)
            arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None:
                crops.append(frame)
        except Exception:
            continue
    return crops


def align_crops(crops: list[np.ndarray]) -> list[np.ndarray]:
    """Align all crops to the first one via template matching."""
    if len(crops) <= 1:
        return crops

    reference = cv2.cvtColor(crops[0], cv2.COLOR_BGR2GRAY)
    aligned = [crops[0]]

    for i in range(1, len(crops)):
        gray = cv2.cvtColor(crops[i], cv2.COLOR_BGR2GRAY)
        result = cv2.matchTemplate(gray, reference, cv2.TM_CCOEFF_NORMED)
        _, _, _, max_loc = cv2.minMaxLoc(result)
        dy, dx = max_loc[1], max_loc[0]

        if abs(dx) < MAX_ALIGNMENT_OFFSET and abs(dy) < MAX_ALIGNMENT_OFFSET:
            M = np.float32([[1, 0, -dx], [0, 1, -dy]])
            warped = cv2.warpAffine(crops[i], M, (crops[i].shape[1], crops[i].shape[0]))
            aligned.append(warped)
        else:
            aligned.append(crops[i])

    return aligned


def select_sharpest(frames: list[np.ndarray]) -> int:
    """Select the sharpest frame by Laplacian variance."""
    best_idx, best_val = 0, -1.0
    for i, f in enumerate(frames):
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        val = cv2.Laplacian(gray, cv2.CV_64F).var()
        if val > best_val:
            best_val = val
            best_idx = i
    return best_idx


def compute_motion_map(
    frames: list[np.ndarray],
) -> tuple[np.ndarray, dict]:
    """Compute motion map with background noise subtraction."""
    h, w = frames[0].shape[:2]
    motion_raw = np.zeros((h, w), dtype=np.float64)

    bx, by = int(w * BORDER_PCT), int(h * BORDER_PCT)
    border_mask = np.ones((h, w), dtype=bool)
    border_mask[by : h - by, bx : w - bx] = False
    center_mask = ~border_mask

    diffs = []
    for i in range(1, len(frames)):
        diff = cv2.absdiff(frames[i], frames[i - 1]).mean(axis=2)
        motion_raw += diff
        border_mean = float(diff[border_mask].mean()) if border_mask.any() else 0.0
        center_mean = float(diff[center_mask].mean()) if center_mask.any() else 0.0
        diffs.append(max(0.0, center_mean - border_mean))

    # Background noise subtraction
    bg_noise = float(motion_raw[border_mask].mean()) if border_mask.any() else 0.0
    threshold = bg_noise * NOISE_MARGIN
    motion_clean = np.maximum(0, motion_raw - threshold)

    # Normalize to 0-255
    if motion_clean.max() > 0:
        motion_norm = (motion_clean / motion_clean.max() * 255).astype(np.uint8)
    else:
        motion_norm = np.zeros((h, w), dtype=np.uint8)

    # Apply HOT colormap
    motion_colored = cv2.applyColorMap(motion_norm, cv2.COLORMAP_HOT)

    # Compute kinetic metrics
    d = np.array(diffs) if diffs else np.array([0.0])
    intensity = float(d.mean())
    harmony = float(1.0 - min(1.0, d.std() / (intensity + 0.001)))
    stability = float(
        1.0 - min(1.0, (d.std() / (intensity + 0.001)) if intensity > 0 else 0.0)
    )

    half_h, half_w = h // 2, w // 2
    quads = [
        float(motion_norm[:half_h, :half_w].mean()),
        float(motion_norm[:half_h, half_w:].mean()),
        float(motion_norm[half_h:, :half_w].mean()),
        float(motion_norm[half_h:, half_w:].mean()),
    ]
    q_mean, q_std = float(np.mean(quads)), float(np.std(quads))
    symmetry = float(1.0 - min(1.0, q_std / (q_mean + 0.001)))

    kinetics = {
        "intensity": round(intensity, 4),
        "harmony": round(harmony, 4),
        "symmetry": round(symmetry, 4),
        "stability": round(stability, 4),
        "background_noise": round(bg_noise, 2),
    }

    return motion_colored, kinetics


def compose_image(frame: np.ndarray, motion_map: np.ndarray) -> Image.Image:
    """Compose morphology + motion map side by side."""
    h, w = frame.shape[:2]
    motion_resized = cv2.resize(motion_map, (w, h))
    composite = np.hstack([frame, motion_resized])
    return Image.fromarray(cv2.cvtColor(composite, cv2.COLOR_BGR2RGB))


def encode_jpeg(img: np.ndarray, quality: int = 85) -> str:
    """Encode OpenCV image to base64 JPEG."""
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf.tobytes()).decode()


# ─── Endpoints ───


@app.post("/analyze-embryo")
async def analyze_embryo(frames_json: str = Form(...)):
    """
    Process crops of a single embryo across time frames.

    Input: Form field `frames_json` — JSON array of base64 JPEG strings.
    Output: embedding (768d), kinetics, images (base64), MLP classification.
    """
    try:
        frame_list = json.loads(frames_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in frames_json")

    crops = decode_crops(frame_list)
    if len(crops) < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient crops: {len(crops)} (minimum 5)",
        )

    logger.info(f"Processing {len(crops)} crops")

    # 1. Align crops
    crops = align_crops(crops)

    # 2. Select sharpest
    best_idx = select_sharpest(crops)
    best_frame = crops[best_idx]

    # 3. Motion map with noise subtraction
    motion_map, kinetics = compute_motion_map(crops)

    # 4. Compose image
    composite = compose_image(best_frame, motion_map)

    # 5. DINOv2 embedding
    tensor = img_transform(composite).unsqueeze(0).to(device)
    with torch.no_grad():
        emb = model(tensor)
    embedding = emb[0].cpu().tolist()

    # 6. MLP classification (if available)
    mlp_result = None
    if classifier is not None:
        emb_tensor = torch.tensor([embedding], dtype=torch.float32).to(device)
        mlp_result = classifier.predict(emb_tensor)

    # 7. Encode images
    best_frame_b64 = encode_jpeg(best_frame)
    motion_map_b64 = encode_jpeg(motion_map)
    composite_bgr = cv2.cvtColor(np.array(composite), cv2.COLOR_RGB2BGR)
    composite_b64 = encode_jpeg(composite_bgr)

    result = {
        "embedding": embedding,
        "kinetics": kinetics,
        "best_frame_b64": best_frame_b64,
        "motion_map_b64": motion_map_b64,
        "composite_b64": composite_b64,
        "frame_count": len(crops),
        "best_frame_index": best_idx,
    }

    if mlp_result is not None:
        result["mlp_classification"] = mlp_result

    return result


@app.post("/embed-single")
async def embed_single(image_b64: str = Form(...)):
    """
    Get DINOv2 embedding for a single image (no motion analysis).
    Used for atlas bootstrap with static dataset images.

    Input: Form field `image_b64` — base64-encoded JPEG/PNG.
    Output: embedding (768d) + optional MLP classification.
    """
    try:
        img_bytes = base64.b64decode(image_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    # Convert to PIL and get embedding
    pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    tensor = img_transform(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        emb = model(tensor)
    embedding = emb[0].cpu().tolist()

    result = {"embedding": embedding}

    # MLP classification if available
    if classifier is not None:
        emb_tensor = torch.tensor([embedding], dtype=torch.float32).to(device)
        result["mlp_classification"] = classifier.predict(emb_tensor)

    return result


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "dinov2_vitb14",
        "device": str(device),
        "classifier_loaded": classifier is not None,
    }
