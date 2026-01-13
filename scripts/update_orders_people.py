
import csv
import requests
import json
import os

# Configuration (Reusing key from sync_supplier_websites.py which seems to have service role)
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE = 'tabelle_airtable/Ordini.csv'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal" 
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def main():
    print("🚀 Starting Orders People Update...")

    # 1. Fetch Collaborators (for Account)
    print("Fetching collaborators...")
    r_cols = requests.get(f"{SUPABASE_URL}/rest/v1/collaborators?select=id,full_name", headers=headers)
    if r_cols.status_code != 200:
        print(f"Error fetching collaborators: {r_cols.text}")
        return
    collab_map = {c['full_name'].strip().lower(): c['id'] for c in r_cols.json() if c['full_name']}
    print(f"Loaded {len(collab_map)} collaborators.")

    # 2. Fetch Contacts (for Referente)
    print("Fetching contacts...")
    r_cons = requests.get(f"{SUPABASE_URL}/rest/v1/contacts?select=id,full_name", headers=headers)
    if r_cons.status_code != 200:
        print(f"Error fetching contacts: {r_cons.text}")
        return
    contact_map = {c['full_name'].strip().lower(): c['id'] for c in r_cons.json() if c['full_name']}
    print(f"Loaded {len(contact_map)} contacts.")

    # 3. Process CSV
    updates = 0
    with open(CSV_FILE, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        for row in reader:
            order_number = row.get('Id_Ordine', '').strip()
            if not order_number: continue

            account_name = row.get('Account', '').strip()
            referente_raw = row.get('Referente', '').strip()
            
            payload = {}

            # Map Account
            if account_name:
                aid = collab_map.get(account_name.lower())
                if aid:
                    payload['account_id'] = aid
            
            # Map Referente (take first)
            if referente_raw:
                first_ref = referente_raw.split(',')[0].strip()
                if first_ref:
                    cid = contact_map.get(first_ref.lower())
                    if cid:
                        payload['contact_id'] = cid
            
            if payload:
                # Update Order
                # print(f"Updating Order {order_number}: {payload}")
                patch_url = f"{SUPABASE_URL}/rest/v1/orders?order_number=eq.{order_number}"
                res = requests.patch(patch_url, headers=headers, json=payload)
                if res.status_code < 300:
                    updates += 1
                else:
                    print(f"Error updating Order {order_number}: {res.text}")

    print(f"✅ Updated {updates} orders with people data.")

if __name__ == '__main__':
    main()
