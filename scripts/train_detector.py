#!/usr/bin/env python3
"""
train_detector.py — Treinar YOLO para detecção ultra-precisa de embriões.

Prepara o dataset a partir das coordenadas do banco de dados e treina 
um modelo YOLOv8 localmente ou no Cloud Run.

Requer:
  - ultralytics (pip install ultralytics)
  - Banco de dados populado com coordenadas validadas
"""

import os
import json
import requests
import cv2
import yaml
from pathlib import Path

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DATASET_DIR = Path("datasets/embryo_yolo")

def fetch_validated_data():
    """Busca embriões onde o biólogo concordou com o crop/score."""
    print("Buscando dados validados para treinamento do detector...")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # Pegar scores onde biólogo concordou
    url = f"{SUPABASE_URL}/rest/v1/embryo_scores?select=*,embrioes(identificacao)&biologo_concorda=eq.true"
    resp = requests.get(url, headers=headers)
    return resp.json()

def prepare_yolo_dataset(data):
    """Converte coordenadas do banco para o formato YOLO (center_x, center_y, w, h)."""
    (DATASET_DIR / "images").mkdir(parents=True, exist_ok=True)
    (DATASET_DIR / "labels").mkdir(parents=True, exist_ok=True)
    
    print(f"Preparando {len(data)} amostras...")
    
    for i, item in enumerate(data):
        # 1. Download da imagem original (plate_frame)
        # 2. Salvar label .txt
        # x_center, y_center, width, height (normalized 0-1)
        x = item['bbox_x_percent'] / 100
        y = item['bbox_y_percent'] / 100
        w = item['bbox_width_percent'] / 100
        h = item['bbox_height_percent'] / 100
        
        label_line = f"0 {x} {y} {w} {h}
"
        
        with open(DATASET_DIR / "labels" / f"emb_{i}.txt", "w") as f:
            f.write(label_line)
            
    # Criar data.yaml
    yolo_config = {
        "path": str(DATASET_DIR.absolute()),
        "train": "images",
        "val": "images",
        "names": {0: "embryo"}
    }
    
    with open(DATASET_DIR / "data.yaml", "w") as f:
        yaml.dump(yolo_config, f)

def train_yolo():
    """Roda o treinamento usando Ultralytics."""
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8n.pt") # Começa com modelo nano (leve)
        print("Iniciando treinamento YOLO...")
        model.train(data=str(DATASET_DIR / "data.yaml"), epochs=100, imgsz=640)
        print("Treinamento concluído! Modelo salvo em runs/detect/train/weights/best.pt")
    except ImportError:
        print("ERRO: ultralytics não instalado. Use 'pip install ultralytics'")

if __name__ == "__main__":
    # 1. Buscar dados
    # 2. Preparar pastas
    # 3. Treinar
    print("Este script automatiza a criação do 'Olho' do PassaGene.")
