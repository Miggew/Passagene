"""
EmbryoScore Pipeline v8 — Streaming Architecture

POST /analyze          — Full pipeline: detect + kinetics + DINOv2 + Gemini + Storage
POST /ocr              — OCR de relatórios de campo via Gemini 2.0 Flash Vision
POST /detect-and-crop  — Retrocompat: OpenCV detect + crop (from frame-extractor)
POST /analyze-activity — Retrocompat: Advanced kinetics (from frame-extractor)
GET  /health           — Health check

Consolidates frame-extractor (kinetics, detection) + old pipeline (DINOv2, Gemini, Storage).
DINOv2 via ONNX Runtime (~15MB) instead of PyTorch (~800MB).
"""

import base64
import collections
import gc
import io
import json
import logging
import os
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, wait as futures_wait
from datetime import datetime
from typing import Any, Optional

import cv2
import numpy as np
import requests as http_requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

# Lazy imports for heavy libs
genai = None
_cached_gemini_key = None
ort_session = None
supabase_client = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="embryoscore-pipeline-v8")

# ─── CORS ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://passagene.com.br",
        "https://www.passagene.com.br",
        "http://localhost:5173",
        "http://localhost:4173",
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# ─── Configuration ───────────────────────────────────────
FRAME_COUNT = 40
KINETIC_FPS = 8
OUTPUT_SIZE = 400
MAX_FRAME_HEIGHT = 720          # Downscale to 720p max to save memory
MAX_SAMPLED_FRAMES = 120        # Sampled frames (~15s at 8fps)
MAX_WIDTH = 1920                # Max width to prevent OOM with 4K+ videos
ONNX_MODEL_PATH = "dinov2_vits14.onnx"

# ─── Lazy Loading ────────────────────────────────────────

def _ensure_onnx():
    global ort_session
    if ort_session is not None:
        return
    if not os.path.exists(ONNX_MODEL_PATH):
        logger.warning(f"ONNX model not found at {ONNX_MODEL_PATH}. Embeddings will be zeros.")
        return
    import onnxruntime as ort
    logger.info(f"Loading DINOv2 ONNX model from {ONNX_MODEL_PATH}...")
    ort_session = ort.InferenceSession(ONNX_MODEL_PATH, providers=["CPUExecutionProvider"])
    logger.info("DINOv2 ONNX model loaded.")


def _ensure_gemini(api_key: str):
    global genai, _cached_gemini_key
    if genai is not None and _cached_gemini_key == api_key:
        return  # Same key, reuse
    import google.generativeai as _genai
    _genai.configure(api_key=api_key)
    genai = _genai
    _cached_gemini_key = api_key
    logger.info("Gemini API configured.")


_sb_cache = {}

def _get_supabase(url: str, key: str):
    cache_key = f"{url}:{key[:8]}"
    if cache_key not in _sb_cache:
        from supabase import create_client
        _sb_cache[cache_key] = create_client(url, key)
    return _sb_cache[cache_key]


# ─── API Key Auth ────────────────────────────────────────

PIPELINE_API_KEY = os.environ.get("PIPELINE_API_KEY", "")


def _check_api_key(request):
    """Validate X-Api-Key header if PIPELINE_API_KEY is configured."""
    if not PIPELINE_API_KEY:
        return  # No key configured = open (backward compat during rollout)
    key = request.headers.get("x-api-key") or ""
    if key != PIPELINE_API_KEY:
        raise HTTPException(403, "Invalid or missing API key")


# ─── Request/Response Models ─────────────────────────────

class AnalyzeRequest(BaseModel):
    # Minimal mode: only queue_id needed (Cloud Run resolves everything from DB)
    queue_id: Optional[str] = None
    # Legacy mode (backward compat with Edge Function): all fields provided
    video_url: Optional[str] = None
    job_id: Optional[str] = None
    expected_count: int = 0
    gemini_api_key: Optional[str] = None
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    prompt: Optional[str] = None
    model_name: str = "gemini-2.5-flash"
    # Fields for direct DB save
    lote_fiv_acasalamento_id: Optional[str] = None
    media_id: Optional[str] = None
    embryo_offset: int = 0
    # Biologist-provided bboxes (replaces OpenCV detection when present)
    bboxes: Optional[list[dict]] = None


# ─── Progress Helper ─────────────────────────────────────

def _update_progress(sb, job_id: str, message: str):
    """Update progress_message in embryo_analysis_queue for real-time UI feedback."""
    try:
        sb.table('embryo_analysis_queue').update({
            'progress_message': message,
        }).eq('id', job_id).execute()
    except Exception as e:
        logger.warning(f"Progress update failed for {job_id}: {e}")


# ─── Health ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "embryoscore-pipeline-v8",
        "onnx_available": os.path.exists(ONNX_MODEL_PATH),
    }


# ─── Extract Frame (lightweight) ─────────────────────────

class ExtractFrameRequest(BaseModel):
    video_url: str
    time_sec: float = 0.5


