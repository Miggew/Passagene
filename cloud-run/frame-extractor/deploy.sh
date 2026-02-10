#!/bin/bash
# Deploy frame-extractor para Cloud Run
# Uso: faça upload deste arquivo no Cloud Shell e rode: bash deploy.sh
set -e

echo "=== Criando diretorio ==="
mkdir -p ~/frame-extractor
cd ~/frame-extractor

echo "=== Criando Dockerfile ==="
cat > Dockerfile << 'DOCKEREOF'
FROM python:3.11-slim
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "app:app"]
DOCKEREOF

echo "=== Criando requirements.txt ==="
cat > requirements.txt << 'REQEOF'
flask==3.0.*
gunicorn==21.2.*
Pillow==10.2.*
requests==2.31.*
REQEOF

echo "=== Criando app.py ==="
cat > app.py << 'PYEOF'
"""
Cloud Run Frame Extractor — 2 endpoints:
  POST /extract-frame  — FFmpeg extrai 1 frame de video → JPEG base64
  POST /crop-frame     — Pillow recorta bboxes de um frame → array de JPEG base64

Stateless. Sem credenciais Supabase — recebe signed URLs.
"""

import base64
import io
import os
import subprocess
import tempfile

import requests as http_requests
from flask import Flask, jsonify, request
from PIL import Image

app = Flask(__name__)


@app.route("/extract-frame", methods=["POST"])
def extract_frame():
    """
    Input:  { video_url: str, position: float (0-1) }
    Output: { frame_base64: str, width: int, height: int }

    Baixa video via signed URL → FFmpeg extrai 1 frame → JPEG base64.
    Se frame sair preto, tenta posicoes 0.25 e 0.1 como fallback.
    """
    data = request.get_json(force=True)
    video_url = data.get("video_url")
    position = data.get("position", 0.5)

    if not video_url:
        return jsonify({"error": "video_url e obrigatorio"}), 400

    # Download do video para arquivo temporario
    try:
        resp = http_requests.get(video_url, timeout=120, stream=True)
        resp.raise_for_status()
    except Exception as e:
        return jsonify({"error": f"Falha ao baixar video: {str(e)[:200]}"}), 400

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
        for chunk in resp.iter_content(chunk_size=8192):
            tmp.write(chunk)

    try:
        # Obter duracao do video
        duration = _get_duration(tmp_path)
        if duration <= 0:
            duration = 10.0  # fallback

        # Tentar posicao principal; se frame preto, fallback
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

        return jsonify({"error": "Todos os frames extraidos estao pretos"}), 422
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
        return jsonify({"error": "frame_base64 e obrigatorio"}), 400
    if not bboxes:
        return jsonify({"error": "bboxes e obrigatorio"}), 400

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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# --- Helpers ---


def _get_duration(path):
    """Obtem duracao do video em segundos via ffprobe."""
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


def _extract_frame_ffmpeg(path, seek_time):
    """Extrai 1 frame JPEG na posicao seek_time."""
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


def _is_black_frame(frame_bytes):
    """Verifica se frame e essencialmente preto (amostra central)."""
    try:
        img = Image.open(io.BytesIO(frame_bytes)).convert("RGB")
        w, h = img.size
        # Amostrar regiao central (25%)
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
PYEOF

echo "=== Arquivos criados ==="
ls -la

echo ""
echo "=== Iniciando deploy para Cloud Run ==="
echo "(Isso pode levar 3-5 minutos na primeira vez)"
echo ""
gcloud run deploy frame-extractor \
  --source . \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 5 \
  --min-instances 0 \
  --timeout 120 \
  --allow-unauthenticated

echo ""
echo "=========================================="
echo "  DEPLOY CONCLUIDO!"
echo "=========================================="
echo ""
echo "Copie a URL do servico acima (algo como https://frame-extractor-xxxxx-uc.a.run.app)"
echo "e configure no Supabase com:"
echo "  npx supabase secrets set FRAME_EXTRACTOR_URL=<URL_ACIMA>"
