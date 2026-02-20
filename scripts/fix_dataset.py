import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATASET_DIR = os.path.join(PROJECT_ROOT, 'datasets')

def fix_dataset():
    print("=== Corrigindo nomes de pasta do Dataset ===")
    
    images_path_wrong = os.path.join(DATASET_DIR, 'Images')
    images_path_correct = os.path.join(DATASET_DIR, 'images')
    
    # Check if 'Images' exists (Capital I)
    if os.path.exists(images_path_wrong) and not os.path.exists(images_path_correct):
        print(f"Renomeando '{images_path_wrong}' para '{images_path_correct}'...")
        try:
            # On Windows, simple rename might ignore case, so we do specific temp rename
            os.rename(images_path_wrong, os.path.join(DATASET_DIR, 'images_temp'))
            os.rename(os.path.join(DATASET_DIR, 'images_temp'), images_path_correct)
            print("Sucesso!")
        except Exception as e:
            print(f"Erro ao renomear: {e}")
            # Fallback: Copy and remove
            try:
                shutil.copytree(images_path_wrong, images_path_correct)
                shutil.rmtree(images_path_wrong)
                print("Sucesso (via copy/delete)!")
            except Exception as e2:
                print(f"Erro fatal: {e2}")
                
    elif os.path.exists(images_path_wrong) and os.path.exists(images_path_correct):
        # Both exist (maybe different casing on disk?)
        # Let's ensure content is in 'images'
        print("Ambas as pastas existem. Consolidando em 'images'...")
        for f in os.listdir(images_path_wrong):
            shutil.move(os.path.join(images_path_wrong, f), os.path.join(images_path_correct, f))
        os.rmdir(images_path_wrong)
        print("Consolidado.")
        
    # Clear Cache
    print("Limpando caches...")
    for root, dirs, files in os.walk(DATASET_DIR):
        for file in files:
            if file.endswith('.cache'):
                try:
                    os.remove(os.path.join(root, file))
                    print(f"Removido: {file}")
                except: pass

if __name__ == '__main__':
    fix_dataset()
