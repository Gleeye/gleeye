import os
import requests
import re
import csv
import json
from datetime import datetime
from io import StringIO

# --- CONFIGURATION ---
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk' 
BUCKET_NAME = 'invoices'
CSV_FILE = 'tabelle_airtable/Fatture Passive.csv'

def migrate():
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }

    print(f"📖 Reading fresh links from {CSV_FILE}...")
    
    try:
        with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
            content = f.read().replace('\0', '')
            f_obj = StringIO(content)
            reader = csv.DictReader(f_obj)
            
            for row in reader:
                invoice_num = row.get('N.', '').strip()
                if not invoice_num: continue
                
                raw_attachment = row.get('Allegato', '')
                if 'http' not in raw_attachment: continue
                
                # Extract Airtable URL
                match = re.search(r'\((https?://[^)]+)\)', raw_attachment)
                if not match: continue
                airtable_url = match.group(1)
                
                print(f"\n📄 Processing Invoice {invoice_num}...")
                
                # 1. Find record in Supabase by invoice_number
                search_url = f"{SUPABASE_URL}/rest/v1/passive_invoices?invoice_number=eq.{invoice_num}&select=id"
                search_res = requests.get(search_url, headers=headers)
                
                if search_res.status_code != 200 or not search_res.json():
                    print(f"⚠️ Record not found in DB for invoice {invoice_num}")
                    continue
                
                record_id = search_res.json()[0]['id']
                
                # 2. Download and Upload
                download_and_upload(record_id, invoice_num, airtable_url, headers)

    except Exception as e:
        print(f"💥 Fatal Error: {str(e)}")

def download_and_upload(record_id, invoice_num, airtable_url, headers):
    try:
        file_res = requests.get(airtable_url, stream=True)
        if file_res.status_code != 200:
            print(f"❌ Download failed for {invoice_num}")
            return

        # Filename detection
        content_disp = file_res.headers.get('Content-Disposition', '')
        filename = None
        if 'filename=' in content_disp:
            filename = re.findall("filename=(.+)", content_disp)[0].strip('"')
        
        if not filename:
            ext = '.pdf'
            if 'image' in file_res.headers.get('Content-Type', ''):
                ext = '.jpg'
            filename = f"invoice_{invoice_num.replace('/', '_')}_{record_id}{ext}"

        storage_path = f"passive_invoices/{record_id}/{filename}"
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{storage_path}"
        
        upload_headers = headers.copy()
        upload_headers["Content-Type"] = file_res.headers.get('Content-Type', 'application/octet-stream')
        
        # Upload to Storage
        upload_res = requests.post(upload_url, headers=upload_headers, data=file_res.content)
        if upload_res.status_code not in [200, 201]:
            # Maybe file already exists? Check if error is 'Duplicate'
            if 'Duplicate' not in upload_res.text:
                print(f"❌ Upload failed: {upload_res.text}")
                return
            else:
                print(f"ℹ️ File already exists in storage, updating link anyway.")

        # 3. Update DB with permanent link
        new_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{storage_path}"
        update_url = f"{SUPABASE_URL}/rest/v1/passive_invoices?id=eq.{record_id}"
        update_res = requests.patch(update_url, headers=headers, json={"attachment_url": new_url})
        
        if update_res.status_code in [200, 204]:
            print(f"✅ Success! Permanent link: {storage_path}")
        else:
            print(f"❌ DB update failed: {update_res.text}")

    except Exception as e:
        print(f"💥 Error processing {invoice_num}: {str(e)}")

if __name__ == "__main__":
    migrate()
