"""
Cloud Run Frame Extractor — 5 endpoints:
  POST /extract-frame      — FFmpeg extrai 1 frame de vídeo → JPEG base64
  POST /crop-frame         — Pillow recorta bboxes de um frame → array de JPEG base64
  POST /detect-and-crop    — OpenCV detecta embriões + extrai crops (substitui Gemini)
  POST /extract-and-crop   — Extrai crops com bboxes já conhecidas
  POST /analyze-activity   — Análise cinética por embrião → kinetic_profile + frames
  GET  /health             — Health check

Stateless. Sem credenciais Supabase — recebe signed URLs.
"""

import base64
import io
import os
import subprocess
import tempfile

import cv2
import numpy as np
import requests as http_requests
from flask import Flask, jsonify, request
from PIL import Image

# Tentar importar ultralytics (pode não estar instalado no build atual)
# Tentar importar ultralytics (pode não estar instalado no build atual)
try:
    from ultralytics import YOLO
    print("Ultralytics YOLO importado com sucesso.")
    
    # Tentar carregar modelo customizado com tratamento de erro robusto
    MODEL_PATH = "best.pt"
    try:
        if os.path.exists(MODEL_PATH):
            print(f"Carregando modelo YOLOv8: {MODEL_PATH}")
            yolo_model = YOLO(MODEL_PATH)
            # Teste rápido de inferência para garantir que modelo está na memória
            # yolo_model(np.zeros((64, 64, 3), dtype=np.uint8), verbose=False)
            print("Modelo YOLOv8 carregado com sucesso.")
        else:
            print(f"AVISO: Modelo {MODEL_PATH} nao encontrado. Endpoint /detect-yolo retornara erro.")
            yolo_model = None
    except Exception as e:
        print(f"ERRO CRITICO ao carregar modelo YOLO: {e}")
        print("A aplicacao continuara rodando, mas /detect-yolo retornara 503.")
        yolo_model = None

except ImportError:
    print("AVISO: Ultralytics nao instalado. Endpoint /detect-yolo indisponivel.")
    yolo_model = None

app = Flask(__name__)


@app.route("/extract-frame", methods=["POST"])
def extract_frame():
    """
    Input:  { video_url: str, position: float (0-1) }
    Output: { frame_base64: str, width: int, height: int }

    Baixa vídeo via signed URL → FFmpeg extrai 1 frame → JPEG base64.
    Se frame sair preto, tenta posições 0.25 e 0.1 como fallback.
    """
    data = request.get_json(force=True)
    video_url = data.get("video_url")
    position = data.get("position", 0.5)

    if not video_url:
        return jsonify({"error": "video_url é obrigatório"}), 400

    # Download do vídeo para arquivo temporário
    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Falha ao baixar vídeo: {str(e)[:200]}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)

    try:
        # Obter duração do vídeo
        duration = _get_duration(tmp_path)
        if duration <= 0:
            duration = 10.0  # fallback

        # Tentar posição principal; se frame preto, fallback
        for pos in [position, 0.25, 0.1]:
            seek_time = max(0.1, duration * pos)
            frame_bytes = _extract_frame_ffmpeg(tmp_path, seek_time)
            if frame_bytes and not _is_black_frame(frame_bytes):
                img = Image.open(io.BytesIO(frame_bytes))
                b64 = base64.b64encode(frame_bytes).decode("ascii")
                return jsonify({
                    "frame_base64": b64,
                    "width": img.width,
                    "height": img.height,
                })

        return jsonify({"error": "Todos os frames extraídos estão pretos"}), 422
    finally:
        os.unlink(tmp_path)


@app.route("/crop-frame", methods=["POST"])
def crop_frame():
    """
    Input:  { frame_base64: str, width: int, height: int,
              bboxes: [{x_percent, y_percent, width_percent, height_percent, ...}],
              padding: float (default 0.20), output_size: int (default 400) }
    Output: { crops: [str, ...] }  (array de JPEG base64)
    """
    data = request.get_json(force=True)
    frame_b64 = data.get("frame_base64")
    bboxes = data.get("bboxes", [])
    padding = data.get("padding", 0.20)
    output_size = data.get("output_size", 400)

    if not frame_b64:
        return jsonify({"error": "frame_base64 é obrigatório"}), 400
    if not bboxes:
        return jsonify({"error": "bboxes é obrigatório"}), 400

    # Decodificar frame
    img_bytes = base64.b64decode(frame_b64)
    img = Image.open(io.BytesIO(img_bytes))
    fw, fh = img.width, img.height

    crops = []
    for bbox in bboxes:
        x_pct = bbox.get("x_percent", 0)
        y_pct = bbox.get("y_percent", 0)
        w_pct = bbox.get("width_percent", 0)
        h_pct = bbox.get("height_percent", 0)

        center_x = (x_pct / 100) * fw
        center_y = (y_pct / 100) * fh
        bbox_w = (w_pct / 100) * fw
        bbox_h = (h_pct / 100) * fh

        size = max(bbox_w, bbox_h)
        padded = size * (1 + padding * 2)

        left = center_x - padded / 2
        top = center_y - padded / 2
        right = center_x + padded / 2
        bottom = center_y + padded / 2

        # Clamp to image bounds
        if left < 0:
            right -= left
            left = 0
        if top < 0:
            bottom -= top
            top = 0
        if right > fw:
            left -= (right - fw)
            right = fw
        if bottom > fh:
            top -= (bottom - fh)
            bottom = fh
        left = max(0, left)
        top = max(0, top)
        right = min(fw, right)
        bottom = min(fh, bottom)

        # Crop and resize
        cropped = img.crop((int(left), int(top), int(right), int(bottom)))
        cropped = cropped.resize((output_size, output_size), Image.LANCZOS)

        buf = io.BytesIO()
        cropped.save(buf, format="JPEG", quality=85)
        crops.append(base64.b64encode(buf.getvalue()).decode("ascii"))

    return jsonify({"crops": crops})


