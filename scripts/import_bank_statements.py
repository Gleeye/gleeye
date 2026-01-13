import requests
import csv
import io
import re
import os
import mimetypes
from datetime import datetime

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE_PATH = 'tabelle_airtable/Riepilogo Estratti Conto.csv'
STORAGE_BUCKET = 'bank_statements'

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def parse_currency(value_str):
    # Remove € and dots/commas
    # Format "€13973,04" -> 13973.04
    # But wait, is comma decimal? Yes "€13973,04".
    # Sometimes may be 1.000,00?
    if not value_str:
        return 0.0
    
    clean = value_str.replace('€', '').strip()
    # Check if thousands separator exists. If so, usually . in IT.
    # But here simple CSV often has no thousands sep ??
    # Looking at CSV: "€13973,04". No thousands separator.
    # Just replace , with .
    clean = clean.replace(',', '.')
    return float(clean)

def parse_date(date_str):
    # 30/4/2024
    try:
        dt = datetime.strptime(date_str, '%d/%m/%Y')
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        try:
             # Try M/Y ??
             dt = datetime.strptime(date_str, '%d/%-m/%Y')
             return dt.strftime('%Y-%m-%d')
        except:
             return None

def upload_to_storage(filename, content, content_type):
    # Sanitize filename
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
    # Add timestamp to avoid collisions? Or just use as is.
    # To be safe against duplicates, maybe prefix with timestamp?
    # User said "importali tutti correttamente".
    # I'll use original filename.
    path = safe_filename
    
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{path}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true" 
    }
    
    r = requests.post(url, data=content, headers=headers)
    if r.status_code == 200:
        return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
    else:
        print(f"❌ Storage upload failed: {r.text}")
        return None

def main():
    print("🚀 Starting Bank Statements Import...")
    
    with open(CSV_FILE_PATH, mode='r', encoding='utf-8-sig', errors='replace') as f:
        content = f.read().replace('\x00', '')
        
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    print(f"Processing {len(rows)} rows...")
    
    success_count = 0
    
    for row in rows:
        name_mmyy = row.get('Name')
        date_str = row.get('Date')
        value_str = row.get('Value')
        attachments = row.get('Attachments')
        
        if not name_mmyy:
            continue
            
        print(f"Processing {name_mmyy}...")
        
        # Parse Data
        stmt_date = parse_date(date_str)
        balance = parse_currency(value_str)
        
        # Parse Attachment
        attachment_url = None
        attachment_name = None
        
        if attachments:
            match = re.search(r'\((https://[^)]+)\)', attachments)
            if match:
                file_url = match.group(1)
                filename = attachments.split('(')[0].strip()
                if not filename:
                    filename = f"estratto_{name_mmyy.replace('/','-')}.pdf"
                
                attachment_name = filename
                
                # Download and Upload
                print(f"   Downloading attachment: {filename}...")
                try:
                    file_resp = requests.get(file_url)
                    if file_resp.status_code == 200:
                        content_type = file_resp.headers.get('Content-Type') or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
                        public_url = upload_to_storage(filename, file_resp.content, content_type)
                        if public_url:
                            attachment_url = public_url
                            print("   ✅ Uploaded to Storage")
                    else:
                        print(f"   ❌ Failed to download: {file_resp.status_code}")
                except Exception as e:
                    print(f"   ❌ Exception downloading/uploading: {e}")
        
        # Insert into DB
        payload = {
            "name": name_mmyy,
            "statement_date": stmt_date,
            "balance": balance,
            "attachment_name": attachment_name,
            "attachment_url": attachment_url
        }
        
        url = f"{SUPABASE_URL}/rest/v1/bank_statements"
        r = requests.post(url, json=payload, headers=HEADERS)
        if r.status_code in [200, 201, 204]:
            print(f"✅ Inserted record for {name_mmyy}")
            success_count += 1
        else:
            print(f"❌ DB Insert failed: {r.text}")

    print(f"\n🎉 Finished! Imported {success_count} statements.")

if __name__ == '__main__':
    main()
