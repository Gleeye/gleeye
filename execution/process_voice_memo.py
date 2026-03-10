import os
import sys
import requests
import json
import time
import asyncio
from pathlib import Path
from notebooklm import NotebookLMClient, ArtifactType

# Configuration
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
# In a real app, these should be environment variables
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk")

def log(msg):
    print(f"[AI-Report] {msg}")

def download_file(url, local_path):
    log(f"Downloading audio from {url}...")
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    return False

async def process_voice_memo(audio_url, space_id, item_id, notebook_id=None):
    local_audio = f"/tmp/memo_{int(time.time())}.mp3"
    
    try:
        # 1. Download
        if not download_file(audio_url, local_audio):
            log("Failed to download audio.")
            return

        # 2. NotebookLM Integration
        log("Initializing NotebookLM Client...")
        async with await NotebookLMClient.from_storage() as client:
            
            # If notebook_id is not provided, find one
            if not notebook_id:
                log("Searching for suitable notebook...")
                notebooks = await client.notebooks.list()
                # Simple heuristic: find notebook starting with space_id or "Gleeye Project"
                target = next((n for n in notebooks if space_id[:8] in n.title or "Gleeye" in n.title), None)
                if target:
                    notebook_id = target.id
                    log(f"Using existing notebook: {target.title} ({notebook_id})")
                else:
                    log("No suitable notebook found. Creating one...")
                    nb = await client.notebooks.create(f"Gleeye Project: {space_id[:8]}")
                    notebook_id = nb.id
                    log(f"Created new notebook: {notebook_id}")

            # 3. Add Source
            log(f"Uploading audio file: {local_audio}")
            source = await client.sources.add_file(notebook_id, Path(local_audio))
            source_id = source.id
            log(f"Source added: {source_id}")

            # 4. Wait for processing
            log("Waiting for processing (shoud take 1-2 mins)...")
            # In a more robust implementation, we'd poll client.sources.get(notebook_id, source_id)
            # For now, we'll wait a bit and then attempt generation
            await asyncio.sleep(60) 

            # 5. Generate Report Artifact
            log("Generating Report artifact...")
            try:
                # generate_report returns a task or status depending on the lib
                # Usually there's a generate_report method in artifacts
                artifact_task = await client.artifacts.generate_report(notebook_id)
                log(f"Generation task started: {artifact_task.task_id}")
                
                # Wait for completion
                log("Waiting for artifact completion...")
                # await client.artifacts.wait_for_completion(notebook_id, artifact_task.task_id)
                
                # Poll for completion
                report_content = None
                for i in range(24): # 2 mins max
                    await asyncio.sleep(5)
                    artifacts = await client.artifacts.list(notebook_id)
                    # Find the artifact by task_id
                    report = next((a for a in artifacts if a.id == artifact_task.task_id), None)
                    
                    if report and report.is_completed:
                        log(f"Report completed! Fetching content...")
                        report_file = f"/tmp/report_{int(time.time())}.md"
                        await client.artifacts.download_report(notebook_id, report_file, artifact_id=report.id)
                        with open(report_file, 'r') as f:
                            report_content = f.read()
                        os.remove(report_file)
                        break
                    elif report and report.is_failed:
                        log("Artifact generation failed on server.")
                        break
                    
                if report_content:
                    log("Report content found!")
                    # 6. Save back to Supabase
                    save_report_to_supabase(report_content, space_id, item_id, audio_url)
                    return
                
                log("Timeout waiting for report generation or failed.")
            except Exception as e:
                log(f"Artifact generation failed: {e}")

    except Exception as e:
        log(f"Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(local_audio):
            os.remove(local_audio)

def save_report_to_supabase(content, space_id, item_id, audio_url):
    log("Saving report to Supabase Documents...")
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    try:
        # 1. Ensure Doc Space
        # Check if space exists
        res = requests.get(f"{SUPABASE_URL}/rest/v1/doc_spaces?space_ref=eq.{space_id}", headers=headers)
        if res.status_code == 200 and res.json():
            doc_space_id = res.json()[0]['id']
        else:
            log(f"Creating doc_space for space_ref {space_id}...")
            res = requests.post(f"{SUPABASE_URL}/rest/v1/doc_spaces", 
                               json={"space_ref": space_id}, headers=headers)
            if res.status_code != 201:
                log(f"Failed to create doc_space: {res.text}")
                return
            doc_space_id = res.json()[0]['id']

        # 2. Create Page
        title = f"Report: {time.strftime('%d/%m/%Y %H:%M')}"
        page_data = {
            "space_ref": doc_space_id,
            "title": title,
            "metadata": {"type": "ai_report", "source_audio": "provided"},
            "order_index": time.time()
        }
        res = requests.post(f"{SUPABASE_URL}/rest/v1/doc_pages", json=page_data, headers=headers)
        if res.status_code != 201:
            log(f"Failed to create doc_page: {res.text}")
            return
        page_id = res.json()[0]['id']

        # 3. Create Block (Markdown)
        block_data = {
            "page_ref": page_id,
            "type": "markdown",
            "content": {"text": content},
            "order_index": 0
        }
        res = requests.post(f"{SUPABASE_URL}/rest/v1/doc_blocks", json=block_data, headers=headers)
        if res.status_code == 201:
            log(f"SUCCESS: Report saved as page {page_id}")
            # 4. Cleanup Supabase Storage (New: delete after success)
            delete_from_supabase_storage(audio_url)
        else:
            log(f"Failed to create doc_block: {res.text}")

    except Exception as e:
        log(f"Supabase save error: {e}")

def delete_from_supabase_storage(url):
    # Extract path from URL: .../storage/v1/object/public/voice_memos/item_id/file.mp3
    try:
        path_part = url.split("/voice_memos/")[1]
        log(f"Cleaning up Supabase storage: {path_part}...")
        
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
        }
        
        res = requests.delete(f"{SUPABASE_URL}/storage/v1/object/voice_memos/{path_part}", headers=headers)
        if res.status_code == 200:
            log("Supabase storage cleaned up.")
        else:
            log(f"Failed to delete from storage: {res.text}")
    except Exception as e:
        log(f"Cleanup error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python process_voice_memo.py <audio_url> <space_id> <item_id> [notebook_id]")
        sys.exit(1)
    
    url = sys.argv[1]
    sid = sys.argv[2]
    iid = sys.argv[3]
    nid = sys.argv[4] if len(sys.argv) > 4 else None
    
    asyncio.run(process_voice_memo(url, sid, iid, nid))