@app.post("/extract-frame")
async def extract_frame(req: ExtractFrameRequest):
    """
    Lightweight endpoint: download video, extract 1 frame via OpenCV, return JPEG base64.
    Avoids the browser having to download the entire video just for a thumbnail.
    """
    tmp_path = _download_video(req.video_url)
    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(422, "Could not open video")

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / video_fps if video_fps > 0 else 0

        # Seek to requested time (clamped to video duration)
        target_time = min(req.time_sec, duration * 0.5) if duration > 0 else 0
        target_frame = int(target_time * video_fps)
        target_frame = max(0, min(target_frame, total_frames - 1))

        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ret, frame = cap.read()

        if not ret:
            # Fallback: read first frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()

        cap.release()

        if not ret or frame is None:
            raise HTTPException(422, "Could not read any frame from video")

        _, jpg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_b64 = base64.b64encode(jpg.tobytes()).decode('ascii')

        return {
            "frame_base64": frame_b64,
            "width": int(frame.shape[1]),
            "height": int(frame.shape[0]),
            "time_sec": round(target_time, 2),
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ═══════════════════════════════════════════════════════════
# STREAMING ACCUMULATOR — O(1) memory per frame
# ═══════════════════════════════════════════════════════════


class _StreamingAccumulator:
    """Processes video frames one at a time. Eliminates storing all frames in memory."""

    def __init__(self, bboxes, vid_w, vid_h, fps, gap):
        self.bboxes = bboxes
        self.vid_w = vid_w
        self.vid_h = vid_h
        self.fps = fps
        self.gap = gap
        self.frame_count = 0

        # Sliding window (last gap+1 gray frames for diffs)
        self.gray_window = collections.deque(maxlen=gap + 1)

        # Cumulative heatmap (incremented on each diff)
        self.cumulative_heat = np.zeros((vid_h, vid_w), dtype=np.float64)

        # Background mask (everything outside embryo regions)
        all_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
        for bbox in bboxes:
            bcx = int(bbox.get("x_percent", 50) / 100 * vid_w)
            bcy = int(bbox.get("y_percent", 50) / 100 * vid_h)
            bbw = int(bbox.get("width_percent", 10) / 100 * vid_w)
            bbh = int(bbox.get("height_percent", 10) / 100 * vid_h)
            br = max(bbw, bbh) // 2
            cv2.circle(all_mask, (bcx, bcy), int(br * 1.3), 255, -1)

        self.bg_indices = all_mask == 0
        self.bg_pixel_count = int(np.sum(self.bg_indices))

        # Background Welford's accumulators
        self.bg_n = 0
        self.bg_mean = None
        self.bg_m2 = None
        self.bg_timeline = []

        # Per-embryo accumulators
        self.embryo_accs = []
        for bbox in bboxes:
            cx = int(bbox["x_percent"] / 100 * vid_w)
            cy = int(bbox["y_percent"] / 100 * vid_h)
            bw = int(bbox["width_percent"] / 100 * vid_w)
            bh = int(bbox["height_percent"] / 100 * vid_h)
            radius = max(bw, bh) // 2

            # Full embryo mask
            mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
            cv2.circle(mask, (cx, cy), radius, 255, -1)
            mask_indices = mask > 0

            # Core mask (inner half)
            inner_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
            cv2.circle(inner_mask, (cx, cy), max(1, radius // 2), 255, -1)
            inner_idx = inner_mask > 0

            # Periphery mask
            outer_mask = mask.copy()
            outer_mask[inner_idx] = 0
            outer_idx = outer_mask > 0

            # Crop bounds
            padding_ratio = 0.20
            size = max(bw, bh)
            padded = int(size * (1 + padding_ratio * 2))
            half = padded // 2
            crop_left = max(0, cx - half)
            crop_top = max(0, cy - half)
            crop_right = min(vid_w, cx + half)
            crop_bottom = min(vid_h, cy + half)

            self.embryo_accs.append({
                "cx": cx, "cy": cy, "radius": radius,
                "mask": mask, "mask_indices": mask_indices,
                "inner_idx": inner_idx, "outer_idx": outer_idx,
                "inner_count": int(np.sum(inner_idx)),
                "outer_count": int(np.sum(outer_idx)),
                # Welford's for full activity
                "act_n": 0, "act_mean": None, "act_m2": None,
                # Welford's for core
                "core_n": 0, "core_mean": None, "core_m2": None,
                # Welford's for periphery
                "peri_n": 0, "peri_mean": None, "peri_m2": None,
                # Mean intensity accumulator (for NSD)
                "intensity_sum": 0.0, "intensity_count": 0,
                # Diff timeline
                "emb_timeline": [],
                # Best crop tracking
                "crop_left": crop_left, "crop_top": crop_top,
                "crop_right": crop_right, "crop_bottom": crop_bottom,
                "best_sharpness": -1.0, "best_crop": None,
            })

    def process_frame(self, color_frame):
        """Called once per sampled frame."""
        gray = cv2.cvtColor(color_frame, cv2.COLOR_BGR2GRAY)

        # 1. APPEND to sliding window FIRST (critical order!)
        self.gray_window.append(gray)

        # 2. Compute diff only when window is full
        if len(self.gray_window) == self.gap + 1:
            diff = cv2.absdiff(self.gray_window[0], self.gray_window[-1])
            self.cumulative_heat += diff.astype(np.float64)

            # Background diff timeline
            if self.bg_pixel_count > 100:
                bg_diff_mean = float(np.mean(diff[self.bg_indices].astype(np.float32)))
                self.bg_timeline.append(bg_diff_mean)

            # Per-embryo diff timeline
            for acc in self.embryo_accs:
                emb_diff = float(np.mean(diff[acc["mask_indices"]].astype(np.float32)))
                acc["emb_timeline"].append(emb_diff)

        # 3. Background Welford's
        if self.bg_pixel_count > 100:
            pixels = gray[self.bg_indices].astype(np.float32)
            self.bg_n += 1
            if self.bg_mean is None:
                self.bg_mean = pixels.copy()
                self.bg_m2 = np.zeros_like(pixels)
            else:
                delta = pixels - self.bg_mean
                self.bg_mean += delta / self.bg_n
                delta2 = pixels - self.bg_mean
                self.bg_m2 += delta * delta2

        # 4. Per-embryo Welford's + best crop
        for acc in self.embryo_accs:
            # Full activity Welford's
            pixels = gray[acc["mask_indices"]].astype(np.float32)
            acc["act_n"] += 1
            if acc["act_mean"] is None:
                acc["act_mean"] = pixels.copy()
                acc["act_m2"] = np.zeros_like(pixels)
            else:
                d = pixels - acc["act_mean"]
                acc["act_mean"] += d / acc["act_n"]
                d2 = pixels - acc["act_mean"]
                acc["act_m2"] += d * d2

            # Accumulate intensity for NSD
            acc["intensity_sum"] += float(np.mean(pixels))
            acc["intensity_count"] += 1

            # Core Welford's
            if acc["inner_count"] > 0:
                core_pix = gray[acc["inner_idx"]].astype(np.float32)
                acc["core_n"] += 1
                if acc["core_mean"] is None:
                    acc["core_mean"] = core_pix.copy()
                    acc["core_m2"] = np.zeros_like(core_pix)
                else:
                    d = core_pix - acc["core_mean"]
                    acc["core_mean"] += d / acc["core_n"]
                    d2 = core_pix - acc["core_mean"]
                    acc["core_m2"] += d * d2

            # Periphery Welford's
            if acc["outer_count"] > 0:
                peri_pix = gray[acc["outer_idx"]].astype(np.float32)
                acc["peri_n"] += 1
                if acc["peri_mean"] is None:
                    acc["peri_mean"] = peri_pix.copy()
                    acc["peri_m2"] = np.zeros_like(peri_pix)
                else:
                    d = peri_pix - acc["peri_mean"]
                    acc["peri_mean"] += d / acc["peri_n"]
                    d2 = peri_pix - acc["peri_mean"]
                    acc["peri_m2"] += d * d2

            # Best crop (highest Laplacian sharpness)
            cl, ct = acc["crop_left"], acc["crop_top"]
            cr, cb = acc["crop_right"], acc["crop_bottom"]
            crop = color_frame[ct:cb, cl:cr]
            if crop.size > 0:
                crop_resized = cv2.resize(
                    crop, (OUTPUT_SIZE, OUTPUT_SIZE), interpolation=cv2.INTER_LANCZOS4)
                gray_crop = cv2.cvtColor(crop_resized, cv2.COLOR_BGR2GRAY)
                sharpness = cv2.Laplacian(gray_crop, cv2.CV_64F).var()
                if sharpness > acc["best_sharpness"]:
                    acc["best_sharpness"] = sharpness
                    acc["best_crop"] = crop_resized

        self.frame_count += 1

    def finalize(self):
        """Extract final results. Called once after all frames."""
        # Background std
        bg_std = 0.0
        if self.bg_n > 1 and self.bg_m2 is not None:
            variance = self.bg_m2 / (self.bg_n - 1)  # Sample variance
            bg_std = float(np.mean(np.sqrt(variance)))
            del self.bg_mean, self.bg_m2
            self.bg_mean = None
            self.bg_m2 = None

        results = []
        for i, acc in enumerate(self.embryo_accs):
            results.append(self._finalize_embryo(i, acc, bg_std))

        return results, bg_std

    def _finalize_embryo(self, idx, acc, bg_std):
        """Compute final metrics for one embryo."""
        activity_score = 0
        nsd = 0.0
        anr = 0.0

        if acc["act_n"] >= 2 and acc["act_m2"] is not None:
            # Population variance to match np.std(axis=0) behavior
            variance = acc["act_m2"] / acc["act_n"]
            pixel_std = np.sqrt(variance)
            mean_std = float(np.mean(pixel_std))
            compensated_std = max(0.0, mean_std - bg_std)
            activity_score = int(min(100, max(0, compensated_std * 100 / 15)))

            # NSD
            mean_intensity = acc["intensity_sum"] / max(acc["intensity_count"], 1)
            nsd = round(compensated_std / max(mean_intensity, 1.0), 6)
            # ANR
            anr = round(compensated_std / max(bg_std, 0.5), 3)

        # Core and periphery activity
        core_activity = 0
        if acc["core_n"] >= 2 and acc["core_m2"] is not None:
            core_var = acc["core_m2"] / acc["core_n"]
            core_raw = float(np.mean(np.sqrt(core_var)))
            core_activity = int(min(100, max(0, max(0.0, core_raw - bg_std) * 100 / 15)))

        periphery_activity = 0
        if acc["peri_n"] >= 2 and acc["peri_m2"] is not None:
            peri_var = acc["peri_m2"] / acc["peri_n"]
            peri_raw = float(np.mean(np.sqrt(peri_var)))
            periphery_activity = int(min(100, max(0, max(0.0, peri_raw - bg_std) * 100 / 15)))

        # Peak zone
        if core_activity > periphery_activity * 1.5 and core_activity > 5:
            peak_zone = "core"
        elif periphery_activity > core_activity * 1.5 and periphery_activity > 5:
            peak_zone = "periphery"
        else:
            peak_zone = "uniform"

        # Timeline (compensated)
        raw_timeline = []
        for j, emb_diff in enumerate(acc["emb_timeline"]):
            bg_diff = self.bg_timeline[j] if j < len(self.bg_timeline) else 0.0
            raw_timeline.append(max(0.0, emb_diff - bg_diff))

        timeline_norm = [int(min(100, max(0, v * 100 / 15))) for v in raw_timeline]
        temporal_variability = round(float(np.std(raw_timeline)), 2) if len(raw_timeline) > 1 else 0.0

        # Temporal pattern
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

        # Symmetry (quadrant analysis)
        cx, cy = acc["cx"], acc["cy"]
        vid_h, vid_w = self.vid_h, self.vid_w
        mask = acc["mask"]
        quads = []
        for y_sl, x_sl in [
            (slice(0, cy), slice(0, cx)),
            (slice(0, cy), slice(cx, vid_w)),
            (slice(cy, vid_h), slice(0, cx)),
            (slice(cy, vid_h), slice(cx, vid_w)),
        ]:
            q_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
            q_mask[y_sl, x_sl] = mask[y_sl, x_sl]
            quads.append(float(np.sum(self.cumulative_heat[q_mask > 0])))

        total_q = sum(quads)
        activity_symmetry = 1.0
        focal_activity_detected = False
        if total_q > 0:
            mean_q = float(np.mean(quads))
            std_q = float(np.std(quads))
            activity_symmetry = round(max(0.0, min(1.0, 1.0 - std_q / max(mean_q, 0.01))), 2)
            focal_activity_detected = max(quads) / total_q > 0.50

        kinetic_profile = {
            "core_activity": core_activity,
            "periphery_activity": periphery_activity,
            "peak_zone": peak_zone,
            "temporal_pattern": temporal_pattern,
            "activity_timeline": timeline_norm,
            "temporal_variability": temporal_variability,
            "activity_symmetry": activity_symmetry,
            "focal_activity_detected": focal_activity_detected,
        }

        # Heatmap crop
        cl, ct = acc["crop_left"], acc["crop_top"]
        cr, cb = acc["crop_right"], acc["crop_bottom"]
        heat_crop = self.cumulative_heat[ct:cb, cl:cr]
        if heat_crop.max() > 0:
            heat_norm = (heat_crop / heat_crop.max() * 255).astype(np.uint8)
        else:
            heat_norm = np.zeros_like(heat_crop, dtype=np.uint8)
        heat_colored = cv2.applyColorMap(
            cv2.resize(heat_norm, (OUTPUT_SIZE, OUTPUT_SIZE), interpolation=cv2.INTER_LANCZOS4),
            cv2.COLORMAP_JET)

        # Free heavy per-embryo arrays
        acc["act_mean"] = None
        acc["act_m2"] = None
        acc["core_mean"] = None
        acc["core_m2"] = None
        acc["peri_mean"] = None
        acc["peri_m2"] = None

        return {
            "index": idx,
            "activity_score": activity_score,
            "nsd": nsd,
            "anr": anr,
            "bg_std": bg_std,
            "kinetic_profile": kinetic_profile,
            "best_crop": acc["best_crop"],
            "heat_colored": heat_colored,
        }


# ─── Main Pipeline ───────────────────────────────────────

@app.post("/analyze")
async def analyze(req: AnalyzeRequest, request: Request = None):
    """
    Full pipeline:
    1. Download video
    2. Extract frames (40 uniform + detection frame)
    3. Detect embryos (YOLO -> OpenCV fallback)
    4. Per embryo: crops, kinetics, best frame, DINOv2, Gemini
    5. Upload to Storage
    6. Return results

    Supports two modes:
    - queue_id only: Cloud Run resolves job context from DB (new, preferred)
    - Full payload: backward compat with Edge Function (legacy)
    """
    # Auth check
    if request is not None:
        _check_api_key(request)

    # ─── Resolve job context from DB when queue_id-only ──────
    sb_url = req.supabase_url or os.environ.get("SUPABASE_URL", "")
    sb_key = req.supabase_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    gemini_key = req.gemini_api_key or os.environ.get("GEMINI_API_KEY", "")

    if not sb_url or not sb_key:
        raise HTTPException(500, "Supabase credentials not configured")

    sb = _get_supabase(sb_url, sb_key)

    # Determine effective job_id
    effective_job_id = req.queue_id or req.job_id
    if not effective_job_id:
        raise HTTPException(400, "queue_id or job_id is required")

    # If queue_id mode (no video_url), resolve everything from DB
    if req.queue_id and not req.video_url:
        try:
            # 1. Atomic claim (prevents duplicate processing across instances)
            claim_result = sb.table('embryo_analysis_queue').update({
                'status': 'processing',
                'started_at': datetime.utcnow().isoformat(),
                'error_message': None,
                'progress_message': 'Iniciando análise...',
            }).eq('id', req.queue_id).eq('status', 'pending').execute()

            if not claim_result.data:
                # Job not in 'pending' state — check why
                job_check = sb.table('embryo_analysis_queue').select(
                    'status, started_at'
                ).eq('id', req.queue_id).single().execute()
                if not job_check.data:
                    raise HTTPException(404, f"Job not found: {req.queue_id}")
                status = job_check.data['status']
                if status == 'completed':
                    return {"message": "Already completed", "queue_id": req.queue_id}
                if status == 'processing':
                    started = job_check.data.get('started_at')
                    if started:
                        elapsed = time.time() - datetime.fromisoformat(
                            started.replace('Z', '+00:00')
                        ).timestamp()
                        if elapsed < 300:
                            return {"message": "Already processing by another instance", "queue_id": req.queue_id}
                    # Stale (>5 min) — reclaim
                    logger.warning(f"Job {req.queue_id} appears stale, reclaiming...")
                    sb.table('embryo_analysis_queue').update({
                        'status': 'processing',
                        'started_at': datetime.utcnow().isoformat(),
                        'progress_message': 'Reprocessando (timeout anterior)...',
                    }).eq('id', req.queue_id).execute()
                elif status == 'failed':
                    sb.table('embryo_analysis_queue').update({
                        'status': 'processing',
                        'started_at': datetime.utcnow().isoformat(),
                        'error_message': None,
                        'progress_message': 'Reprocessando...',
                    }).eq('id', req.queue_id).execute()
                else:
                    raise HTTPException(409, f"Job in unexpected state: {status}")

            logger.info(f"Job {req.queue_id} claimed successfully")

            # 2. Read job details
            job_resp = sb.table('embryo_analysis_queue').select(
                'media_id, lote_fiv_acasalamento_id, '
                'expected_count, manual_bboxes, embryo_offset'
            ).eq('id', req.queue_id).single().execute()
            job = job_resp.data
            if not job:
                raise HTTPException(404, f"Job not found: {req.queue_id}")

            # 3. Get media path
            media_resp = sb.table('acasalamento_embrioes_media').select(
                'arquivo_path'
            ).eq('id', job['media_id']).single().execute()
            media = media_resp.data
            if not media:
                raise HTTPException(404, f"Media not found for job {req.queue_id}")

            # 4. Generate signed URL
            _update_progress(sb, req.queue_id, "Gerando URL do vídeo...")
            signed = sb.storage.from_('embryo-videos').create_signed_url(
                media['arquivo_path'], 3600
            )
            # Handle both camelCase (v1) and snake_case (v2) responses
            video_url = None
            if signed:
                video_url = signed.get('signedURL') or signed.get('signed_url') or signed.get('signedUrl')
            if not video_url:
                raise HTTPException(500, f"Failed to generate signed URL for {media['arquivo_path']}")

            # 5. Get config (prompt, model) — non-critical, use defaults on failure
            config = {}
            try:
                config_rows = sb.table('embryo_score_config').select(
                    'calibration_prompt, model_name'
                ).limit(1).execute()
                if config_rows.data and len(config_rows.data) > 0:
                    config = config_rows.data[0]
            except Exception as cfg_err:
                logger.warning(f"Could not load embryo_score_config (using defaults): {cfg_err}")

            # 6. Get Gemini API key from secrets table (fallback to env var) — non-critical
            try:
                secret_rows = sb.table('embryo_score_secrets').select(
                    'gemini_api_key'
                ).limit(1).execute()
                if secret_rows.data and len(secret_rows.data) > 0:
                    key_val = secret_rows.data[0].get('gemini_api_key')
                    if key_val:
                        gemini_key = key_val
            except Exception as sec_err:
                logger.warning(f"Could not load embryo_score_secrets (using env var): {sec_err}")

            # Populate req fields for the rest of the pipeline
            req.video_url = video_url
            req.job_id = req.queue_id
            req.expected_count = job.get('expected_count') or 0
            # Fallback: if expected_count is 0, count embryos linked to this job
            if req.expected_count == 0:
                try:
                    ec_resp = sb.table('embrioes').select('id', count='exact', head=True).eq(
                        'queue_id', req.queue_id
                    ).execute()
                    if ec_resp.count and ec_resp.count > 0:
                        req.expected_count = ec_resp.count
                        logger.info(f"expected_count fallback from DB: {req.expected_count}")
                except Exception as ec_err:
                    logger.warning(f"expected_count fallback query failed: {ec_err}")
            req.bboxes = job.get('manual_bboxes') or None
            req.gemini_api_key = gemini_key
            req.supabase_url = sb_url
            req.supabase_key = sb_key
            req.prompt = config.get('calibration_prompt')
            req.model_name = config.get('model_name') or 'gemini-2.5-flash'
            req.lote_fiv_acasalamento_id = job['lote_fiv_acasalamento_id']
            req.media_id = job['media_id']
            req.embryo_offset = job.get('embryo_offset') or 0

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to resolve job context for {req.queue_id}: {e}")
            sb.table('embryo_analysis_queue').update({
                'status': 'failed',
                'error_message': f'Job context resolution failed: {str(e)[:500]}',
                'progress_message': None,
                'completed_at': datetime.utcnow().isoformat(),
            }).eq('id', req.queue_id).execute()
            raise HTTPException(500, f"Failed to resolve job: {str(e)[:200]}")

    if not req.video_url:
        raise HTTPException(400, "video_url is required (or use queue_id mode)")
    if not gemini_key:
        raise HTTPException(500, "Gemini API key not configured")

    _ensure_onnx()
    _ensure_gemini(gemini_key)

    # Re-resolve sb in case credentials changed
    sb = _get_supabase(sb_url, sb_key)
    job_dir = f"analysis/{effective_job_id}"

    # Global try/except: any crash marks job as failed with useful message
    tmp_path = None
    try:
        # 1. Download video
        _update_progress(sb, effective_job_id, "Baixando vídeo...")
        tmp_path = _download_video(req.video_url)

        _update_progress(sb, effective_job_id, "Extraindo frames...")
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(422, "Could not open video")

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if total_frames <= 0:
            cap.release()
            raise HTTPException(422, "Video has no frames")

        # Downscale factor for memory safety (720p max, 1920px wide max)
        if orig_h > MAX_FRAME_HEIGHT or orig_w > MAX_WIDTH:
            scale = min(MAX_FRAME_HEIGHT / orig_h, MAX_WIDTH / orig_w)
            vid_w = int(orig_w * scale)
            vid_h = int(orig_h * scale)
            logger.info(f"Downscaling {orig_w}x{orig_h} → {vid_w}x{vid_h} (scale={scale:.2f})")
        else:
            vid_w, vid_h = orig_w, orig_h
            scale = 1.0

        # 2. PASS 1 — Detection (single frame from middle)
        _update_progress(sb, effective_job_id, "Detectando embriões...")
        det_frame_idx = total_frames // 2
        cap.set(cv2.CAP_PROP_POS_FRAMES, det_frame_idx)
        ret, det_frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, det_frame = cap.read()
        if not ret:
            cap.release()
            raise HTTPException(422, "Could not read detection frame")
        if scale < 1.0:
            det_frame = cv2.resize(det_frame, (vid_w, vid_h), interpolation=cv2.INTER_AREA)

        # Detect embryos (use biologist-provided bboxes if available)
        if req.bboxes:
            bboxes = req.bboxes
            logger.info(f"Using {len(bboxes)} biologist-provided bboxes (skipping OpenCV)")
        else:
            bboxes = _detect_embryos(det_frame, req.expected_count)
            logger.info(f"OpenCV detected {len(bboxes)} embryos")
        _update_progress(sb, effective_job_id, f"Detectados {len(bboxes)} embrião(ões)")

        # Upload plate frame
        plate_success, plate_buf = cv2.imencode('.jpg', det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if plate_success:
            _upload_to_storage(sb, f"{job_dir}/plate_frame.jpg", plate_buf.tobytes())

        if not bboxes:
            cap.release()
            return {
                "plate_frame_path": f"{job_dir}/plate_frame.jpg",
                "bboxes": [],
                "embryos": [],
            }

        del det_frame  # Free detection frame

        # 3. PASS 2 — Streaming analysis (O(1) memory per frame)
        _update_progress(sb, effective_job_id, "Analisando cinética...")
        sample_interval = max(1, round(video_fps / KINETIC_FPS))
        sampled_indices = list(range(0, total_frames, sample_interval))
        if len(sampled_indices) > MAX_SAMPLED_FRAMES:
            step = len(sampled_indices) / MAX_SAMPLED_FRAMES
            sampled_indices = [sampled_indices[int(i * step)] for i in range(MAX_SAMPLED_FRAMES)]

        gap = max(1, int(KINETIC_FPS))
        accumulator = _StreamingAccumulator(bboxes, vid_w, vid_h, KINETIC_FPS, gap)

        for idx in sampled_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
            if scale < 1.0:
                frame = cv2.resize(frame, (vid_w, vid_h), interpolation=cv2.INTER_AREA)
            accumulator.process_frame(frame)
            # frame is discarded on next iteration — O(1) memory

        cap.release()
        logger.info(f"Streamed {accumulator.frame_count} frames at {vid_w}x{vid_h}")

        if accumulator.frame_count < 2:
            del accumulator
            raise HTTPException(422, "Too few frames extracted")

        embryo_data, bg_std = accumulator.finalize()
        del accumulator
        gc.collect()

        # 4. Per-embryo processing (encode, upload, DINOv2) with error isolation
        start_time = time.time()
        _update_progress(sb, effective_job_id, "Processando embriões...")

        # Batch DINOv2 embeddings (1 call instead of N)
        valid_crops = [(i, e["best_crop"]) for i, e in enumerate(embryo_data) if e.get("best_crop") is not None]
        if valid_crops:
            batch_embeddings = _get_embeddings_batch([c for _, c in valid_crops])
            for j, (orig_idx, _) in enumerate(valid_crops):
                embryo_data[orig_idx]["embedding"] = batch_embeddings[j]

        # Encode and upload per embryo
        embryo_results = []
        for emb in embryo_data:
            try:
                best_crop = emb.get("best_crop")
                heat_colored = emb.get("heat_colored")

                if best_crop is None:
                    logger.warning(f"Embryo {emb['index']}: no crop available, skipping")
                    continue

                success, crop_buf = cv2.imencode('.jpg', best_crop, [cv2.IMWRITE_JPEG_QUALITY, 90])
                if not success:
                    raise ValueError("Failed to encode crop JPEG")
                crop_jpg = crop_buf.tobytes()

                success, motion_buf = cv2.imencode('.jpg', heat_colored, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if not success:
                    raise ValueError("Failed to encode motion JPEG")
                motion_jpg = motion_buf.tobytes()

                emb_dir = f"{job_dir}/embryo_{emb['index']}"
                _upload_to_storage(sb, f"{emb_dir}/crop.jpg", crop_jpg)
                _upload_to_storage(sb, f"{emb_dir}/motion.jpg", motion_jpg)

                result = {
                    "index": emb["index"],
                    "bbox": bboxes[emb["index"]],
                    "crop_image_path": f"{emb_dir}/crop.jpg",
                    "motion_map_path": f"{emb_dir}/motion.jpg",
                    "activity_score": emb["activity_score"],
                    "nsd": emb["nsd"],
                    "anr": emb["anr"],
                    "bg_std": emb["bg_std"],
                    "kinetic_profile": emb["kinetic_profile"],
                    "embedding": emb.get("embedding", [0.0] * 384),
                    "_crop_jpg": crop_jpg,
                    "_motion_jpg": motion_jpg,
                }
                embryo_results.append(result)

            except Exception as e:
                logger.error(f"Embryo {emb['index']} processing failed: {e}")
                continue

        # Free intermediate data
        del embryo_data
        gc.collect()
        logger.info(f"Processed {len(embryo_results)}/{len(bboxes)} embryos successfully")

        # 5. Gemini (max_workers=1 to prevent rate limiting)
        if time.time() - start_time > 250:
            logger.warning("Approaching 300s timeout, skipping Gemini phase")
            for r in embryo_results:
                r.pop("_crop_jpg", None)
                r.pop("_motion_jpg", None)
                r["gemini_analysis"] = {
                    "classification": "Pending",
                    "reasoning": "Timeout — reprocesse quando possível",
                    "confidence": "low",
                }
        else:
            _update_progress(sb, effective_job_id, f"Classificando {len(embryo_results)} embrião(ões) com IA...")
            if embryo_results:
                with ThreadPoolExecutor(max_workers=1) as pool:
                    gemini_futures = {
                        pool.submit(
                            _call_gemini_with_retry,
                            embryo_results[i].pop("_crop_jpg"),
                            embryo_results[i].pop("_motion_jpg"),
                            req.gemini_api_key, req.prompt, req.model_name,
                            embryo_results[i]["activity_score"],
                            embryo_results[i]["kinetic_profile"],
                            embryo_results[i]["nsd"],
                            embryo_results[i]["anr"],
                        ): i
                        for i in range(len(embryo_results))
                    }
                    futures_wait(list(gemini_futures.keys()))
                    for future in gemini_futures:
                        idx = gemini_futures[future]
                        try:
                            embryo_results[idx]["gemini_analysis"] = future.result()
                        except Exception as e:
                            logger.error(f"Gemini failed for embryo {idx}: {e}")
                            embryo_results[idx]["gemini_analysis"] = {
                                "classification": "Error",
                                "reasoning": str(e)[:200],
                                "confidence": "low",
                            }

        # ─── 6. Save scores directly to DB ─────────────────
        _update_progress(sb, effective_job_id, "Salvando resultados...")
        if req.lote_fiv_acasalamento_id and req.media_id:
            try:
                _save_scores_to_db(sb, req, embryo_results, bboxes, job_dir)
            except Exception as e:
                logger.error(f"Failed to save scores to DB: {e}")
                # Update queue with error but don't fail the response
                try:
                    sb.table('embryo_analysis_queue').update({
                        'status': 'failed',
                        'error_log': f'Score save failed: {str(e)[:500]}',
                        'completed_at': datetime.utcnow().isoformat(),
                    }).eq('id', req.job_id).execute()
                except Exception as db_err:
                    logger.error(f"CRITICAL: Could not update queue status to failed: {db_err}")

        _update_progress(sb, effective_job_id, None)  # Clear progress on success
        return {
            "plate_frame_path": f"{job_dir}/plate_frame.jpg",
            "bboxes": bboxes,
            "embryos": embryo_results,
        }

    except HTTPException:
        raise  # Let FastAPI handle HTTP errors normally
    except Exception as e:
        # Global catch: any unhandled crash marks job as failed with useful message
        logger.error(f"Pipeline crashed for job {effective_job_id}: {e}", exc_info=True)
        try:
            sb.table('embryo_analysis_queue').update({
                'status': 'failed',
                'error_message': f'Pipeline crash: {str(e)[:500]}',
                'progress_message': None,
                'completed_at': datetime.utcnow().isoformat(),
            }).eq('id', effective_job_id).execute()
        except Exception:
            pass
        raise HTTPException(500, f"Pipeline error: {str(e)[:200]}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


# ═══════════════════════════════════════════════════════════
# OCR — Report digitization via Gemini 2.0 Flash Vision
# ═══════════════════════════════════════════════════════════

class OcrRequest(BaseModel):
    image_base64: str
    mime_type: str = "image/jpeg"
    report_type: str  # dg, sexagem, p2, aspiracao, te, p1
    fazenda_id: str


# ─── OCR Prompt builder ──────────────────────────────────

def _build_ocr_prompt(
    report_type: str,
    animals: list[dict],
    corrections: list[dict],
) -> str:
    animal_list = ""
    if animals:
        lines = [f"- {a['registro']}" + (f" ({a['nome']})" if a.get("nome") else "")
                 for a in animals[:500]]
        animal_list = (
            "\nANIMAIS CONHECIDOS desta fazenda (use para desambiguar registros escritos à mão):\n"
            + "\n".join(lines) + "\n"
        )

    correction_list = ""
    if corrections:
        lines = [f'- "{c["raw_value"]}" na verdade era "{c["corrected_value"]}" (campo: {c["field_type"]})'
                 for c in corrections[:20]]
        correction_list = (
            "\nCORREÇÕES ANTERIORES (a IA errou antes, aprenda com isso):\n"
            + "\n".join(lines) + "\n"
        )

    result_instructions = {
        "dg": 'Coluna RESULTADO: P = Prenhe, V = Vazia, R = Retoque. Retorne como "P", "V" ou "R".',
        "sexagem": 'Coluna RESULTADO: F = Fêmea, M = Macho, S = Sem sexo, D = Dois sexos, V = Vazia. Retorne a letra.',
        "p2": 'Coluna RESULTADO: ✓ ou check = Apta, X = Perda. Retorne "APTA" ou "PERDA".',
        "te": 'Coluna RESULTADO: código do embrião transferido (texto livre, ex: "EMB-001").',
        "aspiracao": (
            "Este é um relatório de ASPIRAÇÃO FOLICULAR.\n"
            "Cada LINHA do relatório representa UMA doadora e possui EXATAMENTE 6 campos numéricos nesta ordem:\n"
            "  1) ATR (Atrésicos)  2) DEG (Degenerados)  3) EXP (Expandidos)\n"
            "  4) DES (Desnudos)   5) VIA (Viáveis)      6) T (Total)\n"
            "REGRAS CRÍTICAS:\n"
            "- Leia cada linha de forma INDEPENDENTE. Nunca use dados de uma linha para preencher outra.\n"
            "- Cada linha DEVE ter todos os 6 campos numéricos. Se não conseguir ler um número, retorne 0 com confidence 0.\n"
            "- NUNCA pule um campo. Se uma célula parece vazia, retorne 0.\n"
            "- O Total (T) DEVE ser igual à soma ATR+DEG+EXP+DES+VIA. Se o valor escrito não bater com a soma, "
            "confie na soma dos campos individuais e ajuste o total.\n"
            "- Não confunda a linha de TOTAIS GERAIS (última linha, soma de todas as doadoras) com uma doadora individual."
        ),
        "p1": 'Coluna RESULTADO: geralmente vazio no P1 (1º passo). Foque em extrair REGISTRO e RAÇA corretamente.',
    }

    return f"""Você é um sistema de OCR especializado em relatórios de campo de reprodução bovina (FIV).

TAREFA: Extrair dados de uma foto de relatório preenchido à mão.

TIPO DE RELATÓRIO: {report_type.upper()}
{result_instructions.get(report_type, '')}
{animal_list}{correction_list}
INSTRUÇÕES DE OCR:
- Escrita à mão pode ser difícil de ler. Faça seu melhor esforço.
- Registros de animais são códigos como "REC-0235", "DOA-001", etc.
- Se houver ambiguidade, use a lista de animais conhecidos para desambiguar.
- Confidence: 0-100 (100 = certeza absoluta, 0 = chute).
- Se não conseguir ler um campo, retorne string vazia com confidence 0.
- Números de linha (coluna Nº) indicam a ordem.
- Ignore linhas completamente vazias.

RETORNE JSON no formato especificado no response_schema."""


# ─── OCR Gemini response schemas ─────────────────────────

def _get_ocr_response_schema(report_type: str) -> dict:
    field_schema = lambda t="STRING": {
        "type": "OBJECT",
        "properties": {
            "value": {"type": t},
            "confidence": {"type": "INTEGER"},
        },
        "required": ["value", "confidence"],
    }

    header_schema = {
        "type": "OBJECT",
        "properties": {
            "fazenda": field_schema(),
            "data": field_schema(),
            "veterinario": field_schema(),
            "tecnico": field_schema(),
        },
        "required": ["fazenda", "data", "veterinario", "tecnico"],
    }

    if report_type == "aspiracao":
        return {
            "type": "OBJECT",
            "properties": {
                "header": header_schema,
                "rows": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "numero": {"type": "INTEGER"},
                            "registro": field_schema(),
                            "raca": field_schema(),
                            "atresicos": field_schema("INTEGER"),
                            "degenerados": field_schema("INTEGER"),
                            "expandidos": field_schema("INTEGER"),
                            "desnudos": field_schema("INTEGER"),
                            "viaveis": field_schema("INTEGER"),
                            "total": field_schema("INTEGER"),
                        },
                        "required": ["numero", "registro", "raca", "atresicos",
                                     "degenerados", "expandidos", "desnudos", "viaveis", "total"],
                    },
                },
                "pagina": {"type": "STRING"},
            },
            "required": ["header", "rows"],
        }

    # Universal schema (DG, Sexagem, P1, P2, TE)
    header_schema["properties"]["servico_detectado"] = {
        "type": "STRING",
        "description": "Tipo de serviço detectado pelo checkbox marcado: p1, p2, te, dg, sexagem",
    }
    return {
        "type": "OBJECT",
        "properties": {
            "header": header_schema,
            "rows": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "numero": {"type": "INTEGER"},
                        "registro": field_schema(),
                        "raca": field_schema(),
                        "resultado": field_schema(),
                        "obs": field_schema(),
                    },
                    "required": ["numero", "registro", "raca", "resultado", "obs"],
                },
            },
            "pagina": {"type": "STRING"},
        },
        "required": ["header", "rows"],
    }


