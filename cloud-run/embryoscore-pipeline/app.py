"""
EmbryoScore Pipeline v6 — Unified Cloud Run Service

POST /analyze          — Full pipeline: detect + kinetics + DINOv2 + Gemini + Storage
POST /detect-and-crop  — Retrocompat: OpenCV detect + crop (from frame-extractor)
POST /analyze-activity — Retrocompat: Advanced kinetics (from frame-extractor)
GET  /health           — Health check

Consolidates frame-extractor (kinetics, detection) + old pipeline (DINOv2, Gemini, Storage).
DINOv2 via ONNX Runtime (~15MB) instead of PyTorch (~800MB).
"""

import base64
import gc
import io
import json
import logging
import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, wait as futures_wait
from datetime import datetime
from typing import Any, Optional

import cv2
import numpy as np
import requests as http_requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image

# Lazy imports for heavy libs
genai = None
ort_session = None
supabase_client = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="embryoscore-pipeline-v6")

# ─── Configuration ───────────────────────────────────────
FRAME_COUNT = 40
KINETIC_FPS = 8
OUTPUT_SIZE = 400
MAX_FRAME_HEIGHT = 720          # Downscale to 720p max to save memory
MAX_SAMPLED_FRAMES = 120        # Cap sampled frames (~15s at 8fps)
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
    global genai
    if genai is not None:
        return
    import google.generativeai as _genai
    _genai.configure(api_key=api_key)
    genai = _genai
    logger.info("Gemini API configured.")


def _get_supabase(url: str, key: str):
    from supabase import create_client
    return create_client(url, key)


# ─── Request/Response Models ─────────────────────────────

class AnalyzeRequest(BaseModel):
    video_url: str
    job_id: str
    expected_count: int = 0
    gemini_api_key: str
    supabase_url: str
    supabase_key: str
    prompt: Optional[str] = None
    model_name: str = "gemini-2.5-flash"
    # Fields for direct DB save (Cloud Run saves scores, Edge Function doesn't wait)
    lote_fiv_acasalamento_id: Optional[str] = None
    media_id: Optional[str] = None
    embryo_offset: int = 0
    # Biologist-provided bboxes (replaces OpenCV detection when present)
    bboxes: Optional[list[dict]] = None


# ─── Health ──────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "embryoscore-pipeline-v6",
        "onnx_available": os.path.exists(ONNX_MODEL_PATH),
    }


# ─── Main Pipeline ───────────────────────────────────────

