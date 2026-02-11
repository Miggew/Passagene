"""
Cloud Run Frame Extractor — 4 endpoints:
  POST /extract-frame      — FFmpeg extrai 1 frame de vídeo → JPEG base64
  POST /crop-frame         — Pillow recorta bboxes de um frame → array de JPEG base64
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
