import os
import shutil
import glob

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
OLD_DATASET_DIR = os.path.join(PROJECT_ROOT, 'datasets')
NEW_DATASET_DIR = os.path.join(PROJECT_ROOT, 'datasets_v2')

def setup_clean_dataset():
    print(f"=== Criando Dataset Limpo em {NEW_DATASET_DIR} ===")
    
    # 1. Create clean structure
    new_images_dir = os.path.join(NEW_DATASET_DIR, 'images')
    new_labels_dir = os.path.join(NEW_DATASET_DIR, 'labels')
    
    if os.path.exists(NEW_DATASET_DIR):
        print("Removendo versao anterior de datasets_v2...")
        shutil.rmtree(NEW_DATASET_DIR)
    
    os.makedirs(new_images_dir)
    os.makedirs(new_labels_dir)
    print("Diretorios criados.")

    # 2. Copy Images
    print("Copiando imagens...")
    count_img = 0
    # Search in old datasets dir recursively for images
    for root, dirs, files in os.walk(OLD_DATASET_DIR):
        # Skip if we are inside verify backup or something extraneous
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                src_path = os.path.join(root, file)
                dst_path = os.path.join(new_images_dir, file)
                shutil.copy2(src_path, dst_path)
                count_img += 1
    print(f"Total imagens copiadas: {count_img}")

    # 3. Copy Labels
    print("Copiando labels...")
    count_lbl = 0
    # Prioritize valid labels folder, also check backup
    label_sources = [
        os.path.join(OLD_DATASET_DIR, 'labels'),
        os.path.join(OLD_DATASET_DIR, 'labels_backup')
    ]
    
    copied_basenames = set()
    
    for lbl_dir in label_sources:
        if os.path.exists(lbl_dir):
            print(f"Verificando {lbl_dir}...")
            for file in os.listdir(lbl_dir):
                if file.endswith('.txt') and file != 'classes.txt':
                    if file not in copied_basenames:
                        src_path = os.path.join(lbl_dir, file)
                        dst_path = os.path.join(new_labels_dir, file)
                        # Check if empty (optional, but YOLO warned about empty labels, though empty is valid for negative samples)
                        # But user said they labeled everything.
                        shutil.copy2(src_path, dst_path)
                        copied_basenames.add(file)
                        count_lbl += 1
    
    print(f"Total labels copiados: {count_lbl}")
    
    # Copy classes.txt
    classes_src = os.path.join(OLD_DATASET_DIR, 'classes.txt')
    if os.path.exists(classes_src):
        shutil.copy2(classes_src, os.path.join(NEW_DATASET_DIR, 'classes.txt'))
        
    print("=== Dataset v2 Pronto! ===")

if __name__ == '__main__':
    setup_clean_dataset()
