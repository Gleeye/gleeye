import csv
import requests
import os

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE = 'tabelle_airtable/Fornitori.csv'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates" # Ignore duplicates based on constraints (needs unique constraint on name usually) 
    # But schema doesn't have unique constraint on name by default unless I added it.
    # update_suppliers_schema.sql didn't add constraint.
    # So we should check if exists first to avoid dupes?
    # Or just POST. If dupes, well... user said "importiamo".
    # I'll try to fetch existing first.
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def main():
    print("🚀 Starting Suppliers Import...")
    
    # 1. Fetch existing suppliers to avoid duplicates
    existing_url = f"{SUPABASE_URL}/rest/v1/suppliers?select=name"
    r = requests.get(existing_url, headers=headers)
    existing_names = set()
    if r.status_code == 200:
        existing_names = {row['name'].strip().lower() for row in r.json() if row.get('name')}
    else:
        print(f"Warning: Could not fetch existing suppliers: {r.text}")

    # 2. Read CSV
    with open(CSV_FILE, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        # Filter NUL bytes
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        batch = []
        for row in reader:
            name = row.get('Name', '').strip()
            if not name: continue
            
            if name.lower() in existing_names:
                # Update website if needed
                # We need ID. But existing_names was just a set of names.
                # To do this properly, we need a map Name -> ID.
                # Let's assume we want to "Patch". Or better, let's fetch map first.
                pass 
                
            website = row.get('URL', '').strip()
            notes = row.get('Notes', '').strip()
            
            payload = {
                "name": name,
                "notes": notes,
                "website": website or None
            }
            batch.append(payload)

    if not batch:
        print("No suppliers found in CSV.")
        return

    # 3. Upsert (Insert or Update)
    # Supabase POST accepts `Prefer: resolution=merge-duplicates` if we have a unique constraint.
    # But usually Upsert needs Primary Key or unique key. Name is not unique by default constraints unless we added it.
    # We didn't add UNIQUE(name) constraint in migration?
    # Let's add it in migration too? Or manually update.
    
    # Prismatic approach: Loop and Update or Insert.
    # Since we have only ~100 records, we can handle it.
    
    print(f"Processing {len(batch)} suppliers...")
    
    # Fetch all suppliers to map
    r_all = requests.get(f"{SUPABASE_URL}/rest/v1/suppliers?select=id,name", headers=headers)
    name_to_id = {}
    if r_all.status_code == 200:
        for s in r_all.json():
            name_to_id[s['name'].strip().lower()] = s['id']
            
    insert_batch = []
    
    for item in batch:
        name_key = item['name'].strip().lower()
        if name_key in name_to_id:
            # Update
            sid = name_to_id[name_key]
            u_url = f"{SUPABASE_URL}/rest/v1/suppliers?id=eq.{sid}"
            r = requests.patch(u_url, headers=headers, json=item)
            if r.status_code >= 300:
                print(f"❌ Update failed for {item['name']}: {r.text}")
        else:
            # Insert
            insert_batch.append(item)
            
    if insert_batch:
        print(f"Inserting {len(insert_batch)} new suppliers...")
        url = f"{SUPABASE_URL}/rest/v1/suppliers"
        res = requests.post(url, headers=headers, json=insert_batch)
        if res.status_code < 300:
             print("✅ Insert successful")
        else:
             print(f"❌ Insert failed: {res.text}")
             
    print("✅ Suppliers sync complete.")
    return


if __name__ == '__main__':
    main()