# ─── OpenCV Embryo Detection ─────────────────────────────


def _detect_embryos_opencv(frame, expected_count=0):
    """
    Detect dark circular embryos in a stereomicroscope frame using pure OpenCV.

    Strategy:
      1. CLAHE + blur for contrast-enhanced grayscale
      2. Adaptive threshold (inverted) to isolate dark structures
      3. Morphological cleanup
      4. Contour detection with circularity + size + darkness filtering
      5. HoughCircles as supplementary detector
      6. Merge, deduplicate, filter outliers
      7. Sort in reading order (top→bottom, left→right)

    Returns list of dicts: [{x_percent, y_percent, width_percent, height_percent, radius_px}]
    """
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # ── 1. Preprocessing ──
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (0, 0), sigmaX=max(3, w // 300))

    # Estimate background intensity (median of image = bright background)
    bg_intensity = float(np.median(blurred))

    # ── 2. Adaptive threshold (dark objects → white in mask) ──
    block_size = max(31, (min(w, h) // 10) | 1)  # ensure odd
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, block_size, 10
    )

    # ── 3. Morphological cleanup ──
    # Close small gaps, then open to remove noise
    kernel_close = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (max(5, w // 200), max(5, w // 200))
    )
    kernel_open = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (max(3, w // 400), max(3, w // 400))
    )
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel_open)

    # ── 4. Contour detection ──
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Size bounds for embryos: typical range 2-20% of image width
    min_radius = int(w * 0.015)
    max_radius = int(w * 0.15)
    min_area = 3.14159 * min_radius * min_radius
    max_area = 3.14159 * max_radius * max_radius

    candidates = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        # Circularity check
        perimeter = cv2.arcLength(cnt, True)
        if perimeter <= 0:
            continue
        circularity = 4 * 3.14159 * area / (perimeter * perimeter)
        if circularity < 0.35:  # embryos are roughly circular, relaxed to 0.35
            continue

        # Fit enclosing circle
        (cx, cy_c), radius = cv2.minEnclosingCircle(cnt)
        cx, cy_c, radius = float(cx), float(cy_c), float(radius)

        if radius < min_radius or radius > max_radius:
            continue

        # Darkness check: mean intensity inside must be darker than background
        mask = np.zeros(gray.shape, dtype=np.uint8)
        cv2.circle(mask, (int(cx), int(cy_c)), int(radius * 0.8), 255, -1)
        mean_inside = float(cv2.mean(gray, mask=mask)[0])

        # Embryo should be darker than background (relaxed to 0.99)
        darkness_ratio = mean_inside / max(bg_intensity, 1.0)
        if darkness_ratio > 0.99:
            continue

        candidates.append({
            "cx": cx, "cy": cy_c, "radius": radius,
            "area": area, "circularity": circularity,
            "darkness": darkness_ratio,
            "source": "contour",
        })

    # ── 5. HoughCircles as supplementary detector ──
    hough_min_r = max(min_radius, int(w * 0.02))
    hough_max_r = max_radius
    hough_min_dist = int(hough_min_r * 1.5)

    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2,
        minDist=hough_min_dist,
        param1=80, param2=25,
        minRadius=hough_min_r,
        maxRadius=hough_max_r,
    )

    if circles is not None:
        for c in circles[0]:
            cx_h, cy_h, r_h = float(c[0]), float(c[1]), float(c[2])

            # Darkness check
            mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.circle(mask, (int(cx_h), int(cy_h)), int(r_h * 0.8), 255, -1)
            mean_inside = float(cv2.mean(gray, mask=mask)[0])
            darkness_ratio = mean_inside / max(bg_intensity, 1.0)
            if darkness_ratio > 0.92:
                continue

            candidates.append({
                "cx": cx_h, "cy": cy_h, "radius": r_h,
                "area": 3.14159 * r_h * r_h,
                "circularity": 1.0,
                "darkness": darkness_ratio,
                "source": "hough",
            })

    if not candidates:
        return []

    # ── 6. Deduplicate (merge detections that heavily overlap) ──
    candidates.sort(key=lambda c: -c["area"])  # prefer larger
    merged = []
    used = set()

    for i, a in enumerate(candidates):
        if i in used:
            continue
        group = [a]
        for j, b in enumerate(candidates[i + 1:], start=i + 1):
            if j in used:
                continue
            dist = ((a["cx"] - b["cx"]) ** 2 + (a["cy"] - b["cy"]) ** 2) ** 0.5
            # Only merge if circles actually overlap significantly (>40%)
            merge_threshold = min(a["radius"], b["radius"]) * 0.8
            if dist < merge_threshold:
                group.append(b)
                used.add(j)
        used.add(i)

        # Average the group
        avg_cx = sum(g["cx"] for g in group) / len(group)
        avg_cy = sum(g["cy"] for g in group) / len(group)
        avg_r = sum(g["radius"] for g in group) / len(group)
        best_dark = min(g["darkness"] for g in group)
        best_circ = max(g["circularity"] for g in group)
        merged.append({
            "cx": avg_cx, "cy": avg_cy, "radius": avg_r,
            "darkness": best_dark, "circularity": best_circ,
            "n_sources": len(group),
        })

    # ── 7. Filter size outliers ──
    if len(merged) > 1:
        radii = [m["radius"] for m in merged]
        median_r = sorted(radii)[len(radii) // 2]
        # Keep only candidates within 0.4x–2.5x of median radius
        merged = [m for m in merged if 0.4 * median_r <= m["radius"] <= 2.5 * median_r]

    # ── 8. Rank by quality: prefer darker, rounder, multi-source ──
    for m in merged:
        m["score"] = (
            (1.0 - m["darkness"]) * 40  # darker = better (higher score)
            + m["circularity"] * 30      # rounder = better
            + min(m["n_sources"], 3) * 10  # confirmed by multiple methods
        )
    merged.sort(key=lambda m: -m["score"])

    # If expected_count given, trim to it
    if expected_count > 0 and len(merged) > expected_count:
        merged = merged[:expected_count]

    # ── 9. Sort in reading order (top→bottom, left→right) ──
    if len(merged) > 1:
        avg_r_all = sum(m["radius"] for m in merged) / len(merged)
        row_tolerance = avg_r_all * 1.5
        merged.sort(key=lambda m: m["cy"])
        rows = [[merged[0]]]
        for m in merged[1:]:
            if abs(m["cy"] - rows[-1][0]["cy"]) < row_tolerance:
                rows[-1].append(m)
            else:
                rows.append([m])
        for row in rows:
            row.sort(key=lambda m: m["cx"])
        merged = [m for row in rows for m in row]

    # ── 10. Convert to percentage-based bboxes ──
    bboxes = []
    for m in merged:
        diameter = m["radius"] * 2
        bboxes.append({
            "x_percent": round(m["cx"] / w * 100, 2),
            "y_percent": round(m["cy"] / h * 100, 2),
            "width_percent": round(diameter / w * 100, 2),
            "height_percent": round(diameter / h * 100, 2),
            "radius_px": round(m["radius"], 1),
        })

    return bboxes


@app.route("/detect-and-crop", methods=["POST"])
def detect_and_crop():
    """
    OpenCV-powered embryo detection + multi-frame crop extraction in ONE trip.
    Replaces Gemini box_2d detection entirely.

    Input:  { video_url: str, expected_count: int, frame_count: int (default 40) }
    Output: {
      bboxes: [{x_percent, y_percent, width_percent, height_percent, radius_px}],
      embryos: { "0": [crop_b64, ...], "1": [...], ... },
      plate_frame_b64: str,
      frames_extracted: int,
      detection_method: "opencv"
    }
    """
    import traceback as _tb

    data = request.get_json(force=True)
    video_url = data.get("video_url")
    expected_count = data.get("expected_count", 0)
    frame_count = data.get("frame_count", 40)
    padding = data.get("padding", 0.18)  # 18% each side

    if not video_url:
        return jsonify({"error": "video_url é obrigatório"}), 400

    # Download video
    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Falha ao baixar vídeo: {str(e)[:200]}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return jsonify({"error": "Não foi possível abrir o vídeo"}), 422

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            cap.release()
            return jsonify({"error": "Vídeo sem frames"}), 422

        # ── Step 1: Extract mid-frame for detection ──
        det_frame_idx = total_frames // 2
        cap.set(cv2.CAP_PROP_POS_FRAMES, det_frame_idx)
        ret, det_frame = cap.read()
        if not ret:
            # Fallback: try first frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, det_frame = cap.read()
        if not ret:
            cap.release()
            return jsonify({"error": "Não foi possível extrair frame para detecção"}), 422

        # ── Step 1.5: Encode detection frame as plate_frame (Middle Frame is safer) ──
        _, plate_jpg = cv2.imencode(".jpg", det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        plate_frame_b64 = base64.b64encode(plate_jpg.tobytes()).decode("ascii")

        # ── Step 2: OpenCV detection ──
        bboxes = _detect_embryos_opencv(det_frame, expected_count)

        if not bboxes:
            cap.release()
            # Encode detection frame for debugging
            _, det_jpg = cv2.imencode(".jpg", det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            plate_b64 = base64.b64encode(det_jpg.tobytes()).decode("ascii")
            return jsonify({
                "bboxes": [],
                "embryos": {},
                "plate_frame_b64": plate_b64,
                "frames_extracted": 0,
                "detection_method": "opencv",
                "error": "Nenhum embrião detectado pelo OpenCV",
            }), 200  # Not 4xx — detection legitimately found nothing

        h_frame, w_frame = det_frame.shape[:2]

        # ── Step 3: Extract N frames uniformly + crop each embryo ──
        step = max(1, total_frames // frame_count)
        embryo_crops = {str(i): [] for i in range(len(bboxes))}
        plate_frame_b64 = None
        extracted = 0

        cap.set(cv2.CAP_PROP_POS_FRAMES, min(5, total_frames - 1))
        frame_idx = 0

        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                fh, fw = frame.shape[:2]

                # Save plate_frame (first extracted frame)
                if plate_frame_b64 is None:
                    _, plate_jpg = cv2.imencode(
                        ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95]
                    )
                    plate_frame_b64 = base64.b64encode(
                        plate_jpg.tobytes()
                    ).decode("ascii")

                # Crop each embryo
                for emb_idx, bbox in enumerate(bboxes):
                    x_pct = bbox["x_percent"]
                    y_pct = bbox["y_percent"]
                    w_pct = bbox["width_percent"]
                    h_pct = bbox["height_percent"]

                    # Center-based % → pixel coords with dynamic padding
                    size = max(w_pct, h_pct) / 100
                    padded = size * (1 + padding * 2)
                    half = padded / 2

                    cx = x_pct / 100
                    cy = y_pct / 100

                    x1 = int(max(0, (cx - half)) * fw)
                    y1 = int(max(0, (cy - half)) * fh)
                    x2 = int(min(1, (cx + half)) * fw)
                    y2 = int(min(1, (cy + half)) * fh)

                    crop = frame[y1:y2, x1:x2]
                    if crop.size > 0:
                        crop_resized = cv2.resize(
                            crop, (400, 400), interpolation=cv2.INTER_LANCZOS4
                        )
                        _, crop_jpg = cv2.imencode(
                            ".jpg", crop_resized, [cv2.IMWRITE_JPEG_QUALITY, 95]
                        )
                        embryo_crops[str(emb_idx)].append(
                            base64.b64encode(crop_jpg.tobytes()).decode("ascii")
                        )

                extracted += 1
            frame_idx += 1

        cap.release()

        # Detection confidence
        det_conf = "high" if len(bboxes) == expected_count else (
            "low" if len(bboxes) < expected_count else "medium"
        )

        return jsonify({
            "bboxes": bboxes,
            "embryos": embryo_crops,
            "plate_frame_b64": plate_frame_b64,
            "frames_extracted": extracted,
            "detection_method": "opencv",
            "detection_confidence": det_conf,
        })

    except Exception as e:
        app.logger.error(f"detect-and-crop error: {_tb.format_exc()}")
        return jsonify({"error": f"{type(e).__name__}: {str(e)[:500]}"}), 500

    finally:
        os.unlink(tmp_path)


@app.route("/extract-and-crop", methods=["POST"])
def extract_and_crop():
    """
    EmbryoScore v2 — Extract multiple frames from video and crop per embryo.

    Input:  { video_url: str, bboxes: [...], frame_count: int (default 40) }
    Output: {
      embryos: { "0": [crop_b64, ...], "1": [...], ... },
      plate_frame_b64: str,
      frames_extracted: int
    }

    The full frames are extracted and cropped here — they NEVER leave this service.
    Only small crops (~30KB each) are returned.
    """
    import traceback as _tb

    data = request.get_json(force=True)
    video_url = data.get("video_url")
    bboxes = data.get("bboxes", [])
    frame_count = data.get("frame_count", 40)

    if not video_url:
        return jsonify({"error": "video_url é obrigatório"}), 400
    if not bboxes:
        return jsonify({"error": "bboxes é obrigatório"}), 400

    # Download video
    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Falha ao baixar vídeo: {str(e)[:200]}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return jsonify({"error": "Não foi possível abrir o vídeo"}), 422

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            cap.release()
            return jsonify({"error": "Vídeo sem frames"}), 422

        step = max(1, total_frames // frame_count)

        embryo_crops = {str(i): [] for i in range(len(bboxes))}
        plate_frame_b64 = None
        frame_idx = 0
        extracted = 0

        # Skip first 5 frames to avoid fade-in/blur
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(5, total_frames - 1))
        frame_idx = 0

        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                h, w = frame.shape[:2]

                # Save first frame as plate_frame
                if plate_frame_b64 is None:
                    _, plate_jpg = cv2.imencode(
                        ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95]
                    )
                    plate_frame_b64 = base64.b64encode(
                        plate_jpg.tobytes()
                    ).decode("ascii")

                # Crop each embryo from this frame
                for emb_idx, bbox in enumerate(bboxes):
                    x_pct = bbox.get("x_percent", 50)
                    y_pct = bbox.get("y_percent", 50)
                    w_pct = bbox.get("width_percent", 10)
                    h_pct = bbox.get("height_percent", 10)

                    # Convert center-based % to pixel coords with 20% padding
                    size = max(w_pct, h_pct) / 100
                    padded = size * 1.4  # 20% padding each side
                    half = padded / 2

                    cx = x_pct / 100
                    cy = y_pct / 100

                    x1 = int(max(0, (cx - half)) * w)
                    y1 = int(max(0, (cy - half)) * h)
                    x2 = int(min(1, (cx + half)) * w)
                    y2 = int(min(1, (cy + half)) * h)

                    crop = frame[y1:y2, x1:x2]
                    if crop.size > 0:
                        # Resize to 400x400 for consistency
                        crop_resized = cv2.resize(
                            crop, (400, 400), interpolation=cv2.INTER_LANCZOS4
                        )
                        _, crop_jpg = cv2.imencode(
                            ".jpg", crop_resized, [cv2.IMWRITE_JPEG_QUALITY, 95]
                        )
                        embryo_crops[str(emb_idx)].append(
                            base64.b64encode(crop_jpg.tobytes()).decode("ascii")
                        )

                extracted += 1
            frame_idx += 1

        cap.release()

        return jsonify({
            "embryos": embryo_crops,
            "plate_frame_b64": plate_frame_b64,
            "frames_extracted": extracted,
        })

    except Exception as e:
        app.logger.error(f"extract-and-crop error: {_tb.format_exc()}")
        return jsonify({"error": f"{type(e).__name__}: {str(e)[:500]}"}), 500

    finally:
        os.unlink(tmp_path)


@app.route("/detect-yolo", methods=["POST"])
def detect_yolo():
    """
    Deteccao local usando YOLOv8 customizado (treinado pelo usuario).
    Input: { video_url, frame_b64, expected_count }
    Output: { bboxes: [...], detection_confidence: '...' }
    """
    if yolo_model is None:
        return jsonify({"error": "Modelo YOLO nao carregado ou ultralytics nao instalado."}), 503

    data = request.get_json(force=True)
    frame_b64 = data.get("frame_base64")
    
    # Se nao vier frame, tentar extrair do video (logica simplificada para MVP)
    if not frame_b64 and data.get("video_url"):
        # Reutilizar logica de extract-frame ou pedir frame_b64 obrigatorio
        return jsonify({"error": "Por favor forneca 'frame_base64' para este endpoint."}), 400

    if not frame_b64:
        return jsonify({"error": "frame_base64 obrigatorio"}), 400

    try:
        # Decodificar imagem
        img_bytes = base64.b64decode(frame_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # Inferência
        # conf=0.4 para ser mais robusto, iou=0.6
        results = yolo_model(img, conf=0.4, iou=0.6, verbose=False)
        
        bboxes = []
        h, w = img.shape[:2]
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # box.xyxy[0] -> x1, y1, x2, y2
                # converter para x_percent etc
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                bw = x2 - x1
                bh = y2 - y1
                
                bboxes.append({
                    "x_percent": round(cx / w * 100, 2),
                    "y_percent": round(cy / h * 100, 2),
                    "width_percent": round(bw / w * 100, 2),
                    "height_percent": round(bh / h * 100, 2),
                    "radius_px": round(max(bw, bh) / 2, 1),
                    "confidence": round(conf, 2),
                    "source": "yolo_custom"
                })

        return jsonify({
            "bboxes": bboxes,
            "detection_method": "yolo_custom",
            "model_used": "best.pt",
            "count": len(bboxes)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze-activity", methods=["POST"])
def analyze_activity():
    """
    Input:  { video_url, bboxes, fps, num_key_frames, output_size, overlay_opacity }
    Output: {
      activity_scores: [int],
      embryos: [{
        index, activity_score, kinetic_profile, kinetic_quality_score,
        clean_frames: [b64], composite_frames: [b64], cumulative_heatmap: b64
      }]
    }

    Extrai frames do vídeo, calcula perfil cinético completo por embrião,
    gera frames limpos (para Gemini morfologia) + compostos com overlay (para Storage debug).
    """
    import traceback as _tb

    data = request.get_json(force=True)
    video_url = data.get("video_url")
    bboxes = data.get("bboxes", [])
    fps = data.get("fps", 8)
    num_key_frames = data.get("num_key_frames", 10)
    output_size = data.get("output_size", 400)
    overlay_opacity = data.get("overlay_opacity", 0.4)
    skip_composites = data.get("skip_composites", False)

    if not video_url:
        return jsonify({"error": "video_url é obrigatório"}), 400
    if not bboxes:
        return jsonify({"error": "bboxes é obrigatório"}), 400

    # Download vídeo
    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Falha ao baixar vídeo: {str(e)[:200]}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return jsonify({"error": "Não foi possível abrir o vídeo"}), 422

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if total_frames <= 0 or vid_w <= 0 or vid_h <= 0:
            cap.release()
            return jsonify({"error": "Vídeo inválido (sem frames)"}), 422

        # Amostrar frames no fps desejado
        sample_interval = max(1, round(video_fps / fps))
        sampled_indices = list(range(0, total_frames, sample_interval))

        if len(sampled_indices) < 2:
            cap.release()
            return jsonify({"error": "Vídeo muito curto para análise"}), 422

        gray_frames = []
        color_frames = []
        for idx in sampled_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
            color_frames.append(frame)
            gray_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))

        cap.release()

        if len(gray_frames) < 2:
            return jsonify({"error": "Poucos frames extraídos"}), 422

        # ═══════════════════════════════════════════════
        # Wide diffs (~1s gap) — compartilhados entre embriões
        # ═══════════════════════════════════════════════
        gap = max(1, int(fps))
        wide_diffs = []
        for i in range(gap, len(gray_frames)):
            wide_diffs.append(cv2.absdiff(gray_frames[i - gap], gray_frames[i]))

        # ═══════════════════════════════════════════════
        # Compensação de ruído de câmera (fundo = tudo fora dos embriões)
        # ═══════════════════════════════════════════════
        all_embryo_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
        for bbox in bboxes:
            bcx = int(bbox.get("x_percent", 50) / 100 * vid_w)
            bcy = int(bbox.get("y_percent", 50) / 100 * vid_h)
            bbw = int(bbox.get("width_percent", 10) / 100 * vid_w)
            bbh = int(bbox.get("height_percent", 10) / 100 * vid_h)
            br = max(bbw, bbh) // 2
            cv2.circle(all_embryo_mask, (bcx, bcy), int(br * 1.3), 255, -1)

        bg_indices = all_embryo_mask == 0

        if int(np.sum(bg_indices)) > 100:
            bg_pixels = [g[bg_indices].astype(np.float32) for g in gray_frames]
            bg_stack = np.stack(bg_pixels, axis=0)
            bg_std = float(np.mean(np.std(bg_stack, axis=0)))
            bg_timeline = [
                float(np.mean(wd[bg_indices].astype(np.float32)))
                for wd in wide_diffs
            ]
        else:
            bg_std = 0.0
            bg_timeline = [0.0] * len(wide_diffs)

        # ═══════════════════════════════════════════════
        # Para cada embrião (bbox)
        # ═══════════════════════════════════════════════
        embryo_results = []
        activity_scores = []

        for bbox_idx, bbox in enumerate(bboxes):
            x_pct = bbox.get("x_percent", 50)
            y_pct = bbox.get("y_percent", 50)
            w_pct = bbox.get("width_percent", 10)
            h_pct = bbox.get("height_percent", 10)

            cx = int(x_pct / 100 * vid_w)
            cy = int(y_pct / 100 * vid_h)
            bw = int(w_pct / 100 * vid_w)
            bh = int(h_pct / 100 * vid_h)
            radius = max(bw, bh) // 2

            # Máscara circular para a região do embrião
            mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
            cv2.circle(mask, (cx, cy), radius, 255, -1)
            mask_indices = mask > 0

            # ── Activity Score (compensado por ruído de câmera) ──
            pixel_values = [g[mask_indices].astype(np.float32) for g in gray_frames]
            if len(pixel_values) >= 2:
                pixel_stack = np.stack(pixel_values, axis=0)
                pixel_std = np.std(pixel_stack, axis=0)
                mean_std = float(np.mean(pixel_std))
                compensated_std = max(0.0, mean_std - bg_std)
                activity_score = int(min(100, max(0, compensated_std * 100 / 15)))
            else:
                activity_score = 0

            activity_scores.append(activity_score)

            # ── Perfil Cinético (compensado, sem pulsação/expansão) ──
            kinetic_profile = _compute_kinetic_profile(
                gray_frames, mask, mask_indices, cx, cy, radius, fps,
                wide_diffs, bg_std, bg_timeline
            )
            kinetic_quality = _compute_kinetic_quality(activity_score, kinetic_profile)

            # ── Key frames equidistantes ──
            total_sampled = len(color_frames)
            if num_key_frames == 1:
                key_indices = [total_sampled // 2]
            elif total_sampled <= num_key_frames:
                key_indices = list(range(total_sampled))
            else:
                key_indices = [
                    int(i * (total_sampled - 1) / (num_key_frames - 1))
                    for i in range(num_key_frames)
                ]

            # ── Região de crop com padding 20% ──
            padding_ratio = 0.20
            size = max(bw, bh)
            padded = int(size * (1 + padding_ratio * 2))
            half = padded // 2

            crop_left = max(0, cx - half)
            crop_top = max(0, cy - half)
            crop_right = min(vid_w, cx + half)
            crop_bottom = min(vid_h, cy + half)

            # ── Pre-compute diff max para normalização do overlay ──
            global_diff_max = 1.0
            for wd in wide_diffs:
                rv = wd[crop_top:crop_bottom, crop_left:crop_right]
                rm = float(rv.max())
                if rm > global_diff_max:
                    global_diff_max = rm

            # ── Gerar clean_frames (Gemini) + composite_frames (Storage) ──
            clean_frames_b64 = []
            composite_frames_b64 = []

            for ki, frame_idx in enumerate(key_indices):
                raw_crop = color_frames[frame_idx][crop_top:crop_bottom, crop_left:crop_right]

                # Clean frame (sem overlay — para Gemini avaliar morfologia)
                if raw_crop.shape[0] > 0 and raw_crop.shape[1] > 0:
                    clean_resized = cv2.resize(
                        raw_crop, (output_size, output_size),
                        interpolation=cv2.INTER_LANCZOS4
                    )
                else:
                    clean_resized = np.zeros((output_size, output_size, 3), dtype=np.uint8)
                _, clean_buf = cv2.imencode(
                    ".jpg", clean_resized, [cv2.IMWRITE_JPEG_QUALITY, 85]
                )
                clean_frames_b64.append(
                    base64.b64encode(clean_buf.tobytes()).decode("ascii")
                )

                # Composite frames + heatmap (skipped when skip_composites=True)
                if not skip_composites:
                    composite_crop = raw_crop.copy()
                    if ki > 0 and len(wide_diffs) > 0:
                        wide_idx = min(max(0, frame_idx - gap), len(wide_diffs) - 1)
                        diff_region = wide_diffs[wide_idx][
                            crop_top:crop_bottom, crop_left:crop_right
                        ]
                        diff_norm = np.clip(
                            diff_region.astype(np.float32) / global_diff_max * 255,
                            0, 255,
                        ).astype(np.uint8)
                        diff_colored = cv2.applyColorMap(diff_norm, cv2.COLORMAP_HOT)
                        diff_alpha = (
                            diff_region.astype(np.float32)
                            / global_diff_max
                            * overlay_opacity
                        )
                        diff_alpha_3ch = np.stack([diff_alpha] * 3, axis=-1)
                        composite_crop = (
                            composite_crop.astype(np.float32) * (1 - diff_alpha_3ch)
                            + diff_colored.astype(np.float32) * diff_alpha_3ch
                        ).astype(np.uint8)

                    if composite_crop.shape[0] > 0 and composite_crop.shape[1] > 0:
                        comp_resized = cv2.resize(
                            composite_crop, (output_size, output_size),
                            interpolation=cv2.INTER_LANCZOS4,
                        )
                    else:
                        comp_resized = np.zeros(
                            (output_size, output_size, 3), dtype=np.uint8
                        )
                    _, comp_buf = cv2.imencode(
                        ".jpg", comp_resized, [cv2.IMWRITE_JPEG_QUALITY, 85]
                    )
                    composite_frames_b64.append(
                        base64.b64encode(comp_buf.tobytes()).decode("ascii")
                    )

            heatmap_b64 = ""
            if not skip_composites:
                cumulative_heat = np.zeros((vid_h, vid_w), dtype=np.float64)
                for wd in wide_diffs:
                    cumulative_heat += wd.astype(np.float64)

                heat_crop = cumulative_heat[crop_top:crop_bottom, crop_left:crop_right]
                if heat_crop.max() > 0:
                    heat_norm = (heat_crop / heat_crop.max() * 255).astype(np.uint8)
                else:
                    heat_norm = np.zeros_like(heat_crop, dtype=np.uint8)

                heat_colored = cv2.applyColorMap(heat_norm, cv2.COLORMAP_JET)
                if heat_colored.shape[0] > 0 and heat_colored.shape[1] > 0:
                    heat_resized = cv2.resize(
                        heat_colored, (output_size, output_size),
                        interpolation=cv2.INTER_LANCZOS4,
                    )
                else:
                    heat_resized = np.zeros(
                        (output_size, output_size, 3), dtype=np.uint8
                    )
                _, heat_buf = cv2.imencode(
                    ".jpg", heat_resized, [cv2.IMWRITE_JPEG_QUALITY, 85]
                )
                heatmap_b64 = base64.b64encode(heat_buf.tobytes()).decode("ascii")

            embryo_results.append({
                "index": bbox_idx,
                "activity_score": activity_score,
                "kinetic_profile": kinetic_profile,
                "kinetic_quality_score": kinetic_quality,
                "clean_frames": clean_frames_b64,
                "composite_frames": composite_frames_b64,
                "cumulative_heatmap": heatmap_b64,
            })

        return jsonify({
            "activity_scores": activity_scores,
            "embryos": embryo_results,
            "frames_sampled": len(gray_frames),
        })

    except Exception as e:
        app.logger.error(f"analyze-activity error: {_tb.format_exc()}")
        return jsonify({"error": f"{type(e).__name__}: {str(e)[:500]}"}), 500

    finally:
        os.unlink(tmp_path)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ─── Kinetic Profile Helpers ──────────────────────────────


def _compute_kinetic_profile(gray_frames, full_mask, mask_indices,
                             cx, cy, radius, fps, wide_diffs,
                             bg_std, bg_timeline):
    """
    Compute kinetic profile from frame sequence, compensated for camera noise.

    bg_std: background pixel std (camera noise floor)
    bg_timeline: per-frame background diff means (camera movement per frame)

    Returns dict with regional activity, temporal pattern, symmetry,
    and focal activity — all mathematically computed and compensated.
    """
    vid_h, vid_w = gray_frames[0].shape

    # ── 1. Regional: core (inner 50%) vs periphery (outer ring), compensado ──
    inner_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
    cv2.circle(inner_mask, (cx, cy), max(1, radius // 2), 255, -1)
    inner_idx = inner_mask > 0

    outer_mask = full_mask.copy()
    outer_mask[inner_idx] = 0
    outer_idx = outer_mask > 0

    core_activity = 0
    periphery_activity = 0

    if np.sum(inner_idx) > 0 and len(gray_frames) >= 2:
        core_stack = np.stack(
            [g[inner_idx].astype(np.float32) for g in gray_frames]
        )
        core_raw = float(np.mean(np.std(core_stack, axis=0)))
        core_compensated = max(0.0, core_raw - bg_std)
        core_activity = int(min(100, max(0, core_compensated * 100 / 15)))

    if np.sum(outer_idx) > 0 and len(gray_frames) >= 2:
        periph_stack = np.stack(
            [g[outer_idx].astype(np.float32) for g in gray_frames]
        )
        periph_raw = float(np.mean(np.std(periph_stack, axis=0)))
        periph_compensated = max(0.0, periph_raw - bg_std)
        periphery_activity = int(min(100, max(0, periph_compensated * 100 / 15)))

    if core_activity > periphery_activity * 1.5 and core_activity > 5:
        peak_zone = "core"
    elif periphery_activity > core_activity * 1.5 and periphery_activity > 5:
        peak_zone = "periphery"
    else:
        peak_zone = "uniform"

    # ── 2. Activity timeline (compensado por movimento de câmera) ──
    raw_timeline = []
    for j, wd in enumerate(wide_diffs):
        embryo_diff = float(np.mean(wd[mask_indices].astype(np.float32)))
        bg_diff = bg_timeline[j] if j < len(bg_timeline) else 0.0
        raw_timeline.append(max(0.0, embryo_diff - bg_diff))

    timeline_norm = [
        int(min(100, max(0, v * 100 / 15))) for v in raw_timeline
    ]
    temporal_variability = (
        round(float(np.std(raw_timeline)), 2) if len(raw_timeline) > 1 else 0.0
    )

    # ── 3. Temporal pattern (sem pulsação — vídeo de 10s é curto demais) ──
    temporal_pattern = "stable"

    if len(raw_timeline) >= 3:
        x = np.arange(len(raw_timeline), dtype=np.float64)
        slope = float(np.polyfit(x, raw_timeline, 1)[0])
        mean_tl = float(np.mean(raw_timeline))
        rel_slope = slope / max(mean_tl, 0.01)

        if rel_slope > 0.08:
            temporal_pattern = "increasing"
        elif rel_slope < -0.08:
            temporal_pattern = "decreasing"
        elif temporal_variability > 2.0:
            temporal_pattern = "irregular"

    # ── 4. Symmetry (quadrant analysis of cumulative activity) ──
    cumulative = np.zeros((vid_h, vid_w), dtype=np.float64)
    for wd in wide_diffs:
        cumulative += wd.astype(np.float64)

    quads = []
    for y_sl, x_sl in [
        (slice(0, cy), slice(0, cx)),
        (slice(0, cy), slice(cx, vid_w)),
        (slice(cy, vid_h), slice(0, cx)),
        (slice(cy, vid_h), slice(cx, vid_w)),
    ]:
        q_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
        q_mask[y_sl, x_sl] = full_mask[y_sl, x_sl]
        quads.append(float(np.sum(cumulative[q_mask > 0])))

    total_q = sum(quads)
    activity_symmetry = 1.0
    focal_activity_detected = False

    if total_q > 0:
        mean_q = float(np.mean(quads))
        std_q = float(np.std(quads))
        activity_symmetry = round(
            max(0.0, min(1.0, 1.0 - std_q / max(mean_q, 0.01))), 2
        )
        focal_activity_detected = max(quads) / total_q > 0.50

    return {
        "core_activity": core_activity,
        "periphery_activity": periphery_activity,
        "peak_zone": peak_zone,
        "temporal_pattern": temporal_pattern,
        "activity_timeline": timeline_norm,
        "temporal_variability": temporal_variability,
        "activity_symmetry": activity_symmetry,
        "focal_activity_detected": focal_activity_detected,
    }


def _compute_kinetic_quality(activity_score, profile):
    """
    Compute kinetic quality score (0-100) from activity + profile.

    Maps raw activity (compensated for camera noise) into a quality assessment.
    Activity is NOT linear — the relationship with viability is a curve:
      0-5:   possibly dead → low quality
      6-15:  resting, normal → moderate quality
      16-30: healthy moderate → good quality
      31-50: very active → moderate quality
      51-70: concerning → low quality
      71+:   stress → very low quality

    Profile features (focal activity) add modifiers.
    """
    if activity_score <= 5:
        base = 25
    elif activity_score <= 15:
        base = 65
    elif activity_score <= 30:
        base = 75
    elif activity_score <= 50:
        base = 65
    elif activity_score <= 70:
        base = 45
    else:
        base = 25

    # Positive modifiers
    if profile.get("focal_activity_detected") and activity_score > 10:
        base += 5

    # Negative modifiers
    if profile.get("activity_symmetry", 1.0) < 0.4:
        base -= 5

    return max(0, min(100, base))


# ─── General Helpers ──────────────────────────────────────


def _get_duration(path: str) -> float:
    """Obtém duração do vídeo em segundos via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def _extract_frame_ffmpeg(path: str, seek_time: float) -> bytes | None:
    """Extrai 1 frame JPEG na posição seek_time."""
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-ss", f"{seek_time:.2f}",
                "-i", path,
                "-frames:v", "1",
                "-q:v", "2",
                "-f", "image2",
                "-vcodec", "mjpeg",
                "pipe:1",
            ],
            capture_output=True, timeout=30,
        )
        if result.returncode == 0 and len(result.stdout) > 1000:
            return result.stdout
        return None
    except Exception:
        return None


def _is_black_frame(frame_bytes: bytes) -> bool:
    """Verifica se frame é essencialmente preto (amostra central)."""
    try:
        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        w, h = img.size
        # Amostrar região central (25%)
        sx = int(w * 0.375)
        sy = int(h * 0.375)
        sw = int(w * 0.25)
        sh = int(h * 0.25)
        region = img.crop((sx, sy, sx + sw, sy + sh))

        pixels = list(region.getdata())
        bright = sum(1 for r, g, b in pixels if r > 8 or g > 8 or b > 8)
        ratio = bright / len(pixels) if pixels else 0
        return ratio < 0.05
    except Exception:
        return True


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
