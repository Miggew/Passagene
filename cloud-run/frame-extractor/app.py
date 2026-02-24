"""
Cloud Run Frame Extractor — 5 endpoints:
  POST /extract-frame      — FFmpeg extrai 1 frame de vídeo → JPEG base64
  POST /crop-frame         — Pillow recorta bboxes de um frame → array de JPEG base64
  POST /detect-and-crop    — OpenCV detecta embriões + extrai crops (substitui Gemini)
  POST /extract-and-crop   — Extrai crops com bboxes já conhecidas
  POST /analyze-activity   — Análise cinética por embrião → kinetic_profile + frames
  GET  /health             — Health check
"""

import base64
import io
import os
import subprocess
import tempfile
import traceback as _tb

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
    data = request.get_json(force=True)
    video_url = data.get("video_url")
    position = data.get("position", 0.5)

    if not video_url:
        return jsonify({"error": "video_url é obrigatório"}), 400

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
        duration = _get_duration(tmp_path)
        if duration <= 0:
            duration = 10.0

        for pos in [position, 0.25, 0.1]:
            seek_time = max(0.1, duration * pos)

            # Burst de 5 frames ao redor do timestamp alvo
            offsets = [-0.2, -0.1, 0.0, 0.1, 0.2]
            candidates = []

            for offset in offsets:
                t = max(0.1, min(duration - 0.1, seek_time + offset))
                frame_bytes = _extract_frame_ffmpeg(tmp_path, t)
                if frame_bytes and not _is_black_frame(frame_bytes):
                    score = _compute_focus_score(frame_bytes)
                    candidates.append((frame_bytes, score))

            if candidates:
                # Seleciona o frame matematicamente mais nítido
                best_bytes, best_score = max(candidates, key=lambda c: c[1])
                img = Image.open(io.BytesIO(best_bytes))
                b64 = base64.b64encode(best_bytes).decode("ascii")
                return jsonify({
                    "frame_base64": b64,
                    "width": img.width,
                    "height": img.height,
                    "focus_score": round(best_score, 2),
                })

        return jsonify({"error": "Todos os frames extraídos estão pretos"}), 422
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.route("/detect-circles", methods=["POST"])
def detect_circles():
    """CV Clássica: Detecta candidatos a embrião usando HoughCircles."""
    data = request.get_json(force=True)
    frame_b64 = data.get("frame_base64")
    
    if not frame_b64:
        return jsonify({"error": "frame_base64 é obrigatório"}), 400

    try:
        img_bytes = base64.b64decode(frame_b64)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Falha ao decodificar imagem"}), 400

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_blurred = cv2.medianBlur(gray, 5)
        
        rows = gray_blurred.shape[0]
        
        # Parametros calibrados para embriões em estereomicroscópio
        circles = cv2.HoughCircles(
            gray_blurred, 
            cv2.HOUGH_GRADIENT, 
            dp=1, 
            minDist=rows/10,
            param1=100, 
            param2=30,
            minRadius=int(rows/30), 
            maxRadius=int(rows/6)
        )
        
        results = []
        if circles is not None:
            circles = np.uint16(np.around(circles))
            for i in circles[0, :]:
                cx, cy, r = int(i[0]), int(i[1]), int(i[2])
                
                # Análise de textura local (Variância)
                mask = np.zeros_like(gray)
                cv2.circle(mask, (cx, cy), int(r*0.7), 255, -1)
                mean_val, std_dev = cv2.meanStdDev(gray, mask=mask)
                texture_score = float(std_dev[0][0])
                
                results.append({
                    "x": int(i[0]), "y": int(i[1]), "r": int(i[2]),
                    "texture_score": texture_score
                })
                
        results.sort(key=lambda x: x["texture_score"], reverse=True)
        return jsonify({"circles": results})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/crop-frame", methods=["POST"])
