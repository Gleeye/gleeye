import os
import time
import asyncio
from supabase import create_client, Client
import importlib.util
from pathlib import Path

# Configuration
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Import process_voice_memo logic
def loader():
    spec = importlib.util.spec_from_file_location("pvm", "execution/process_voice_memo.py")
    pvm = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pvm)
    return pvm

pvm = loader()

def log(msg):
    print(f"[AI-Worker] {msg}")

async def run_worker():
    log("Gleeye AI Worker started. Monitoring pm_ai_report_jobs...")
    
    while True:
        try:
            # 1. Fetch pending jobs
            res = supabase.table("pm_ai_report_jobs")\
                .select("*")\
                .eq("status", "pending")\
                .order("created_at")\
                .limit(1)\
                .execute()
            
            if not res.data:
                await asyncio.sleep(10) # Wait 10 seconds before next check
                continue
            
            job = res.data[0]
            job_id = job['id']
            audio_url = job['audio_url']
            space_id = job['space_ref']
            item_id = job['item_ref']
            
            log(f"Processing job {job_id} for item {item_id}...")
            
            # 2. Mark as processing
            supabase.table("pm_ai_report_jobs")\
                .update({"status": "processing", "updated_at": "now()"})\
                .eq("id", job_id)\
                .execute()
            
            try:
                # 3. Execute processing
                # Reload PVM to ensure we use the latest script version
                pvm_fresh = loader()
                await pvm_fresh.process_voice_memo(audio_url, space_id, item_id)
                
                # 4. Mark as completed
                supabase.table("pm_ai_report_jobs")\
                    .update({"status": "completed", "updated_at": "now()"})\
                    .eq("id", job_id)\
                    .execute()
                log(f"Job {job_id} success.")
                
            except Exception as e:
                log(f"Job {job_id} failed: {e}")
                supabase.table("pm_ai_report_jobs")\
                    .update({
                        "status": "failed", 
                        "error_message": str(e),
                        "updated_at": "now()"
                    })\
                    .eq("id", job_id)\
                    .execute()
                    
        except Exception as e:
            log(f"Worker iteration error: {e}")
            await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(run_worker())
