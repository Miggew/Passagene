
import asyncio
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

async def check_queue():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        # Fetch the latest 5 jobs from the queue
        response = supabase.table("embryo_analysis_queue").select("*").order("created_at", desc=True).limit(5).execute()
        jobs = response.data

        print(f"Found {len(jobs)} recent jobs:")
        for job in jobs:
            print(f"ID: {job['id']}")
            print(f"  Status: {job['status']}")
            print(f"  Video URL: {job['video_url']}")
            print(f"  Error: {job.get('error_message', 'None')}")
            print(f"  Created At: {job['created_at']}")
            print("-" * 30)

    except Exception as e:
        print(f"Error fetching queue: {e}")

if __name__ == "__main__":
    asyncio.run(check_queue())
