"""
Cloud Run Frame Extractor — 5 endpoints:
  POST /extract-frame      — FFmpeg extrai 1 frame de vídeo → JPEG base64
  POST /crop-frame         — Pillow recorta bboxes de um frame → array de JPEG base64
  POST /extract-and-crop   — Extrai múltiplos frames e recorta por embrião
  POST /detect-circles     — OpenCV HoughCircles para detectar candidatos geométricos
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

        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret: break
            if frame_idx % step == 0:
                h, w = frame.shape[:2]
                if plate_frame_b64 is None:
                    _, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    plate_frame_b64 = base64.b64encode(jpg.tobytes()).decode("ascii")

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
                        resized = cv2.resize(crop, (400, 400), interpolation=cv2.INTER_LANCZOS4)
                        _, jpg = cv2.imencode(".jpg", resized, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        embryo_crops[str(i)].append(base64.b64encode(jpg.tobytes()).decode("ascii"))
                
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
