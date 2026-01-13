import requests
import csv
import io
import re
import os
import mimetypes

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE_PATH = 'tabelle_airtable/Registro Movimenti.csv'
STORAGE_BUCKET = 'invoices'
STORAGE_FOLDER = 'transaction_attachments'

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def fetch_transaction_id(old_id):
    url = f"{SUPABASE_URL}/rest/v1/bank_transactions?select=id&old_id=eq.{old_id}&limit=1"
    r = requests.get(url, headers=HEADERS)
    if r.status_code == 200 and len(r.json()) > 0:
        return r.json()[0]['id']
    return None

def upload_to_storage(filename, content, content_type):
    # Sanitize filename
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    path = f"{STORAGE_FOLDER}/{safe_filename}"
    
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true" 
    }
    
    r = requests.post(url, data=content, headers=headers)
    if r.status_code == 200:
        # Construct Public URL
        # For public buckets:
        return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    else:
        print(f"❌ Storage upload failed: {r.text}")
        return None

def main():
    print("🚀 Starting Attachment Import...")
    
    with open(CSV_FILE_PATH, mode='r', encoding='utf-8-sig', errors='replace') as f:
        content = f.read().replace('\x00', '')
        
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    print(f"Processing {len(rows)} rows...")
    
    processed_count = 0
    success_count = 0
    
    for row in rows:
        old_id = row.get('Name')
        allegati = row.get('Allegati')
        
        if not old_id or not allegati:
            continue
            
        processed_count += 1
        
        # Parse Allegati: "filename.pdf (url)"
        # Regex to find URL in parens
        match = re.search(r'\((https://[^)]+)\)', allegati)
        if not match:
            print(f"⚠️ Could not parse attachment URL for {old_id}: {allegati[:30]}...")
            continue
            
        file_url = match.group(1)
        
        # Extract filename (everything before the open paren, trimmed)
        filename = allegati.split('(')[0].strip()
        if not filename:
            filename = f"attachment_{old_id}.pdf" # Fallback
            
        print(f"Processing {old_id}: {filename}")
        
        # 1. Check if transaction exists
        trans_id = fetch_transaction_id(old_id)
        if not trans_id:
            print(f"⚠️ Transaction {old_id} not found in DB. Skipping.")
            continue
            
        # 2. Download File
        try:
            file_resp = requests.get(file_url)
            if file_resp.status_code != 200:
                print(f"❌ Failed to download file from Airtable: {file_resp.status_code}")
                continue
                
            content = file_resp.content
            content_type = file_resp.headers.get('Content-Type') or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
            
            # 3. Upload to Supabase
            public_url = upload_to_storage(filename, content, content_type)
            
            if public_url:
                # 4. Update Transaction
                url = f"{SUPABASE_URL}/rest/v1/bank_transactions?id=eq.{trans_id}"
                payload = {"attachment_url": public_url}
                r = requests.patch(url, json=payload, headers=HEADERS)
                
                if r.status_code in [200, 204]:
                    print(f"✅ Linked attachment to {old_id}")
                    success_count += 1
                else:
                    print(f"❌ Failed to update DB record: {r.text}")
                    
        except Exception as e:
            print(f"❌ Exception processing {old_id}: {e}")
            
    print(f"\n🎉 Finished! Processed {processed_count} attachments. Successfully linked {success_count}.")

if __name__ == '__main__':
    main()
