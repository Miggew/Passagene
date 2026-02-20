
import os
import requests
import json

# USAGE:
# python scripts/extract_frames.py

# Env vars will be passed via command line
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BUCKET_NAME = 'embryo-videos'
OUTPUT_DIR = './dataset_raw/custom_lab'

if not url or not key:
    print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required.")
    exit(1)

# Clean URL
url = url.rstrip('/')

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    print(f"Checking bucket: {BUCKET_NAME}...")

    # Headers for Supabase API
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }

    # 1. List files in bucket
    # POST /storage/v1/object/list/{bucket}
    list_endpoint = f"{url}/storage/v1/object/list/{BUCKET_NAME}"
    try:
        # Supabase Storage list often requires a prefix in body, or empty for root
        resp = requests.post(list_endpoint, headers=headers, json={"prefix": "", "limit": 100, "sortBy": {"column": "created_at", "order": "desc"}})
        if resp.status_code != 200:
            print(f"Error listing files: {resp.status_code} - {resp.text}")
            return
        
        files = resp.json()
    except Exception as e:
        print(f"Exception listing files: {e}")
        return

    if not files:
        print("No files found or empty bucket.")
        return

    print(f"File list sample: {files[:2]}") # DEBUG
    
    count = 0
    for file in files:
        if count >= 20:
            break
        
        name = file.get('name')
        if not name: 
            print(f"Skipping file without name: {file}")
            continue
            
        print(f"File found: {name}") # DEBUG
        
        if not name: 
            print(f"Skipping file without name: {file}")
            continue
            
        print(f"Dowloading potential file: {name}") 
        
        # Download URL
        download_url = f"{url}/storage/v1/object/{BUCKET_NAME}/{name}"
        
        try:
            with requests.get(download_url, headers=headers, stream=True) as r:
                r.raise_for_status()
                
                # Try to guess extension from Content-Type if name doesn't have one
                content_type = r.headers.get('Content-Type', '')
                ext = ""
                if "." not in name:
                    if "video/mp4" in content_type: ext = ".mp4"
                    elif "image/jpeg" in content_type: ext = ".jpg"
                    elif "image/png" in content_type: ext = ".png"
                    
                local_name = name + ext
                file_path = os.path.join(OUTPUT_DIR, local_name)
                
                with open(file_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"Saved to {file_path} (Type: {content_type})")
            count += 1
        except Exception as e:
            print(f"Failed to download {name}: {e}")

    print(f"Downloaded {count} files to {OUTPUT_DIR}")
    print("Next Step: Run 'python scripts/upload_to_roboflow.py' to upload them.")

if __name__ == "__main__":
    main()
