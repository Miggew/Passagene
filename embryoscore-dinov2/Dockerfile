FROM python:3.11-slim

WORKDIR /app

# System dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 git && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# PyTorch with CUDA 12.1 for GPU Cloud Run (L4)
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu121

RUN pip install --no-cache-dir \
    fastapi uvicorn pillow numpy opencv-python-headless python-multipart

COPY app.py .
COPY embryo_classifier.pth .

# Pre-download DINOv2 model during build (not at runtime)
RUN python -c "import torch; torch.hub.load('facebookresearch/dinov2', 'dinov2_vitb14')"

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