def crop_frame():
    data = request.get_json(force=True)
    frame_b64 = data.get("frame_base64")
    bboxes = data.get("bboxes", [])
    padding = data.get("padding", 0.20)
    output_size = data.get("output_size", 400)

    if not frame_b64 or not bboxes:
        return jsonify({"error": "Dados incompletos"}), 400

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

        left = max(0, center_x - padded / 2)
        top = max(0, center_y - padded / 2)
        right = min(fw, center_x + padded / 2)
        bottom = min(fh, center_y + padded / 2)

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
    data = request.get_json(force=True)
    video_url = data.get("video_url")
    bboxes = data.get("bboxes", [])
    frame_count = data.get("frame_count", 40)

    if not video_url: return jsonify({"error": "video_url missing"}), 400

    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp_path = tmp.name
            for chunk in resp.iter_content(chunk_size=8192): tmp.write(chunk)

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened(): return jsonify({"error": "Erro vídeo"}), 422

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        step = max(1, total // frame_count)
        
        embryo_crops = {str(i): [] for i in range(len(bboxes))}
        plate_frame_b64 = None
        frame_idx = 0
        extracted = 0

        # Skip first 5 frames to avoid fade-in/blur
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(5, total_frames - 1))
        frame_idx = 0

        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret: break
            if frame_idx % step == 0:
                h, w = frame.shape[:2]
                if plate_frame_b64 is None:
                    _, plate_jpg = cv2.imencode(
                        ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 95]
                    )
                    plate_frame_b64 = base64.b64encode(
                        plate_jpg.tobytes()
                    ).decode("ascii")

                for i, bbox in enumerate(bboxes):
                    x_pct = bbox.get("x_percent", 50)
                    y_pct = bbox.get("y_percent", 50)
                    w_pct = bbox.get("width_percent", 10)
                    h_pct = bbox.get("height_percent", 10)

                    size = max(w_pct, h_pct) / 100
                    padded = size * 1.4
                    cx, cy = x_pct/100, y_pct/100
                    
                    x1 = int(max(0, (cx - padded/2)) * w)
                    y1 = int(max(0, (cy - padded/2)) * h)
                    x2 = int(min(1, (cx + padded/2)) * w)
                    y2 = int(min(1, (cy + padded/2)) * h)

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
        os.unlink(tmp_path)
        return jsonify({
            "embryos": embryo_crops,
            "plate_frame_b64": plate_frame_b64,
            "frames_extracted": extracted
        })
    except Exception as e:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        return jsonify({"error": str(e)}), 500


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
    data = request.get_json(force=True)
    video_url = data.get("video_url")
    bboxes = data.get("bboxes", [])
    fps = data.get("fps", 8)
    
    if not video_url: return jsonify({"error": "video_url missing"}), 400

    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp_path = tmp.name
            for chunk in resp.iter_content(chunk_size=8192): tmp.write(chunk)

        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        vid_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        vid_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        vid_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        sample_interval = max(1, round(vid_fps / fps))
        indices = list(range(0, total_frames, sample_interval))
        
        gray_frames = []
        color_frames = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret: break
            color_frames.append(frame)
            gray_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
        
        cap.release()
        os.unlink(tmp_path)

        if len(gray_frames) < 2: return jsonify({"error": "Video too short"}), 422

        # Análise Simplificada para este arquivo (Logic completa no original)
        # Calcula apenas activity score básico para testar integração
        results = []
        scores = []
        
        # Máscara de ruído de fundo
        all_mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
        for b in bboxes:
            cx = int(b.get("x_percent", 50)/100 * vid_w)
            cy = int(b.get("y_percent", 50)/100 * vid_h)
            r = int(b.get("width_percent", 10)/100 * vid_w / 2)
            cv2.circle(all_mask, (cx, cy), int(r*1.3), 255, -1)
            
        bg_std = 0.0
        bg_idx = all_mask == 0
        if np.sum(bg_idx) > 100:
            bg_stack = np.stack([g[bg_idx].astype(np.float32) for g in gray_frames], axis=0)
            bg_std = float(np.mean(np.std(bg_stack, axis=0)))

        for i, bbox in enumerate(bboxes):
            x_pct = bbox.get("x_percent", 50)
            y_pct = bbox.get("y_percent", 50)
            w_pct = bbox.get("width_percent", 10)
            
            cx = int(x_pct/100 * vid_w)
            cy = int(y_pct/100 * vid_h)
            r = int(w_pct/100 * vid_w / 2)
            
            mask = np.zeros((vid_h, vid_w), dtype=np.uint8)
            cv2.circle(mask, (cx, cy), r, 255, -1)
            
            pixel_vals = [g[mask>0].astype(np.float32) for g in gray_frames]
            if len(pixel_vals) >= 2:
                stack = np.stack(pixel_vals, axis=0)
                std = np.std(stack, axis=0)
                mean_std = float(np.mean(std))
                score = int(min(100, max(0, (mean_std - bg_std) * 100 / 15)))
            else:
                score = 0
            
            scores.append(score)
            
            # Gerar best frame (meio do vídeo)
            mid = len(color_frames)//2
            crop_size = max(bbox.get("width_percent",10), bbox.get("height_percent",10))/100
            pad = int(crop_size * vid_w * 1.4 / 2)
            x1 = max(0, cx-pad)
            y1 = max(0, cy-pad)
            x2 = min(vid_w, cx+pad)
            y2 = min(vid_h, cy+pad)
            
            crop = color_frames[mid][y1:y2, x1:x2]
            if crop.size > 0:
                rez = cv2.resize(crop, (400,400))
                _, buf = cv2.imencode(".jpg", rez)
                best_frame = base64.b64encode(buf.tobytes()).decode("ascii")
            else:
                best_frame = ""

            results.append({
                "index": i,
                "activity_score": score,
                "clean_frames": [best_frame],
                "kinetic_profile": {"intensity": score},
                "kinetic_quality_score": score # Simplificado
            })

        return jsonify({
            "activity_scores": scores,
            "embryos": results
        })

    except Exception as e:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        return jsonify({"error": str(e)}), 500

# Helpers
def _compute_focus_score(frame_bytes: bytes) -> float:
    """Variância do Laplaciano — métrica matemática de nitidez."""
    try:
        np_arr = np.frombuffer(frame_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0.0
        return float(cv2.Laplacian(img, cv2.CV_64F).var())
    except:
        return 0.0


def _get_duration(path: str) -> float:
    try:
        res = subprocess.run(["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
        return float(res.stdout.strip())
    except: return 0.0

def _extract_frame_ffmpeg(path: str, seek: float) -> bytes | None:
    try:
        res = subprocess.run(["ffmpeg", "-ss", f"{seek:.2f}", "-i", path, "-frames:v", "1", "-q:v", "2", "-f", "image2", "-vcodec", "mjpeg", "pipe:1"], capture_output=True)
        return res.stdout if len(res.stdout) > 1000 else None
    except: return None

def _is_black_frame(b: bytes) -> bool:
    try:
        img = Image.open(io.BytesIO(b)).convert("RGB")
        w,h = img.size
        # Sample center
        crop = img.crop((int(w*0.4), int(h*0.4), int(w*0.6), int(h*0.6)))
        data = list(crop.getdata())
        bright = sum(1 for p in data if sum(p) > 30)
        return (bright / len(data)) < 0.05
    except: return True

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