# ─── Fuzzy match (ported from matchRegistro.ts) ──────────

def _normalize_registro(value: str) -> str:
    return re.sub(r'\s+', '', value.upper().strip())


def _split_registro(reg: str) -> tuple[str, str, int]:
    """Returns (prefix, number_str, numeric_value)."""
    normalized = _normalize_registro(reg)
    m = re.match(r'^([A-Z\-_]*?)(\d+)$', normalized)
    if m:
        return m.group(1), m.group(2), int(m.group(2))
    return normalized, '', -1


def _levenshtein(a: str, b: str) -> int:
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            dp[i][j] = (dp[i - 1][j - 1] if a[i - 1] == b[j - 1]
                        else 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]))
    return dp[m][n]


def _fuzzy_match_registro(ocr_value: str, animals: list[dict]) -> dict:
    """Match one OCR registro against animal list. Returns match result."""
    if not ocr_value or not animals:
        return {"matched": False, "db_id": None, "db_registro": None, "confidence": 0}

    normalized_ocr = _normalize_registro(ocr_value)
    ocr_prefix, ocr_num_str, ocr_num = _split_registro(ocr_value)

    best = {"matched": False, "db_id": None, "db_registro": None, "db_nome": None, "confidence": 0}

    for animal in animals:
        normalized_db = _normalize_registro(animal["registro"])
        db_prefix, db_num_str, db_num = _split_registro(animal["registro"])

        confidence = 0

        # 1. Exact match
        if normalized_ocr == normalized_db:
            return {
                "matched": True,
                "db_id": animal["id"],
                "db_registro": animal["registro"],
                "db_nome": animal.get("nome"),
                "confidence": 100,
            }

        # 2. Same prefix + close number
        if (ocr_prefix and db_prefix and ocr_prefix == db_prefix
                and ocr_num >= 0 and db_num >= 0):
            num_diff = abs(ocr_num - db_num)
            if num_diff == 0:
                confidence = 98
            elif num_diff <= 1:
                confidence = 88
            elif num_diff <= 5:
                confidence = 75
            elif num_diff <= 10:
                confidence = 60

        # 3. No prefix in OCR but number matches
        if (confidence < 70 and ocr_num >= 0 and db_num >= 0
                and not ocr_prefix and db_prefix):
            num_diff = abs(ocr_num - db_num)
            if num_diff == 0:
                confidence = max(confidence, 70)
            elif num_diff <= 2:
                confidence = max(confidence, 55)

        # 4. Levenshtein fallback
        if confidence < 50:
            lev = _levenshtein(normalized_ocr, normalized_db)
            max_len = max(len(normalized_ocr), len(normalized_db))
            if max_len > 0:
                lev_conf = max(0, round((1 - lev / max_len) * 100))
                if lev_conf > confidence and lev <= 2:
                    confidence = min(lev_conf, 60)

        if confidence > best["confidence"]:
            best = {
                "matched": confidence >= 60,
                "db_id": animal["id"],
                "db_registro": animal["registro"],
                "db_nome": animal.get("nome"),
                "confidence": confidence,
            }

    return best


