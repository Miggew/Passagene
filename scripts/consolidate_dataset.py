import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATASET_DIR = os.path.join(PROJECT_ROOT, 'datasets')

def consolidate():
    print("=== Consolidando Imagens em 'datasets/images' ===")
    
    target_dir = os.path.join(DATASET_DIR, 'images')
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"Criado diretorio alvo: {target_dir}")

    # Fontes potenciais de imagens baguncadas
    sources = ['Images', 'images_temp', 'images_wrong']
    
    count_moved = 0
    for src_name in sources:
        src_path = os.path.join(DATASET_DIR, src_name)
        if os.path.exists(src_path) and src_path != target_dir:
            print(f"Verificando fonte: {src_name}...")
            for filename in os.listdir(src_path):
                file_path = os.path.join(src_path, filename)
                if os.path.isfile(file_path):
                    # Mover para target
                    dest_path = os.path.join(target_dir, filename)
                    try:
                        if not os.path.exists(dest_path):
                            shutil.move(file_path, dest_path)
                            count_moved += 1
                        else:
                            # Se ja existe, apenas remove o duplicado da fonte (ou ignora)
                            # print(f"Arquivo ja existe no destino: {filename}")
                            pass
                    except Exception as e:
                        print(f"Erro ao mover {filename}: {e}")
            
            # Tentar remover diretorio vazio
            try:
                os.rmdir(src_path)
                print(f"Diretorio fonte removido: {src_name}")
            except:
                print(f"Diretorio fonte nao pode ser removido (provavelmente nao vazio): {src_name}")

    print(f"Total de arquivos movidos: {count_moved}")
    
    # Verificar totais
    n_images = len([f for f in os.listdir(target_dir) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
    print(f"Total de imagens agora em 'datasets/images': {n_images}")
    
    # Limpar Caches
    for root, dirs, files in os.walk(DATASET_DIR):
        for file in files:
            if file.endswith('.cache'):
                try:
                    os.remove(os.path.join(root, file))
                    print(f"Cache removido: {file}")
                except: pass

if __name__ == '__main__':
    consolidate()
