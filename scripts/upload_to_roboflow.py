
import os
from roboflow import Roboflow

# USAGE: 
# 1. pip install roboflow
# 2. python scripts/upload_to_roboflow.py

def upload_dataset():
    api_key = input("Enter your Roboflow Private API Key: ").strip()
    workspace_url = input("Enter your Workspace URL (e.g., 'my-workspace'): ").strip()
    project_url = input("Enter your Project URL (e.g., 'bovine-embryo'): ").strip()
    
    rf = Roboflow(api_key=api_key)
    workspace = rf.workspace(workspace_url)
    project = workspace.project(project_url)

    dataset_path = "./dataset_raw/custom_lab" # Or wherever your images are
    
    if not os.path.exists(dataset_path):
        print(f"Directory {dataset_path} not found!")
        return

    print(f"Uploading images from {dataset_path}...")
    
    count = 0
    for file_name in os.listdir(dataset_path):
        if file_name.lower().endswith(('.jpg', '.jpeg', '.png')):
            file_path = os.path.join(dataset_path, file_name)
            try:
                # split='train' puts it in training set, batch_name groups them
                project.upload(file_path, batch_name="custom_upload_1", split="train")
                count += 1
                if count % 10 == 0:
                    print(f"Uploaded {count} images...")
            except Exception as e:
                print(f"Failed to upload {file_name}: {e}")

    print(f"Done! Uploaded {count} images.")

if __name__ == "__main__":
    upload_dataset()