# ─── Normalize resultado (ported from postProcess.ts) ─────

DG_RESULT_MAP = {
    "P": "PRENHE", "PRENHE": "PRENHE", "PR": "PRENHE",
    "V": "VAZIA", "VAZIA": "VAZIA", "VA": "VAZIA",
    "R": "RETOQUE", "RETOQUE": "RETOQUE", "RET": "RETOQUE",
}

SEXAGEM_RESULT_MAP = {
    "F": "PRENHE_FEMEA", "FEMEA": "PRENHE_FEMEA", "FÊMEA": "PRENHE_FEMEA",
    "M": "PRENHE_MACHO", "MACHO": "PRENHE_MACHO",
    "S": "PRENHE_SEM_SEXO", "SEM SEXO": "PRENHE_SEM_SEXO",
    "D": "PRENHE_2_SEXOS", "DOIS SEXOS": "PRENHE_2_SEXOS", "2 SEXOS": "PRENHE_2_SEXOS",
    "V": "VAZIA", "VAZIA": "VAZIA",
}

P2_RESULT_MAP = {
    "✓": "APTA", "CHECK": "APTA", "OK": "APTA", "APTA": "APTA",
    "X": "PERDA", "PERDA": "PERDA", "PERDEU": "PERDA",
}


def _normalize_resultado(value: str, report_type: str) -> tuple[str, bool]:
    """Returns (normalized, is_valid)."""
    upper = value.upper().strip()
    maps = {"dg": DG_RESULT_MAP, "sexagem": SEXAGEM_RESULT_MAP, "p2": P2_RESULT_MAP}
    m = maps.get(report_type)
    if not m:
        return upper, True
    normalized = m.get(upper)
    return (normalized, True) if normalized else (upper, False)


# ─── Post-process OCR result (server-side) ────────────────

def _post_process_ocr(raw_data: dict, animals: list[dict],
                      corrections: list[dict], report_type: str) -> dict:
    """Full server-side post-processing: corrections → fuzzy match → normalize → filter."""
    rows = raw_data.get("rows", [])
    is_aspiracao = report_type == "aspiracao"

    # Build correction map
    correction_map: dict[str, str] = {}
    for c in corrections:
        key = f"{c['field_type']}::{c['raw_value'].upper().strip()}"
        correction_map[key] = c["corrected_value"]

    processed_rows = []
    for row in rows:
        # ── Apply corrections ──
        reg = row.get("registro", {})
        reg_val = reg.get("value", "")
        reg_conf = reg.get("confidence", 0)

        reg_key = f"registro::{reg_val.upper().strip()}"
        if reg_key in correction_map:
            reg_val = correction_map[reg_key]
            reg_conf = min(reg_conf + 15, 95)

        raca = row.get("raca", {})
        raca_val = raca.get("value", "")
        raca_conf = raca.get("confidence", 0)

        raca_key = f"raca::{raca_val.upper().strip()}"
        if raca_key in correction_map:
            raca_val = correction_map[raca_key]
            raca_conf = min(raca_conf + 15, 95)

        # ── Fuzzy match registro ──
        match = _fuzzy_match_registro(reg_val, animals)
        matched_db = match["matched"]
        matched_value = match["db_registro"]
        if matched_db:
            reg_conf = max(reg_conf, match["confidence"])
        else:
            reg_conf = min(reg_conf, 40)

        reg_out = {
            "value": reg_val,
            "confidence": reg_conf,
            "matched_db": matched_db,
            "matched_value": matched_value,
        }

        raca_out = {"value": raca_val, "confidence": raca_conf}

        if is_aspiracao:
            # Aspiração: numeric fields with total validation
            proc_row = {
                "numero": row.get("numero", 0),
                "registro": reg_out,
                "raca": raca_out,
            }
            sum_fields = ["atresicos", "degenerados", "expandidos", "desnudos", "viaveis"]
            for field in sum_fields + ["total"]:
                f = row.get(field, {})
                proc_row[field] = {"value": f.get("value", 0), "confidence": f.get("confidence", 0)}

            # Validate: total must equal sum of parts
            computed_sum = sum(proc_row[f]["value"] for f in sum_fields)
            reported_total = proc_row["total"]["value"]
            if computed_sum > 0 and reported_total != computed_sum:
                proc_row["total"] = {"value": computed_sum, "confidence": 70}

            # Skip rows with empty registro and all zeros
            if not reg_val and all(proc_row[f]["value"] == 0 for f in sum_fields):
                continue
            processed_rows.append(proc_row)
        else:
            # Universal: normalize resultado
            res = row.get("resultado", {})
            res_val = res.get("value", "")
            res_conf = res.get("confidence", 0)

            res_key = f"resultado::{res_val.upper().strip()}"
            if res_key in correction_map:
                original_res = res_val
                res_val = correction_map[res_key]
                res_conf = min(res_conf + 15, 95)

            if res_val:
                normalized, valid = _normalize_resultado(res_val, report_type)
                res_val = normalized
                res_conf = max(res_conf, 90) if valid else min(res_conf, 30)

            obs = row.get("obs", {})
            obs_val = obs.get("value", "")
            obs_conf = obs.get("confidence", 0)

            # Skip empty rows
            if not reg_val and not res_val:
                continue

            processed_rows.append({
                "numero": row.get("numero", 0),
                "registro": reg_out,
                "raca": raca_out,
                "resultado": {"value": res_val, "confidence": res_conf},
                "obs": {"value": obs_val, "confidence": obs_conf},
            })

    return {
        "header": raw_data.get("header", {}),
        "rows": processed_rows,
        "metadata": {
            "pagina": raw_data.get("pagina", ""),
            "total_rows": len(processed_rows),
        },
    }


