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
    temp_notebook_id = None
    
    try:
        # 1. Download
        if not download_file(audio_url, local_audio):
            log("Failed to download audio.")
            return

        # 2. NotebookLM Integration
        log("Initializing NotebookLM Client...")
        async with await NotebookLMClient.from_storage() as client:
            
            # ALWAYS create a fresh notebook to avoid mixing info from other sources
            log("Creating temporary notebook for this report...")
            nb = await client.notebooks.create(f"TEMP AI Report: {int(time.time())}")
            temp_notebook_id = nb.id
            log(f"Created temporary notebook: {temp_notebook_id}")

            # 3. Add Source
            log(f"Uploading audio file: {local_audio}")
            source = await client.sources.add_file(temp_notebook_id, Path(local_audio))
            source_id = source.id
            log(f"Source added: {source_id}")

            # 4. Wait for processing (polling source status)
            log("Waiting for audio processing...")
            for _ in range(30): # 5 mins max
                data = await client.sources.get(temp_notebook_id, source_id)
                if data.is_completed:
                    log("Audio processing complete.")
                    break
                if data.is_failed:
                    log("Audio processing failed.")
                    return
                await asyncio.sleep(10)
            else:
                log("Audio processing timeout.")
                return

            # 5. Generate Report Artifact (in Italian)
            log("Generating Italian Report artifact...")
            try:
                # Set language=it for Italian output
                artifact_task = await client.artifacts.generate_report(temp_notebook_id, language="it")
                log(f"Generation task started: {artifact_task.task_id}")
                
                # Poll for completion
                report_content = None
                for i in range(24): # 2 mins max
                    await asyncio.sleep(5)
                    artifacts = await client.artifacts.list(temp_notebook_id)
                    report = next((a for a in artifacts if a.id == artifact_task.task_id), None)
                    
                    if report and report.is_completed:
                        log(f"Report completed! Fetching content...")
                        report_file = f"/tmp/report_{int(time.time())}.md"
                        await client.artifacts.download_report(temp_notebook_id, report_file, artifact_id=report.id)
                        with open(report_file, 'r') as f:
                            report_content = f.read()
                        os.remove(report_file)
                        break
                    elif report and report.is_failed:
                        log("Artifact generation failed on server.")
                        break
                    
                if report_content:
                    log("Report content found!")
                    # Clean markdown symbols for cleaner display in Gleeye
                    clean_content = clean_report_content(report_content)
                    # 6. Save back to Supabase
                    save_report_to_supabase(clean_content, space_id, item_id, audio_url)
                    return
                
                log("Timeout waiting for report generation or failed.")
            except Exception as e:
                log(f"Artifact generation failed: {e}")

    except Exception as e:
        log(f"Error during processing: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup
        if os.path.exists(local_audio):
            os.remove(local_audio)
        if temp_notebook_id:
            try:
                log(f"Deleting temporary notebook: {temp_notebook_id}...")
                async with await NotebookLMClient.from_storage() as client:
                    await client.notebooks.delete(temp_notebook_id)
                log("Temporary notebook deleted.")
            except Exception as e:
                log(f"Failed to delete temp notebook: {e}")

def clean_report_content(content):
    """
    Remove markdown symbols for a cleaner appearance as requested.
    Transforms headers into uppercase and removes bold/italic markers.
    """
    import re
    # 1. Transform headers: remove # and make uppercase
    def header_replace(match):
        return "\n" + match.group(1).strip().upper() + "\n" + "-" * len(match.group(1).strip()) + "\n"
    
    # Replace #, ##, ### titles
    content = re.sub(r'^#+\s*(.*)$', header_replace, content, flags=re.MULTILINE)
    
    # 2. Remove bold ** and italics _ or *
    content = content.replace('**', '')
    content = re.sub(r'[*_](.*?)[*_]', r'\1', content)
    
    # 3. Clean multiple newlines
    content = re.sub(r'\n{3,}', '\n\n', content)
    
    return content.strip()



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
