import requests
import json

URL = "https://embryoscore-pipeline-ijq3pphvbq-uc.a.run.app/analyze"
PAYLOAD = {
    "video_url": "https://example.com/dummy_video.mp4",
    "job_id": "manual_test_001"
}

try:
    print(f"Sending request to {URL}...")
    resp = requests.post(URL, json=PAYLOAD, timeout=30)
    print(f"Status Code: {resp.status_code}")
    try:
        print("Body:", resp.json())
    except:
        print("Body (text):", resp.text)
except Exception as e:
    print(f"Error: {e}")