@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Full pipeline:
    1. Download video
    2. Extract frames (40 uniform + detection frame)
    3. Detect embryos (YOLO -> OpenCV fallback)
    4. Per embryo: crops, kinetics, best frame, DINOv2, Gemini
    5. Upload to Storage
    6. Return results
    """
    _ensure_onnx()
    _ensure_gemini(req.gemini_api_key)

    sb = _get_supabase(req.supabase_url, req.supabase_key)
    job_dir = f"analysis/{req.job_id}"

    # 1. Download video
    tmp_path = _download_video(req.video_url)

    try:
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

        # Downscale factor for memory safety (720p max)
        if orig_h > MAX_FRAME_HEIGHT:
            scale = MAX_FRAME_HEIGHT / orig_h
            vid_w = int(orig_w * scale)
            vid_h = MAX_FRAME_HEIGHT
            logger.info(f"Downscaling {orig_w}x{orig_h} → {vid_w}x{vid_h} (scale={scale:.2f})")
        else:
            vid_w, vid_h = orig_w, orig_h
            scale = 1.0

        # 2. Extract frames
        # 2a. Uniform sampling at KINETIC_FPS for kinetics
        sample_interval = max(1, round(video_fps / KINETIC_FPS))
        sampled_indices = list(range(0, total_frames, sample_interval))
        # Cap total frames to limit memory
        if len(sampled_indices) > MAX_SAMPLED_FRAMES:
            step = len(sampled_indices) / MAX_SAMPLED_FRAMES
            sampled_indices = [sampled_indices[int(i * step)] for i in range(MAX_SAMPLED_FRAMES)]
            logger.info(f"Capped sampled frames to {MAX_SAMPLED_FRAMES}")

        color_frames = []
        gray_frames = []
        for idx in sampled_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
            # Downscale if needed
            if scale < 1.0:
                frame = cv2.resize(frame, (vid_w, vid_h), interpolation=cv2.INTER_AREA)
            color_frames.append(frame)
            gray_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))

        cap.release()
        logger.info(f"Extracted {len(color_frames)} frames at {vid_w}x{vid_h} "
                     f"(~{len(color_frames) * vid_w * vid_h * 4 / 1024 / 1024:.0f}MB in RAM)")

        if len(color_frames) < 2:
            raise HTTPException(422, "Too few frames extracted")

        # Detection frame = middle
        det_idx = len(color_frames) // 2
        det_frame = color_frames[det_idx]

        # 3. Detect embryos (use biologist-provided bboxes if available)
        if req.bboxes:
            bboxes = req.bboxes
            logger.info(f"Using {len(bboxes)} biologist-provided bboxes (skipping OpenCV)")
        else:
            bboxes = _detect_embryos(det_frame, req.expected_count)
            logger.info(f"OpenCV detected {len(bboxes)} embryos")
        if not bboxes:
            # Upload plate frame even if no detection
            plate_jpg = cv2.imencode('.jpg', det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes()
            _upload_to_storage(sb, f"{job_dir}/plate_frame.jpg", plate_jpg)
            return {
                "plate_frame_path": f"{job_dir}/plate_frame.jpg",
                "bboxes": [],
                "embryos": [],
            }

        # Upload plate frame
        plate_jpg = cv2.imencode('.jpg', det_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes()
        _upload_to_storage(sb, f"{job_dir}/plate_frame.jpg", plate_jpg)

        # Camera noise compensation (shared across embryos)
        bg_std, bg_timeline, wide_diffs = _compute_background_noise(
            gray_frames, bboxes, vid_w, vid_h, KINETIC_FPS
        )

        # 4. Process each embryo (parallel: vision then Gemini)
        # Phase 1: Vision in parallel (crop + kinetics + embedding + upload)
        vision_results = {}
        with ThreadPoolExecutor(max_workers=min(2, len(bboxes))) as pool:
            vision_futures = {
                pool.submit(
                    _process_embryo_vision,
                    i, bbox, color_frames, gray_frames,
                    wide_diffs, bg_std, bg_timeline,
                    vid_w, vid_h, KINETIC_FPS, sb, job_dir,
                ): i
                for i, bbox in enumerate(bboxes)
            }
            # Wait for ALL futures to complete before exiting context
            futures_wait(list(vision_futures.keys()))
            for future in vision_futures:
                idx = vision_futures[future]
                try:
                    vision_results[idx] = future.result()
                except Exception as e:
                    logger.error(f"Vision failed for embryo {idx}: {e}")
                    # Mark as failed so Gemini phase skips this embryo
                    vision_results[idx] = None

        # Free heavy frame data — no longer needed after vision phase
        del color_frames, gray_frames, wide_diffs
        gc.collect()
        logger.info("Freed frame arrays before Gemini phase")

        # Filter out failed vision results before Gemini phase
        valid_vision = {i: r for i, r in vision_results.items() if r is not None}
        logger.info(f"Vision: {len(valid_vision)}/{len(bboxes)} embryos succeeded")

        # Phase 2: Gemini in parallel (with retry per embryo)
        if valid_vision:
            with ThreadPoolExecutor(max_workers=min(3, len(valid_vision))) as pool:
                gemini_futures = {
                    pool.submit(
                        _call_gemini_with_retry,
                        valid_vision[i].pop("_crop_jpg"),
                        valid_vision[i].pop("_motion_jpg"),
                        req.gemini_api_key, req.prompt, req.model_name,
                        valid_vision[i]["activity_score"],
                        valid_vision[i]["kinetic_profile"],
                        valid_vision[i]["kinetic_quality_score"],
                    ): i
                    for i in valid_vision
                }
                futures_wait(list(gemini_futures.keys()))
                for future in gemini_futures:
                    idx = gemini_futures[future]
                    try:
                        valid_vision[idx]["gemini_analysis"] = future.result()
                    except Exception as e:
                        logger.error(f"Gemini failed for embryo {idx}: {e}")
                        valid_vision[idx]["gemini_analysis"] = {
                            "classification": "Error",
                            "reasoning": str(e)[:200],
                            "confidence": "low",
                        }

        embryo_results = [valid_vision[i] for i in sorted(valid_vision)]

        # ─── 5. Save scores directly to DB ─────────────────
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

        return {
            "plate_frame_path": f"{job_dir}/plate_frame.jpg",
            "bboxes": bboxes,
            "embryos": embryo_results,
        }

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


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
    bg_intensity = float(np.median(blurred))

    min_radius = int(w * 0.015)
    max_radius = int(w * 0.15)
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
        bg_pixels = [g[bg_indices].astype(np.float32) for g in gray_frames]
        bg_stack = np.stack(bg_pixels, axis=0)
        bg_std = float(np.mean(np.std(bg_stack, axis=0)))
        bg_timeline = [
            float(np.mean(wd[bg_indices].astype(np.float32)))
            for wd in wide_diffs
        ]

    return bg_std, bg_timeline, wide_diffs


def _compute_kinetic_profile(
    gray_frames: list, full_mask: np.ndarray, mask_indices: np.ndarray,
    cx: int, cy: int, radius: int, fps: float,
    wide_diffs: list, bg_std: float, bg_timeline: list[float],
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

    # Symmetry (quadrant analysis)
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


def _compute_kinetic_quality(activity_score: int, profile: dict) -> int:
    """Map activity score to quality assessment (bell curve)."""
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

    if profile.get("focal_activity_detected") and activity_score > 10:
        base += 5
    if profile.get("activity_symmetry", 1.0) < 0.4:
        base -= 5

    return max(0, min(100, base))


# ═══════════════════════════════════════════════════════════
# SINGLE EMBRYO PROCESSING
# ═══════════════════════════════════════════════════════════

def _process_embryo_vision(
    emb_idx: int, bbox: dict,
    color_frames: list, gray_frames: list,
    wide_diffs: list, bg_std: float, bg_timeline: list,
    vid_w: int, vid_h: int, fps: float,
    sb, job_dir: str,
) -> dict:
    """Process one embryo vision: kinetics, best frame, DINOv2, upload. No Gemini."""

    cx = int(bbox["x_percent"] / 100 * vid_w)
    cy = int(bbox["y_percent"] / 100 * vid_h)
    bw = int(bbox["width_percent"] / 100 * vid_w)
    bh = int(bbox["height_percent"] / 100 * vid_h)
    radius = max(bw, bh) // 2

    # Mask for this embryo
    mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
    cv2.circle(mask, (cx, cy), radius, 255, -1)
    mask_indices = mask > 0

    # Activity score (compensated)
    pixel_values = [g[mask_indices].astype(np.float32) for g in gray_frames]
    if len(pixel_values) >= 2:
        pixel_stack = np.stack(pixel_values, axis=0)
        pixel_std = np.std(pixel_stack, axis=0)
        mean_std = float(np.mean(pixel_std))
        compensated_std = max(0.0, mean_std - bg_std)
        activity_score = int(min(100, max(0, compensated_std * 100 / 15)))
    else:
        activity_score = 0

    # Kinetic profile
    kinetic_profile = _compute_kinetic_profile(
        gray_frames, mask, mask_indices, cx, cy, radius, fps,
        wide_diffs, bg_std, bg_timeline)
    kinetic_quality = _compute_kinetic_quality(activity_score, kinetic_profile)

    # Crop region with padding
    padding_ratio = 0.20
    size = max(bw, bh)
    padded = int(size * (1 + padding_ratio * 2))
    half = padded // 2

    crop_left = max(0, cx - half)
    crop_top = max(0, cy - half)
    crop_right = min(vid_w, cx + half)
    crop_bottom = min(vid_h, cy + half)

    # Extract crops from all frames
    crops = []
    for frame in color_frames:
        crop = frame[crop_top:crop_bottom, crop_left:crop_right]
        if crop.size > 0:
            crops.append(cv2.resize(crop, (OUTPUT_SIZE, OUTPUT_SIZE), interpolation=cv2.INTER_LANCZOS4))

    if not crops:
        raise ValueError("Empty crops for embryo")

    # Best frame selection (Laplacian variance = sharpness)
    best_idx = _select_best_frame(crops)
    best_frame = crops[best_idx]

    # Cumulative heatmap (motion map)
    cumulative_heat = np.zeros((vid_h, vid_w), dtype=np.float64)
    for wd in wide_diffs:
        cumulative_heat += wd.astype(np.float64)

    heat_crop = cumulative_heat[crop_top:crop_bottom, crop_left:crop_right]
    if heat_crop.max() > 0:
        heat_norm = (heat_crop / heat_crop.max() * 255).astype(np.uint8)
    else:
        heat_norm = np.zeros_like(heat_crop, dtype=np.uint8)
    heat_colored = cv2.applyColorMap(
        cv2.resize(heat_norm, (OUTPUT_SIZE, OUTPUT_SIZE), interpolation=cv2.INTER_LANCZOS4),
        cv2.COLORMAP_JET)

    # Composite: best frame | heatmap side by side
    composite = np.hstack((best_frame, heat_colored))

    # Encode images
    crop_jpg = cv2.imencode('.jpg', best_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])[1].tobytes()
    motion_jpg = cv2.imencode('.jpg', heat_colored, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes()
    composite_jpg = cv2.imencode('.jpg', composite, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes()

    # Upload to Storage
    emb_dir = f"{job_dir}/embryo_{emb_idx}"
    paths = {
        "crop_image_path": f"{emb_dir}/crop.jpg",
        "motion_map_path": f"{emb_dir}/motion.jpg",
        "composite_path": f"{emb_dir}/composite.jpg",
    }
    _upload_to_storage(sb, paths["crop_image_path"], crop_jpg)
    _upload_to_storage(sb, paths["motion_map_path"], motion_jpg)
    _upload_to_storage(sb, paths["composite_path"], composite_jpg)

    # DINOv2 embedding
    embedding = _get_embedding(best_frame)

    return {
        "index": emb_idx,
        "bbox": bbox,
        "crop_image_path": paths["crop_image_path"],
        "motion_map_path": paths["motion_map_path"],
        "composite_path": paths["composite_path"],
        "activity_score": activity_score,
        "kinetic_profile": kinetic_profile,
        "kinetic_quality_score": kinetic_quality,
        "embedding": embedding,
        # Temporary data for Gemini phase (popped before results are returned)
        "_crop_jpg": crop_jpg,
        "_motion_jpg": motion_jpg,
    }


def _call_gemini_with_retry(
    crop_jpg: bytes, motion_jpg: bytes,
    api_key: str, prompt: str | None, model_name: str,
    activity_score: int, kinetic_profile: dict, kinetic_quality: int,
    max_retries: int = 3,
) -> dict:
    """Call Gemini with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return _analyze_with_gemini(
                crop_jpg, motion_jpg, api_key, prompt, model_name,
                activity_score, kinetic_profile, kinetic_quality,
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


def _process_single_embryo(
    emb_idx: int, bbox: dict,
    color_frames: list, gray_frames: list,
    wide_diffs: list, bg_std: float, bg_timeline: list,
    vid_w: int, vid_h: int, fps: float,
    sb, job_dir: str, req: AnalyzeRequest,
) -> dict:
    """Process one embryo: kinetics, best frame, DINOv2, Gemini, upload (sequential fallback)."""
    result = _process_embryo_vision(
        emb_idx, bbox, color_frames, gray_frames,
        wide_diffs, bg_std, bg_timeline,
        vid_w, vid_h, fps, sb, job_dir,
    )
    crop_jpg = result.pop("_crop_jpg")
    motion_jpg = result.pop("_motion_jpg")
    result["gemini_analysis"] = _call_gemini_with_retry(
        crop_jpg, motion_jpg, req.gemini_api_key,
        req.prompt, req.model_name,
        result["activity_score"], result["kinetic_profile"],
        result["kinetic_quality_score"],
    )
    return result


# ═══════════════════════════════════════════════════════════
# BEST FRAME SELECTION
# ═══════════════════════════════════════════════════════════

def _select_best_frame(crops: list[np.ndarray]) -> int:
    """Select frame with highest sharpness (Laplacian variance)."""
    best_idx = 0
    best_score = -1.0
    for i, crop in enumerate(crops):
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


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

    # DINOv2 ONNX model expects 'image' + 'masks' inputs
    # 'masks' is a boolean scalar — pass False (no masking)
    masks = np.array(False, dtype=np.bool_)
    result = ort_session.run(None, {"image": arr, "masks": masks})
    return result[0][0].tolist()


# ═══════════════════════════════════════════════════════════
# GEMINI ANALYSIS
# ═══════════════════════════════════════════════════════════

DEFAULT_GEMINI_PROMPT = """Voce e um embriologista veterinario especialista em FIV bovina.

IMAGEM 1: Melhor frame do embriao (microscopio estereoscopico)
IMAGEM 2: Mapa de calor cinetico (vermelho = mais movimento ao longo do video)

DADOS CINETICOS MEDIDOS (computacional, NAO visual):
- Activity score: {activity_score}/100
- Kinetic quality: {kinetic_quality}/100
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
    activity_score: int, kinetic_profile: dict, kinetic_quality: int,
) -> dict:
    """Call Gemini with best frame + heatmap + kinetic data."""
    try:
        _ensure_gemini(api_key)

        prompt_template = custom_prompt or DEFAULT_GEMINI_PROMPT
        # Use str.replace() instead of str.format() to avoid conflict
        # with JSON curly braces in the prompt template
        prompt = prompt_template
        prompt = prompt.replace("{activity_score}", str(activity_score))
        prompt = prompt.replace("{kinetic_quality}", str(kinetic_quality))
        prompt = prompt.replace("{core_activity}", str(kinetic_profile.get("core_activity", 0)))
        prompt = prompt.replace("{periphery_activity}", str(kinetic_profile.get("periphery_activity", 0)))
        prompt = prompt.replace("{peak_zone}", str(kinetic_profile.get("peak_zone", "unknown")))
        prompt = prompt.replace("{temporal_pattern}", str(kinetic_profile.get("temporal_pattern", "unknown")))
        prompt = prompt.replace("{symmetry}", str(kinetic_profile.get("activity_symmetry", 1.0)))

        crop_image = Image.open(io.BytesIO(crop_jpg))
        motion_image = Image.open(io.BytesIO(motion_jpg))

        model = genai.GenerativeModel(model_name)
        response = model.generate_content([prompt, crop_image, motion_image])

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
        return {
            "classification": "Error",
            "reasoning": f"Gemini analysis failed: {str(e)[:200]}",
            "stage_code": None,
            "quality_grade": None,
            "visual_features": None,
            "kinetic_assessment": None,
            "confidence": "low",
        }


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


def _save_scores_to_db(sb, req, embryo_results: list, bboxes: list, job_dir: str):
    """Save embryo scores directly to Supabase DB. Called from Cloud Run."""
    # Fetch existing embryos for this acasalamento (include classificacao for auto-copy)
    resp = sb.table('embrioes').select('id, classificacao').eq(
        'lote_fiv_acasalamento_id', req.lote_fiv_acasalamento_id
    ).order('id').execute()
    existing_embryos = resp.data or []

    offset = req.embryo_offset

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
        db_idx = offset + emb["index"]
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
            "composite_path": emb.get("composite_path"),
            # Kinetics
            "kinetic_intensity": (emb.get("activity_score") or 0) / 100,
            "kinetic_harmony": (emb.get("kinetic_profile") or {}).get("activity_symmetry"),
            "kinetic_stability": (emb.get("kinetic_quality_score") or 0) / 100,
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
            score_record["embedding"] = json.dumps(embedding)  # pgvector expects string format

        scores_to_insert.append(score_record)

    if scores_to_insert:
        # Mark old scores as non-current
        emb_ids = [s["embriao_id"] for s in scores_to_insert]
        sb.table('embryo_scores').update({"is_current": False}).in_("embriao_id", emb_ids).execute()
        # Insert new scores — with retry if gemini_classification column doesn't exist yet
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

    # Mark job complete
    sb.table('embryo_analysis_queue').update({
        'status': 'completed',
        'completed_at': datetime.utcnow().isoformat(),
    }).eq('id', req.job_id).execute()

    logger.info(f"Saved {len(scores_to_insert)} scores to DB for job {req.job_id}")


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def _download_video(url: str) -> str:
    """Download video to temp file, return path."""
    resp = http_requests.get(url, timeout=120, stream=True)
    resp.raise_for_status()
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)
        return tmp.name


def _upload_to_storage(sb, path: str, data: bytes):
    """Upload bytes to Supabase Storage embryoscore bucket."""
    try:
        sb.storage.from_("embryoscore").upload(
            path, data, {"content-type": "image/jpeg", "upsert": "true"})
    except Exception as e:
        logger.error(f"Storage upload failed for {path}: {e}")


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
    kinetic_quality = _compute_kinetic_quality(activity_score, kinetic_profile)

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
        "kinetic_quality_score": kinetic_quality,
        "clean_frames": clean_frames_b64,
        "composite_frames": composite_frames_b64,
        "cumulative_heatmap": heatmap_b64,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
