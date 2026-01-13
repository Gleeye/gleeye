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
    "Content-Type": "application/json"
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def main():
    print("🚀 Starting Website Sync...")
    
    # 1. Fetch Suppliers
    print("Fetching suppliers...")
    r_supp = requests.get(f"{SUPABASE_URL}/rest/v1/suppliers?select=id,name", headers=headers)
    if r_supp.status_code != 200:
        print("Error fetching suppliers")
        return
    
    supplier_map = {}
    for s in r_supp.json():
        if s['name']:
            supplier_map[s['name'].strip().lower()] = s['id']
            
    print(f"Loaded {len(supplier_map)} suppliers.")
    
    updates = 0
    with open(CSV_FILE, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        for row in reader:
            name = row.get('Name', '').strip()
            url = row.get('URL', '').strip()
            
            if not name or not url:
                continue
                
            sid = supplier_map.get(name.lower())
            if sid:
                # Update website
                # print(f"Updating {name} -> {url}")
                patch_url = f"{SUPABASE_URL}/rest/v1/suppliers?id=eq.{sid}"
                res = requests.patch(patch_url, headers=headers, json={'website': url})
                if res.status_code < 300:
                    updates += 1
                else:
                    print(f"Error updating {name}: {res.text}")
            else:
                # print(f"Supplier not found in DB: {name}")
                pass
                
    print(f"✅ Updated {updates} supplier websites.")

if __name__ == '__main__':
    main()