# ─── OCR Endpoint ─────────────────────────────────────────

@app.post("/ocr")
async def ocr_endpoint(req: OcrRequest):
    """OCR de relatórios de campo via Gemini 2.0 Flash Vision.
    Receives compressed base64 image, returns processed JSON ready for review grid.
    """
    valid_types = ["p1", "p2", "te", "dg", "sexagem", "aspiracao"]
    if req.report_type not in valid_types:
        raise HTTPException(400, f"report_type inválido: {req.report_type}")

    # Get env-based credentials (OCR uses dedicated key, separate from EmbryoScore)
    gemini_api_key = os.environ.get("GEMINI_OCR_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not gemini_api_key:
        raise HTTPException(500, "GEMINI_OCR_API_KEY / GEMINI_API_KEY not configured")
    if not supabase_url or not supabase_key:
        raise HTTPException(500, "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not configured")

    sb = _get_supabase(supabase_url, supabase_key)

    # 1. Fetch animals for this fazenda
    is_receptora = req.report_type in ("dg", "sexagem", "p1", "p2", "te")
    if is_receptora:
        resp = sb.table("receptoras").select("id, identificacao, nome") \
            .eq("fazenda_atual_id", req.fazenda_id).limit(500).execute()
        # Normalize key: identificacao -> registro for uniform downstream processing
        animals = [
            {"id": a["id"], "registro": a.get("identificacao") or "", "nome": a.get("nome")}
            for a in (resp.data or [])
        ]
    else:
        resp = sb.table("doadoras").select("id, registro, nome") \
            .eq("fazenda_id", req.fazenda_id).limit(500).execute()
        animals = resp.data or []
    logger.info(f"[OCR] Loaded {len(animals)} animals for fazenda {req.fazenda_id}")

    # 2. Fetch recent corrections
    corrections = []
    try:
        resp = sb.table("ocr_corrections") \
            .select("raw_value, corrected_value, field_type") \
            .eq("fazenda_id", req.fazenda_id) \
            .eq("report_type", req.report_type) \
            .order("created_at", desc=True) \
            .limit(20).execute()
        corrections = resp.data or []
    except Exception as e:
        logger.warning(f"[OCR] ocr_corrections not accessible: {e}")

    # 3. Build prompt
    prompt = _build_ocr_prompt(req.report_type, animals, corrections)

    # 4. Call Gemini 3 Flash Vision
    model_name = "gemini-3-flash-preview"
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_api_key}"

    gemini_payload = {
        "system_instruction": {"parts": [{"text": prompt}]},
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": req.mime_type, "data": req.image_base64}},
                {"text": "Extraia todos os dados desta foto de relatório de campo. Retorne no formato JSON especificado."},
            ],
        }],
        "generation_config": {
            "temperature": 0.1,
            "max_output_tokens": 8192,
            "response_mime_type": "application/json",
            "response_schema": _get_ocr_response_schema(req.report_type),
        },
    }

    try:
        gemini_resp = http_requests.post(gemini_url, json=gemini_payload, timeout=45)
    except http_requests.exceptions.Timeout:
        raise HTTPException(504, "Gemini timeout (45s)")

    if not gemini_resp.ok:
        raise HTTPException(502, f"Gemini API error ({gemini_resp.status_code}): {gemini_resp.text[:500]}")

    gemini_data = gemini_resp.json()
    candidate = (gemini_data.get("candidates") or [{}])[0]
    raw_text = (candidate.get("content", {}).get("parts") or [{}])[0].get("text", "")
    finish_reason = candidate.get("finishReason", "UNKNOWN")

    logger.info(f"[OCR] finishReason={finish_reason}, rawLen={len(raw_text)}")

    if not raw_text:
        raise HTTPException(502, f"Gemini empty response (finishReason: {finish_reason})")

    try:
        raw_data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(502, f"Gemini JSON parse error: {raw_text[:200]}")

    # 5. Post-process server-side (fuzzy match + normalize + filter)
    processed = _post_process_ocr(raw_data, animals, corrections, req.report_type)

    return {
        "success": True,
        "data": processed,
        "metadata": {
            "model": model_name,
            "finish_reason": finish_reason,
            "animals_loaded": len(animals),
            "corrections_loaded": len(corrections),
        },
    }


# ─── Retrocompat Endpoints ───────────────────────────────

