from ultralytics import YOLO
import os
import yaml

# Caminhos Absolutos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATASET_DIR = os.path.join(PROJECT_ROOT, 'datasets_v2')

def train():
    print("=== TREINAMENTO DE MODELO EMBRYO DETECT (YOLOv8) ===")
    
    # 0. Limpar cache antigo para evitar problemas de labels nao encontrados
    for root, dirs, files in os.walk(DATASET_DIR):
        for file in files:
            if file.endswith('.cache'):
                try:
                    os.remove(os.path.join(root, file))
                    print(f"Cache removido: {file}")
                except:
                    pass

    # 1. Verificar imagens e labels
    images_dir = os.path.join(DATASET_DIR, 'images')
    labels_dir = os.path.join(DATASET_DIR, 'labels')
    
    n_images = len([f for f in os.listdir(images_dir) if f.endswith(('.jpg', '.png', '.jpeg'))])
    n_labels = len([f for f in os.listdir(labels_dir) if f.endswith('.txt')])
    
    print(f"Imagens encontradas: {n_images}")
    print(f"Labels encontrados: {n_labels}")
    
    if n_images == 0:
        print("ERRO: Nenhuma imagem encontrada em datasets/images")
        return
        
    if n_labels == 0:
        print("AVISO: Nenhum label encontrado. Voce precisa rotular as imagens antes de treinar.")
        input("Pressione ENTER para sair...")
        return

    yaml_content = {
        'path': DATASET_DIR,
        'train': 'images',
        'val': 'images',  # Usando as mesmas imagens para validacao (simplificado para caso de uso rapido)
        'nc': 1,
        'names': ['embriao']
    }
    
    yaml_path = os.path.join(DATASET_DIR, 'data.yaml')
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f)
        
    print(f"Arquivo de configuracao criado: {yaml_path}")
    
    # 3. Baixar/Carregar modelo pré-treinado
    print("Carregando modelo YOLOv8n (nano)...")
    try:
        model = YOLO('yolov8n.pt')  # baixa automaticamente
    except Exception as e:
        print(f"Erro ao baixar modelo: {e}")
        return

    # 4. Treinar
    print("Iniciando treinamento... Isso pode demorar alguns minutos (ou horas se nao tiver GPU).")
    print("Pressione Ctrl+C para cancelar a qualquer momento.")
    
    try:
        results = model.train(
            data=yaml_path,
            epochs=100,      # Pode ser ajustado
            imgsz=640,
            batch=16,
            name='embryo_custom_model'
        )
        
        print("=== TREINAMENTO CONCLUIDO ===")
        print(f"Melhor modelo salvo em: {results.save_dir}/weights/best.pt")
        print("Copie este arquivo para 'cloud-run/frame-extractor' para usar na deteccao.")
        
    except Exception as e:
        print(f"Erro durante treinamento: {e}")

if __name__ == '__main__':
    train()
    input("\nPressione ENTER para fechar...")
