import os
import requests
from supabase import create_client

def verify():
    print("🔍 Verificando Ambiente PassaGene Elite AI...")
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    dinov2 = os.environ.get("DINOV2_CLOUD_RUN_URL")
    
    if not all([url, key, dinov2]):
        print("❌ ERRO: Variáveis de ambiente faltando (SUPABASE_URL, SUPABASE_SERVICE_KEY, DINOV2_CLOUD_RUN_URL)")
        return

    try:
        sb = create_client(url, key)
        print("✅ Conexão com Supabase: OK")
    except Exception as e:
        print(f"❌ Falha Supabase: {e}")

    try:
        resp = requests.get(f"{dinov2}/health", timeout=10)
        print(f"✅ Conexão com DINOv2 (Cloud Run): {resp.status_code} OK")
    except Exception as e:
        print(f"❌ Falha DINOv2: {e}")

if __name__ == "__main__":
    verify()