@app.post("/detect-and-crop")
async def detect_and_crop(request_data: dict = {}):
    """Retrocompat endpoint — same interface as frame-extractor."""
    from starlette.requests import Request
    video_url = request_data.get("video_url")
    expected_count = request_data.get("expected_count", 0)
    frame_count = request_data.get("frame_count", 40)
    padding = request_data.get("padding", 0.18)

    if not video_url:
        raise HTTPException(400, "video_url is required")

    tmp_path = _download_video(video_url)
    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(422, "Could not open video")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            cap.release()
            raise HTTPException(422, "Video has no frames")

        # Detection frame
        det_idx = total_frames // 2
        cap.set(cv2.CAP_PROP_POS_FRAMES, det_idx)
        ret, det_frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, det_frame = cap.read()
        if not ret:
            cap.release()
            raise HTTPException(422, "Could not read frame")

        _, plate_jpg = cv2.imencode(".jpg", det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        plate_b64 = base64.b64encode(plate_jpg.tobytes()).decode("ascii")

        bboxes = _detect_embryos_opencv(det_frame, expected_count)
        if not bboxes:
            cap.release()
            return {"bboxes": [], "embryos": {}, "plate_frame_b64": plate_b64,
                    "frames_extracted": 0, "detection_method": "opencv"}

        h_frame, w_frame = det_frame.shape[:2]
        step = max(1, total_frames // frame_count)
        embryo_crops = {str(i): [] for i in range(len(bboxes))}
        extracted = 0

        cap.set(cv2.CAP_PROP_POS_FRAMES, min(5, total_frames - 1))
        frame_idx = 0

        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                fh, fw = frame.shape[:2]
                for emb_idx, bbox in enumerate(bboxes):
                    crop = _extract_crop_from_frame(frame, bbox, fw, fh, padding, OUTPUT_SIZE)
                    if crop is not None:
                        _, crop_jpg = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
                        embryo_crops[str(emb_idx)].append(
                            base64.b64encode(crop_jpg.tobytes()).decode("ascii"))
                extracted += 1
            frame_idx += 1

        cap.release()

        det_conf = "high" if len(bboxes) == expected_count else (
            "low" if len(bboxes) < expected_count else "medium")

        return {
            "bboxes": bboxes,
            "embryos": embryo_crops,
            "plate_frame_b64": plate_b64,
            "frames_extracted": extracted,
            "detection_method": "opencv",
            "detection_confidence": det_conf,
        }

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/analyze-activity")
async def analyze_activity(request_data: dict = {}):
    """Retrocompat endpoint — same interface as frame-extractor."""
    video_url = request_data.get("video_url")
    bboxes = request_data.get("bboxes", [])
    fps = request_data.get("fps", 8)
    num_key_frames = request_data.get("num_key_frames", 10)
    output_size = request_data.get("output_size", 400)
    overlay_opacity = request_data.get("overlay_opacity", 0.4)
    skip_composites = request_data.get("skip_composites", False)

    if not video_url:
        raise HTTPException(400, "video_url is required")
    if not bboxes:
        raise HTTPException(400, "bboxes is required")

    tmp_path = _download_video(video_url)
    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(422, "Could not open video")

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if total_frames <= 0 or vid_w <= 0:
            cap.release()
            raise HTTPException(422, "Invalid video")

        sample_interval = max(1, round(video_fps / fps))
        sampled_indices = list(range(0, total_frames, sample_interval))

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
            raise HTTPException(422, "Too few frames")

        bg_std, bg_timeline, wide_diffs = _compute_background_noise(
            gray_frames, bboxes, vid_w, vid_h, fps)

        embryo_results = []
        activity_scores = []

        for bbox_idx, bbox in enumerate(bboxes):
            result = _compute_kinetics_for_bbox(
                bbox_idx, bbox, gray_frames, color_frames, wide_diffs,
                bg_std, bg_timeline, vid_w, vid_h, fps,
                num_key_frames, output_size, overlay_opacity, skip_composites,
            )
            embryo_results.append(result)
            activity_scores.append(result["activity_score"])

        return {
            "activity_scores": activity_scores,
            "embryos": embryo_results,
            "frames_sampled": len(gray_frames),
        }

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ═══════════════════════════════════════════════════════════
# DETECTION
# ═══════════════════════════════════════════════════════════

def _refine_radius(
    gray: np.ndarray, blurred: np.ndarray,
    cx: float, cy: float, initial_radius: float,
    bg_intensity: float, frame_w: int, frame_h: int,
) -> float:
    """Expand radius outward from detected center until hitting background.

    For large embryos, adaptive thresholding may only capture internal
    structures, giving a radius that is too small. This function samples
    mean intensity in concentric rings expanding from the detected center.
    When the ring intensity reaches close to bg_intensity, we've passed
    the embryo edge.
    """
    icx, icy = int(cx), int(cy)
    # Don't expand beyond what fits in the frame
    max_r = int(min(icx, icy, frame_w - icx, frame_h - icy, frame_w * 0.45))
    if max_r <= initial_radius:
        return initial_radius

    step = max(2, int(initial_radius * 0.08))
    # Threshold: when ring mean is >= 88% of background, we've left the embryo
    edge_threshold = bg_intensity * 0.88

    best_r = initial_radius
    for r in range(int(initial_radius), max_r, step):
        # Sample a thin ring at radius r (thickness = step)
        ring_outer = np.zeros(gray.shape[:2], dtype=np.uint8)
        ring_inner = np.zeros(gray.shape[:2], dtype=np.uint8)
        cv2.circle(ring_outer, (icx, icy), r + step, 255, -1)
        cv2.circle(ring_inner, (icx, icy), r, 255, -1)
        ring_mask = cv2.subtract(ring_outer, ring_inner)
        pixels = blurred[ring_mask > 0]
        if len(pixels) < 10:
            break
        ring_mean = float(np.mean(pixels))
        if ring_mean >= edge_threshold:
            # Found the edge — use this radius
            best_r = float(r)
            break
        best_r = float(r)

    return best_r

def _detect_embryos(frame: np.ndarray, expected_count: int) -> list[dict]:
    """Detect embryos using OpenCV multi-pass adaptive detection."""
    bboxes = _detect_embryos_opencv(frame, expected_count)
    logger.info(f"OpenCV detected {len(bboxes)} embryos (expected {expected_count})")
    return bboxes


def _detect_embryos_opencv(frame: np.ndarray, expected_count: int = 0) -> list[dict]:
    """
    Pure OpenCV embryo detection — adaptive multi-pass.
    When expected_count is provided and first pass finds fewer,
    retries with progressively relaxed parameters.
    """
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Preprocessing
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (0, 0), sigmaX=max(3, w // 300))
    # 90th percentile = true background even when large embryos dominate the frame
    # (embryos are darker than background in brightfield microscopy)
    bg_intensity = float(np.percentile(blurred, 90))

    min_radius = int(w * 0.015)
    max_radius = int(w * 0.45)
    min_area = 3.14159 * min_radius * min_radius
    max_area = 3.14159 * max_radius * max_radius

    # Multi-pass detection: each pass relaxes parameters progressively
    pass_configs = [
        {"circ_thresh": 0.35, "darkness_contour": 0.99, "darkness_hough": 0.92, "hough_param2": 25, "label": "strict"},
        {"circ_thresh": 0.25, "darkness_contour": 1.05, "darkness_hough": 0.97, "hough_param2": 20, "label": "relaxed"},
        {"circ_thresh": 0.18, "darkness_contour": 1.10, "darkness_hough": 1.02, "hough_param2": 15, "label": "loose"},
        {"circ_thresh": 0.12, "darkness_contour": 1.20, "darkness_hough": 1.10, "hough_param2": 10, "label": "aggressive"},
    ]

    best_merged = []

    for pass_cfg in pass_configs:
        # Adaptive threshold
        block_size = max(31, (min(w, h) // 10) | 1)
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, block_size, 10)

        # Morphological cleanup
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(5, w // 200), max(5, w // 200)))
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, w // 400), max(3, w // 400)))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_close)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel_open)

        # Contour detection
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area or area > max_area:
                continue
            perimeter = cv2.arcLength(cnt, True)
            if perimeter <= 0:
                continue
            circularity = 4 * 3.14159 * area / (perimeter * perimeter)
            if circularity < pass_cfg["circ_thresh"]:
                continue
            (cx, cy_c), radius = cv2.minEnclosingCircle(cnt)
            cx, cy_c, radius = float(cx), float(cy_c), float(radius)
            if radius < min_radius or radius > max_radius:
                continue
            mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.circle(mask, (int(cx), int(cy_c)), int(radius * 0.8), 255, -1)
            mean_inside = float(cv2.mean(gray, mask=mask)[0])
            darkness_ratio = mean_inside / max(bg_intensity, 1.0)
            if darkness_ratio > pass_cfg["darkness_contour"]:
                continue
            candidates.append({
                "cx": cx, "cy": cy_c, "radius": radius,
                "area": area, "circularity": circularity,
                "darkness": darkness_ratio, "source": "contour",
            })

        # HoughCircles supplementary
        hough_min_r = max(min_radius, int(w * 0.02))
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2,
            minDist=int(hough_min_r * 1.5),
            param1=80, param2=int(pass_cfg["hough_param2"]),
            minRadius=hough_min_r, maxRadius=max_radius,
        )
        if circles is not None:
            for c in circles[0]:
                cx_h, cy_h, r_h = float(c[0]), float(c[1]), float(c[2])
                mask = np.zeros(gray.shape, dtype=np.uint8)
                cv2.circle(mask, (int(cx_h), int(cy_h)), int(r_h * 0.8), 255, -1)
                mean_inside = float(cv2.mean(gray, mask=mask)[0])
                darkness_ratio = mean_inside / max(bg_intensity, 1.0)
                if darkness_ratio > pass_cfg["darkness_hough"]:
                    continue
                candidates.append({
                    "cx": cx_h, "cy": cy_h, "radius": r_h,
                    "area": 3.14159 * r_h * r_h, "circularity": 1.0,
                    "darkness": darkness_ratio, "source": "hough",
                })

        if not candidates:
            if expected_count > 0 and len(best_merged) < expected_count:
                continue
            break

        # Deduplicate
        candidates.sort(key=lambda c: -c["area"])
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
                merge_threshold = min(a["radius"], b["radius"]) * 0.8
                if dist < merge_threshold:
                    group.append(b)
                    used.add(j)
            used.add(i)
            merged.append({
                "cx": sum(g["cx"] for g in group) / len(group),
                "cy": sum(g["cy"] for g in group) / len(group),
                "radius": sum(g["radius"] for g in group) / len(group),
                "darkness": min(g["darkness"] for g in group),
                "circularity": max(g["circularity"] for g in group),
                "n_sources": len(group),
            })

        # Filter outliers (only if we have enough to establish a pattern)
        if len(merged) > 2:
            radii = [m["radius"] for m in merged]
            median_r = sorted(radii)[len(radii) // 2]
            merged = [m for m in merged if 0.35 * median_r <= m["radius"] <= 2.8 * median_r]

        # Keep best result across passes
        if len(merged) > len(best_merged):
            best_merged = merged

        logger.info(f"OpenCV pass '{pass_cfg['label']}': found {len(merged)} candidates (best so far: {len(best_merged)})")

        # If we found enough, stop
        if expected_count > 0 and len(best_merged) >= expected_count:
            break
        # If no expected_count, first pass is enough
        if expected_count <= 0:
            break

    merged = best_merged

    # Rank
    for m in merged:
        m["score"] = (1.0 - m["darkness"]) * 40 + m["circularity"] * 30 + min(m.get("n_sources", 1), 3) * 10
    merged.sort(key=lambda m: -m["score"])

    if expected_count > 0 and len(merged) > expected_count:
        merged = merged[:expected_count]

    logger.info(f"OpenCV detected {len(merged)} embryos (expected: {expected_count})")

    # Refine radii — expand from detected center until hitting background
    # Fixes small radii caused by adaptive threshold fragmenting large embryos
    for m in merged:
        refined = _refine_radius(gray, blurred, m["cx"], m["cy"], m["radius"], bg_intensity, w, h)
        if refined > m["radius"]:
            logger.info(f"Radius refined: {m['radius']:.0f} -> {refined:.0f} at ({m['cx']:.0f},{m['cy']:.0f})")
            m["radius"] = refined

    # Reading order
    if len(merged) > 1:
        avg_r = sum(m["radius"] for m in merged) / len(merged)
        row_tol = avg_r * 1.5
        merged.sort(key=lambda m: m["cy"])
        rows = [[merged[0]]]
        for m in merged[1:]:
            if abs(m["cy"] - rows[-1][0]["cy"]) < row_tol:
                rows[-1].append(m)
            else:
                rows.append([m])
        for row in rows:
            row.sort(key=lambda m: m["cx"])
        merged = [m for row in rows for m in row]

    # Convert to percentage bboxes
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


# ═══════════════════════════════════════════════════════════
# KINETICS (ported from frame-extractor)
# ═══════════════════════════════════════════════════════════

def _compute_background_noise(
    gray_frames: list, bboxes: list[dict],
    vid_w: int, vid_h: int, fps: float,
) -> tuple[float, list[float], list[np.ndarray]]:
    """Compute camera noise floor and per-frame background motion."""
    gap = max(1, int(fps))
    wide_diffs = []
    for i in range(gap, len(gray_frames)):
        wide_diffs.append(cv2.absdiff(gray_frames[i - gap], gray_frames[i]))

    # Build mask of all embryo regions
    all_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
    for bbox in bboxes:
        bcx = int(bbox.get("x_percent", 50) / 100 * vid_w)
        bcy = int(bbox.get("y_percent", 50) / 100 * vid_h)
        bbw = int(bbox.get("width_percent", 10) / 100 * vid_w)
        bbh = int(bbox.get("height_percent", 10) / 100 * vid_h)
        br = max(bbw, bbh) // 2
        cv2.circle(all_mask, (bcx, bcy), int(br * 1.3), 255, -1)

    bg_indices = all_mask == 0
    bg_std = 0.0
    bg_timeline = [0.0] * len(wide_diffs)

    if int(np.sum(bg_indices)) > 100:
        # Welford's online variance — O(1) extra memory instead of O(N*pixels)
        n = 0
        mean_acc = None
        m2_acc = None
        for g in gray_frames:
            pixels = g[bg_indices].astype(np.float32)
            n += 1
            if mean_acc is None:
                mean_acc = pixels.copy()
                m2_acc = np.zeros_like(pixels)
            else:
                delta = pixels - mean_acc
                mean_acc += delta / n
                delta2 = pixels - mean_acc
                m2_acc += delta * delta2
        if n > 1:
            variance = m2_acc / (n - 1)
            bg_std = float(np.mean(np.sqrt(variance)))
        del mean_acc, m2_acc

        bg_timeline = [
            float(np.mean(wd[bg_indices].astype(np.float32)))
            for wd in wide_diffs
        ]

    return bg_std, bg_timeline, wide_diffs


def _compute_kinetic_profile(
    gray_frames: list, full_mask: np.ndarray, mask_indices: np.ndarray,
    cx: int, cy: int, radius: int, fps: float,
    wide_diffs: list, bg_std: float, bg_timeline: list[float],
    cumulative_heat: np.ndarray = None,
) -> dict:
    """Compute kinetic profile with camera noise compensation."""
    vid_h, vid_w = gray_frames[0].shape

    # Regional: core vs periphery
    inner_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
    cv2.circle(inner_mask, (cx, cy), max(1, radius // 2), 255, -1)
    inner_idx = inner_mask > 0

    outer_mask = full_mask.copy()
    outer_mask[inner_idx] = 0
    outer_idx = outer_mask > 0

    core_activity = 0
    periphery_activity = 0

    if np.sum(inner_idx) > 0 and len(gray_frames) >= 2:
        core_stack = np.stack([g[inner_idx].astype(np.float32) for g in gray_frames])
        core_raw = float(np.mean(np.std(core_stack, axis=0)))
        core_activity = int(min(100, max(0, max(0.0, core_raw - bg_std) * 100 / 15)))

    if np.sum(outer_idx) > 0 and len(gray_frames) >= 2:
        periph_stack = np.stack([g[outer_idx].astype(np.float32) for g in gray_frames])
        periph_raw = float(np.mean(np.std(periph_stack, axis=0)))
        periphery_activity = int(min(100, max(0, max(0.0, periph_raw - bg_std) * 100 / 15)))

    if core_activity > periphery_activity * 1.5 and core_activity > 5:
        peak_zone = "core"
    elif periphery_activity > core_activity * 1.5 and periphery_activity > 5:
        peak_zone = "periphery"
    else:
        peak_zone = "uniform"

    # Timeline (compensated)
    raw_timeline = []
    for j, wd in enumerate(wide_diffs):
        emb_diff = float(np.mean(wd[mask_indices].astype(np.float32)))
        bg_diff = bg_timeline[j] if j < len(bg_timeline) else 0.0
        raw_timeline.append(max(0.0, emb_diff - bg_diff))

    timeline_norm = [int(min(100, max(0, v * 100 / 15))) for v in raw_timeline]
    temporal_variability = round(float(np.std(raw_timeline)), 2) if len(raw_timeline) > 1 else 0.0

    # Temporal pattern
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

    # Symmetry (quadrant analysis) — use pre-computed cumulative_heat
    if cumulative_heat is None:
        cumulative_heat = np.zeros((vid_h, vid_w), dtype=np.float64)
        for wd in wide_diffs:
            cumulative_heat += wd.astype(np.float64)

    quads = []
    for y_sl, x_sl in [
        (slice(0, cy), slice(0, cx)),
        (slice(0, cy), slice(cx, vid_w)),
        (slice(cy, vid_h), slice(0, cx)),
        (slice(cy, vid_h), slice(cx, vid_w)),
    ]:
        q_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
        q_mask[y_sl, x_sl] = full_mask[y_sl, x_sl]
        quads.append(float(np.sum(cumulative_heat[q_mask > 0])))

    total_q = sum(quads)
    activity_symmetry = 1.0
    focal_activity_detected = False

    if total_q > 0:
        mean_q = float(np.mean(quads))
        std_q = float(np.std(quads))
        activity_symmetry = round(max(0.0, min(1.0, 1.0 - std_q / max(mean_q, 0.01))), 2)
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


def _compute_temporal_stability(profile: dict) -> float:
    """Convert temporal_variability (unbounded) to stability (0-1). More stable = higher."""
    var = profile.get("temporal_variability", 0.0)
    return round(max(0.0, 1.0 - var / 5.0), 3)




def _call_gemini_with_retry(
    crop_jpg: bytes, motion_jpg: bytes,
    api_key: str, prompt: str | None, model_name: str,
    activity_score: int, kinetic_profile: dict,
    nsd: float, anr: float,
    max_retries: int = 3,
) -> dict:
    """Call Gemini with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return _analyze_with_gemini(
                crop_jpg, motion_jpg, api_key, prompt, model_name,
                activity_score, kinetic_profile, nsd, anr,
            )
        except Exception as e:
            logger.warning(f"Gemini attempt {attempt+1}/{max_retries}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                continue
            return {
                "classification": "Pending",
                "reasoning": "Gemini indisponível — reprocesse quando possível",
                "confidence": "low",
                "stage_code": None,
                "quality_grade": None,
                "visual_features": None,
                "kinetic_assessment": None,
            }




# ═══════════════════════════════════════════════════════════
# DINOv2 EMBEDDING (ONNX)
# ═══════════════════════════════════════════════════════════

def _get_embedding(image: np.ndarray) -> list[float]:
    """Generate DINOv2 embedding via ONNX Runtime. Returns 384-dim vector."""
    if ort_session is None:
        return [0.0] * 384

    # Preprocess: BGR->RGB, resize 224x224, normalize ImageNet
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb).resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    arr = arr.transpose(2, 0, 1)[np.newaxis].astype(np.float32)  # (1, 3, 224, 224)

    # Build input feed dynamically based on what the model expects
    input_feed = {"image": arr}
    input_names = [inp.name for inp in ort_session.get_inputs()]
    if "masks" in input_names:
        # DINOv2 masks: (batch, num_patches) bool — False = visible (no masking)
        num_patches = (224 // 14) ** 2  # 256 for ViT-S/14
        input_feed["masks"] = np.zeros((1, num_patches), dtype=bool)

    result = ort_session.run(None, input_feed)
    return result[0][0].tolist()


def _get_embeddings_batch(images: list[np.ndarray]) -> list[list[float]]:
    """Generate DINOv2 embeddings for a list of images."""
    return [_get_embedding(img) for img in images]


# ═══════════════════════════════════════════════════════════
# GEMINI ANALYSIS
# ═══════════════════════════════════════════════════════════

DEFAULT_GEMINI_PROMPT = """Voce e um embriologista veterinario especialista em FIV bovina.

IMAGEM 1: Melhor frame do embriao (microscopio estereoscopico)
IMAGEM 2: Mapa de calor cinetico (vermelho = mais movimento ao longo do video)

DADOS CINETICOS MEDIDOS (computacional, NAO visual):
- Activity score: {activity_score}/100
- NSD (desvio padrao normalizado): {nsd} (mais = mais ativo; embrioes mortos <5x menos)
- ANR (razao atividade/ruido): {anr} (>2 = atividade real acima do ruido de camera)
- Core activity: {core_activity}/100
- Periphery activity: {periphery_activity}/100
- Peak zone: {peak_zone}
- Temporal pattern: {temporal_pattern}
- Symmetry: {symmetry}

Analise AMBAS as imagens e os dados cineticos. Forneca sua avaliacao profissional.

## Classificacao Morfologica
- Classifique em: BE (Blastocisto Expandido), BN (Blastocisto Normal), BX (Blastocisto em Eclosao), BL (Blastocisto), BI (Blastocisto Inicial), Mo (Morula), Dg (Degenerado)
- Informe o estagio IETS (3-9) e grau de qualidade (1-4)

## Analise Visual
Descreva objetivamente o que voce observa:
- MCI (massa celular interna): compactacao, definicao
- Trofoectoderma: organizacao celular
- Zona Pelucida: integridade, espessura
- Espaco perivitelino: debris, celulas extrusas
- Formato geral: esferico, irregular

## Analise Cinetica
Interprete os dados cineticos medidos e o heatmap.

IMPORTANTE:
- Seja 100% honesto na sua avaliacao
- NAO inflacione nem deflacione as notas
- Se a qualidade e ruim, diga que e ruim
- Se nao consegue avaliar com certeza, indique incerteza

Responda APENAS em JSON:
{
  "classification": "XX",
  "stage_code": N,
  "quality_grade": N,
  "reasoning": "justificativa completa em portugues",
  "visual_features": {
    "mci_quality": "good/fair/poor",
    "trophectoderm_quality": "good/fair/poor",
    "zona_pellucida_intact": true/false,
    "extruded_cells": true/false,
    "debris_in_zona": true/false,
    "dark_cytoplasm": true/false,
    "shape": "spherical/oval/irregular"
  },
  "kinetic_assessment": "interpretacao dos dados cineticos em portugues",
  "confidence": "high/medium/low"
}"""


def _extract_json_from_text(text: str) -> dict:
    """Extract JSON object from text that may contain markdown or extra content."""
    import re
    # Try direct parse first
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass

    # Strip markdown code fences
    cleaned = text.replace('```json', '').replace('```', '').strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        pass

    # Find first { ... } block using regex
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, TypeError):
            pass

    raise ValueError(f"Could not extract JSON from response: {text[:300]}")


def _analyze_with_gemini(
    crop_jpg: bytes, motion_jpg: bytes,
    api_key: str, custom_prompt: str | None,
    model_name: str,
    activity_score: int, kinetic_profile: dict,
    nsd: float, anr: float,
) -> dict:
    """Call Gemini with best frame + heatmap + kinetic data."""
    try:
        _ensure_gemini(api_key)

        prompt_template = custom_prompt or DEFAULT_GEMINI_PROMPT
        prompt = prompt_template
        prompt = prompt.replace("{activity_score}", str(activity_score))
        prompt = prompt.replace("{nsd}", str(nsd))
        prompt = prompt.replace("{anr}", str(anr))
        prompt = prompt.replace("{kinetic_quality}", "N/A")  # Legacy fallback for custom prompts
        prompt = prompt.replace("{core_activity}", str(kinetic_profile.get("core_activity", 0)))
        prompt = prompt.replace("{periphery_activity}", str(kinetic_profile.get("periphery_activity", 0)))
        prompt = prompt.replace("{peak_zone}", str(kinetic_profile.get("peak_zone", "unknown")))
        prompt = prompt.replace("{temporal_pattern}", str(kinetic_profile.get("temporal_pattern", "unknown")))
        prompt = prompt.replace("{symmetry}", str(kinetic_profile.get("activity_symmetry", 1.0)))

        crop_image = Image.open(io.BytesIO(crop_jpg))
        motion_image = Image.open(io.BytesIO(motion_jpg))

        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            [prompt, crop_image, motion_image],
            request_options={"timeout": 30}
        )

        raw_text = response.text
        logger.info(f"Gemini raw response ({len(raw_text)} chars): {raw_text[:200]}")

        result = _extract_json_from_text(raw_text)

        # Validate required fields
        if "classification" not in result:
            result["classification"] = "Unknown"
        if "reasoning" not in result:
            result["reasoning"] = ""

        return result

    except Exception as e:
        logger.error(f"Gemini error: {type(e).__name__}: {e}")
        # Re-raise so _call_gemini_with_retry can retry
        raise


# ═══════════════════════════════════════════════════════════
# SAVE SCORES TO DB
# ═══════════════════════════════════════════════════════════

def _map_quality_grade_to_classification(quality_grade, iets_code: str) -> str:
    """Map Gemini's quality_grade (1-4) + IETS code to DB classification.
    DB CHECK constraint allows: Excelente, Bom, Regular, Borderline, Inviavel.
    """
    if iets_code == "Dg":
        return "Inviavel"
    if quality_grade == 1:
        return "Excelente"
    elif quality_grade == 2:
        return "Bom"
    elif quality_grade == 3:
        return "Regular"
    elif quality_grade == 4:
        return "Inviavel"
    else:
        # Fallback based on IETS stage code
        if iets_code in ("BE", "BX"):
            return "Bom"
        elif iets_code in ("BN", "BL"):
            return "Regular"
        elif iets_code in ("BI", "Mo"):
            return "Borderline"
        return "Regular"


def _do_knn_lookup(sb, embedding: list, kinetic_intensity: float,
                   kinetic_harmony: float, kinetic_stability: float,
                   min_refs: int = 5) -> dict:
    """KNN lookup via match_embryos_v2 RPC. Returns classification + votes."""
    if not embedding or all(v == 0 for v in embedding):
        return {"combined_source": "insufficient", "combined_classification": None,
                "knn_classification": None, "knn_confidence": None, "knn_votes": {}}

    try:
        ref_count = sb.table('embryo_references').select('id', count='exact', head=True).execute()
        total_refs = ref_count.count or 0
        if total_refs < min_refs:
            return {"combined_source": "insufficient", "combined_classification": None,
                    "knn_classification": None, "knn_confidence": None, "knn_votes": {},
                    "knn_real_bovine_count": total_refs}

        resp = sb.rpc('match_embryos_v2', {
            "query_embedding": str(embedding),
            "query_kinetic_intensity": kinetic_intensity,
            "query_kinetic_harmony": kinetic_harmony,
            "query_kinetic_stability": kinetic_stability,
            "match_count": 10,
            "visual_top_n": 30,
            "alpha": 0.7,
            "beta": 0.3,
            "min_similarity": 0.50,
        }).execute()

        neighbors = resp.data or []
        if not neighbors:
            return {"combined_source": "insufficient", "combined_classification": None,
                    "knn_classification": None, "knn_confidence": None, "knn_votes": {},
                    "knn_real_bovine_count": total_refs}

        # Weighted voting by composite_score
        votes: dict[str, float] = {}
        for n in neighbors:
            cls = n.get("classification") or "Unknown"
            weight = n.get("composite_score", 0.5)
            votes[cls] = votes.get(cls, 0) + weight

        sorted_votes = sorted(votes.items(), key=lambda x: -x[1])
        top_cls = sorted_votes[0][0]
        total_weight = sum(v for _, v in sorted_votes)
        confidence = round((sorted_votes[0][1] / max(total_weight, 0.01)) * 100)

        # Integer vote counts for display
        int_votes = {}
        for n in neighbors:
            cls = n.get("classification") or "Unknown"
            int_votes[cls] = int_votes.get(cls, 0) + 1

        return {
            "combined_source": "knn",
            "combined_classification": top_cls,
            "combined_confidence": confidence,
            "knn_classification": top_cls,
            "knn_confidence": confidence,
            "knn_votes": int_votes,
            "knn_real_bovine_count": total_refs,
            "knn_neighbor_ids": [n["id"] for n in neighbors],
        }
    except Exception as e:
        logger.warning(f"KNN lookup failed: {e}")
        return {"combined_source": "insufficient", "combined_classification": None,
                "knn_classification": None, "knn_confidence": None, "knn_votes": {}}


def _save_scores_to_db(sb, req, embryo_results: list, bboxes: list, job_dir: str):
    """Save embryo scores directly to Supabase DB. Called from Cloud Run."""
    # Fetch embryos linked to THIS job (by queue_id) — each video has its own set
    resp = sb.table('embrioes').select('id, classificacao').eq(
        'queue_id', req.job_id
    ).order('identificacao').execute()
    existing_embryos = resp.data or []

    # Update queue with detection results
    sb.table('embryo_analysis_queue').update({
        'plate_frame_path': f"{job_dir}/plate_frame.jpg",
        'detected_bboxes': bboxes,
    }).eq('id', req.job_id).execute()

    if not embryo_results:
        sb.table('embryo_analysis_queue').update({
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'error_log': 'No embryos detected',
        }).eq('id', req.job_id).execute()
        return

    # ── Allowed enum values (must match DB CHECK constraints) ──
    VALID_CLASSIFICATIONS = {"Excelente", "Bom", "Regular", "Borderline", "Inviavel"}
    VALID_CONFIDENCES = {"high", "medium", "low"}
    VALID_TRANSFER_RECS = {"priority", "recommended", "conditional", "second_opinion", "discard"}
    REC_MAP = {
        "Excelente": "priority",
        "Bom": "recommended",
        "Regular": "conditional",
        "Borderline": "second_opinion",
        "Inviavel": "discard",
    }

    scores_to_insert = []
    for emb in embryo_results:
        db_idx = emb["index"]
        if db_idx >= len(existing_embryos):
            logger.warning(f"No DB embryo at index {db_idx}")
            continue
        emb_id = existing_embryos[db_idx]["id"]

        gemini = emb.get("gemini_analysis") or {}
        iets_code = gemini.get("classification") or "Unknown"
        quality_grade = gemini.get("quality_grade")

        # ── Fix #2: Validate confidence enum ──
        confidence_str = (gemini.get("confidence") or "low").lower().strip()
        if confidence_str not in VALID_CONFIDENCES:
            logger.warning(f"Invalid confidence '{confidence_str}' from Gemini, defaulting to 'low'")
            confidence_str = "low"
        ai_conf = 0.9 if confidence_str == "high" else 0.6 if confidence_str == "medium" else 0.3

        # ── Fix #4: Validate classification enum ──
        db_classification = _map_quality_grade_to_classification(quality_grade, iets_code)
        if db_classification not in VALID_CLASSIFICATIONS:
            logger.warning(f"Invalid classification '{db_classification}', defaulting to 'Regular'")
            db_classification = "Regular"

        # ── Fix #4: Validate transfer_recommendation enum ──
        transfer_rec = REC_MAP.get(db_classification, "conditional")
        if transfer_rec not in VALID_TRANSFER_RECS:
            transfer_rec = "conditional"

        score_record = {
            "embriao_id": emb_id,
            "media_id": req.media_id,
            "is_current": True,
            # Required NOT NULL columns — all validated against CHECK constraints
            "classification": db_classification,
            "confidence": confidence_str,
            "embryo_score": round(ai_conf * 100),
            "transfer_recommendation": transfer_rec,
            # Storage paths
            "crop_image_path": emb.get("crop_image_path"),
            "motion_map_path": emb.get("motion_map_path"),
            # Kinetics — NSD-based (scientific: PMC5695959, PMC9089758)
            "kinetic_intensity": emb.get("nsd", 0.0),
            "kinetic_harmony": (emb.get("kinetic_profile") or {}).get("activity_symmetry", 0.0),
            "kinetic_stability": _compute_temporal_stability(emb.get("kinetic_profile") or {}),
            "kinetic_bg_noise": emb.get("bg_std"),
            # ── Fix #1: Save gemini_classification (IETS code) ──
            "gemini_classification": iets_code if iets_code not in ("Error", "Unknown") else None,
            "gemini_reasoning": gemini.get("reasoning"),
            "stage_code": gemini.get("stage_code"),
            "quality_grade": quality_grade,
            "visual_features": gemini.get("visual_features") or None,
            "ai_confidence": ai_conf,
            # Summary includes IETS code for reference
            "reasoning": f"Gemini: {iets_code} (grau {quality_grade})" if iets_code not in ("Error", "Unknown") else "Pendente",
        }

        # Auto-copy biologist classification from embrioes table (if already classified via quick-classify)
        existing_class = existing_embryos[db_idx].get("classificacao") if db_idx < len(existing_embryos) else None
        if existing_class and existing_class in ("BE", "BN", "BX", "BL", "BI", "Mo", "Dg"):
            score_record["biologist_classification"] = existing_class

        # Embedding: pad to 768 for pgvector, serialize as JSON string
        embedding = emb.get("embedding") or []
        if embedding and any(v != 0 for v in embedding):
            if len(embedding) < 768:
                embedding = embedding + [0.0] * (768 - len(embedding))
            score_record["embedding"] = json.dumps(embedding)

            # KNN lookup with padded embedding
            knn_result = _do_knn_lookup(
                sb, embedding,
                score_record.get("kinetic_intensity", 0.0),
                score_record.get("kinetic_harmony", 0.0),
                score_record.get("kinetic_stability", 0.0),
            )
            score_record.update({
                "combined_source": knn_result.get("combined_source"),
                "combined_classification": knn_result.get("combined_classification"),
                "combined_confidence": knn_result.get("combined_confidence"),
                "knn_classification": knn_result.get("knn_classification"),
                "knn_confidence": knn_result.get("knn_confidence"),
                "knn_votes": knn_result.get("knn_votes"),
                "knn_real_bovine_count": knn_result.get("knn_real_bovine_count"),
            })

        scores_to_insert.append(score_record)

    if scores_to_insert:
        emb_ids = [s["embriao_id"] for s in scores_to_insert]
        cutoff = datetime.utcnow().isoformat()

        # 1. INSERT new scores (is_current=True) FIRST — safe if fails (old scores remain)
        try:
            sb.table('embryo_scores').insert(scores_to_insert).execute()
        except Exception as insert_err:
            err_msg = str(insert_err)
            if 'gemini_classification' in err_msg:
                logger.warning("gemini_classification column not found, retrying without it")
                for s in scores_to_insert:
                    s.pop("gemini_classification", None)
                sb.table('embryo_scores').insert(scores_to_insert).execute()
            else:
                raise

        # 2. THEN mark old scores as non-current (timestamp fence prevents marking the new ones)
        sb.table('embryo_scores').update({"is_current": False}) \
            .in_("embriao_id", emb_ids) \
            .lt("created_at", cutoff) \
            .execute()

        # 3. Auto-populate embryo_references atlas (batch upsert)
        atlas_records = []
        for score_rec in scores_to_insert:
            bio_class = score_rec.get("biologist_classification")
            emb_embedding = score_rec.get("embedding")
            if bio_class and emb_embedding:
                atlas_records.append({
                    "embriao_id": score_rec["embriao_id"],
                    "classification": bio_class,
                    "embedding": emb_embedding,
                    "kinetic_intensity": score_rec.get("kinetic_intensity"),
                    "kinetic_harmony": score_rec.get("kinetic_harmony"),
                    "kinetic_stability": score_rec.get("kinetic_stability"),
                    "kinetic_bg_noise": score_rec.get("kinetic_bg_noise"),
                    "best_frame_path": score_rec.get("crop_image_path"),
                    "motion_map_path": score_rec.get("motion_map_path"),
                    "species": "bovine_real",
                    "source": "lab",
                    "lab_id": "00000000-0000-0000-0000-000000000001",
                })
        if atlas_records:
            try:
                sb.table('embryo_references').upsert(
                    atlas_records, on_conflict="embriao_id").execute()
            except Exception as ref_err:
                logger.warning(f"Batch atlas upsert failed: {ref_err}")

    # Mark job complete
    sb.table('embryo_analysis_queue').update({
        'status': 'completed',
        'completed_at': datetime.utcnow().isoformat(),
    }).eq('id', req.job_id).execute()

    logger.info(f"Saved {len(scores_to_insert)} scores to DB for job {req.job_id}")


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def _download_video(url: str, retries: int = 2) -> str:
    """Download video to temp file with retry, return path."""
    last_err = None
    for attempt in range(retries):
        try:
            resp = http_requests.get(url, timeout=120, stream=True)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                for chunk in resp.iter_content(chunk_size=8192):
                    tmp.write(chunk)
                return tmp.name
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                delay = 2 ** attempt
                logger.warning(f"Video download attempt {attempt + 1} failed: {e}, retrying in {delay}s...")
                time.sleep(delay)
    raise last_err


def _upload_to_storage(sb, path: str, data: bytes, retries: int = 3):
    """Upload bytes to Supabase Storage embryoscore bucket with retry."""
    for attempt in range(retries):
        try:
            sb.storage.from_("embryoscore").upload(
                path, data, {"content-type": "image/jpeg", "upsert": "true"})
            return
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1 * (attempt + 1))
                logger.warning(f"Upload retry {attempt+1} for {path}: {e}")
            else:
                logger.error(f"Upload FAILED after {retries} tries: {path}: {e}")
                raise


def _extract_crop_from_frame(
    frame: np.ndarray, bbox: dict,
    fw: int, fh: int, padding: float, output_size: int,
) -> np.ndarray | None:
    """Extract and resize crop from frame using center-based % bbox."""
    x_pct = bbox.get("x_percent", 0)
    y_pct = bbox.get("y_percent", 0)
    w_pct = bbox.get("width_percent", 0)
    h_pct = bbox.get("height_percent", 0)

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
    if crop.size == 0:
        return None
    return cv2.resize(crop, (output_size, output_size), interpolation=cv2.INTER_LANCZOS4)


def _compute_kinetics_for_bbox(
    bbox_idx: int, bbox: dict,
    gray_frames: list, color_frames: list, wide_diffs: list,
    bg_std: float, bg_timeline: list, vid_w: int, vid_h: int, fps: float,
    num_key_frames: int, output_size: int, overlay_opacity: float,
    skip_composites: bool,
) -> dict:
    """Compute full kinetics for a single bbox (retrocompat endpoint)."""
    cx = int(bbox.get("x_percent", 50) / 100 * vid_w)
    cy = int(bbox.get("y_percent", 50) / 100 * vid_h)
    bw = int(bbox.get("width_percent", 10) / 100 * vid_w)
    bh = int(bbox.get("height_percent", 10) / 100 * vid_h)
    radius = max(bw, bh) // 2

    mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), radius, 255, -1)
    mask_indices = mask > 0

    # Activity score
    pixel_values = [g[mask_indices].astype(np.float32) for g in gray_frames]
    if len(pixel_values) >= 2:
        pixel_stack = np.stack(pixel_values, axis=0)
        pixel_std = np.std(pixel_stack, axis=0)
        mean_std = float(np.mean(pixel_std))
        compensated_std = max(0.0, mean_std - bg_std)
        activity_score = int(min(100, max(0, compensated_std * 100 / 15)))
    else:
        activity_score = 0

    kinetic_profile = _compute_kinetic_profile(
        gray_frames, mask, mask_indices, cx, cy, radius, fps,
        wide_diffs, bg_std, bg_timeline)

    # Key frames
    total_sampled = len(color_frames)
    if num_key_frames == 1:
        key_indices = [total_sampled // 2]
    elif total_sampled <= num_key_frames:
        key_indices = list(range(total_sampled))
    else:
        key_indices = [int(i * (total_sampled - 1) / (num_key_frames - 1)) for i in range(num_key_frames)]

    # Crop region
    padding_ratio = 0.20
    size = max(bw, bh)
    padded = int(size * (1 + padding_ratio * 2))
    half_pad = padded // 2

    crop_left = max(0, cx - half_pad)
    crop_top = max(0, cy - half_pad)
    crop_right = min(vid_w, cx + half_pad)
    crop_bottom = min(vid_h, cy + half_pad)

    gap = max(1, int(fps))
    global_diff_max = 1.0
    for wd in wide_diffs:
        rv = wd[crop_top:crop_bottom, crop_left:crop_right]
        rm = float(rv.max()) if rv.size > 0 else 0
        if rm > global_diff_max:
            global_diff_max = rm

    clean_frames_b64 = []
    composite_frames_b64 = []

    for ki, frame_idx in enumerate(key_indices):
        raw_crop = color_frames[frame_idx][crop_top:crop_bottom, crop_left:crop_right]
        if raw_crop.shape[0] > 0 and raw_crop.shape[1] > 0:
            clean_resized = cv2.resize(raw_crop, (output_size, output_size), interpolation=cv2.INTER_LANCZOS4)
        else:
            clean_resized = np.zeros((output_size, output_size, 3), dtype=np.uint8)
        _, clean_buf = cv2.imencode(".jpg", clean_resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
        clean_frames_b64.append(base64.b64encode(clean_buf.tobytes()).decode("ascii"))

        if not skip_composites:
            composite_crop = raw_crop.copy()
            if ki > 0 and len(wide_diffs) > 0:
                wide_idx = min(max(0, frame_idx - gap), len(wide_diffs) - 1)
                diff_region = wide_diffs[wide_idx][crop_top:crop_bottom, crop_left:crop_right]
                if diff_region.size > 0:
                    diff_norm = np.clip(diff_region.astype(np.float32) / global_diff_max * 255, 0, 255).astype(np.uint8)
                    diff_colored = cv2.applyColorMap(diff_norm, cv2.COLORMAP_HOT)
                    diff_alpha = diff_region.astype(np.float32) / global_diff_max * overlay_opacity
                    diff_alpha_3ch = np.stack([diff_alpha] * 3, axis=-1)
                    composite_crop = (
                        composite_crop.astype(np.float32) * (1 - diff_alpha_3ch)
                        + diff_colored.astype(np.float32) * diff_alpha_3ch
                    ).astype(np.uint8)

            if composite_crop.shape[0] > 0 and composite_crop.shape[1] > 0:
                comp_resized = cv2.resize(composite_crop, (output_size, output_size), interpolation=cv2.INTER_LANCZOS4)
            else:
                comp_resized = np.zeros((output_size, output_size, 3), dtype=np.uint8)
            _, comp_buf = cv2.imencode(".jpg", comp_resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
            composite_frames_b64.append(base64.b64encode(comp_buf.tobytes()).decode("ascii"))

    # Cumulative heatmap
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
            heat_resized = cv2.resize(heat_colored, (output_size, output_size), interpolation=cv2.INTER_LANCZOS4)
        else:
            heat_resized = np.zeros((output_size, output_size, 3), dtype=np.uint8)
        _, heat_buf = cv2.imencode(".jpg", heat_resized, [cv2.IMWRITE_JPEG_QUALITY, 85])
        heatmap_b64 = base64.b64encode(heat_buf.tobytes()).decode("ascii")

    return {
        "index": bbox_idx,
        "activity_score": activity_score,
        "kinetic_profile": kinetic_profile,
        "clean_frames": clean_frames_b64,
        "composite_frames": composite_frames_b64,
        "cumulative_heatmap": heatmap_b64,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
