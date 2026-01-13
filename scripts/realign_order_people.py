
import csv
import requests
import json
import re

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=minimal"
}

def clean_split(text):
    if not text: return []
    # Replace ' e ' with ',' and split by ','
    text = text.replace(' e ', ',')
    parts = [p.strip() for p in text.split(',') if p.strip()]
    return parts

def normalize_name(name):
    if not name: return ""
    # Collapsing multiple spaces
    return re.sub(r'\s+', ' ', name).strip().lower()

def fetch_map(table, key_field='full_name'):
    print(f"Fetching {table}...")
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?select=id,{key_field}", headers=HEADERS)
    data = r.json()
    # Normalize keys
    return {normalize_name(item[key_field]): item['id'] for item in data if item[key_field]}

def realign():
    print("🚀 Starting Data Re-alignment...")
    
    # 1. Fetch Maps
    collab_map = fetch_map('collaborators')
    contact_map = fetch_map('contacts')

    # DEBUG: Print some keys
    print(f"DB Collaborators keys sample: {list(collab_map.keys())[:5]}")
    
    # Fetch Orders
    print("Fetching orders...")
    r = requests.get(f"{SUPABASE_URL}/rest/v1/orders?select=id,order_number", headers=HEADERS)
    order_map = {item['order_number']: item['id'] for item in r.json()}
    
    updates_acc = 0
    updates_cont = 0
    
    with open('tabelle_airtable/Ordini.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        print(f"DEBUG CSV Columns: {reader.fieldnames}")
        
        for i, row in enumerate(reader):
            if i < 3: print(f"DEBUG Row {i}: {row}")
            
            oid_legacy = row.get('Id_Ordine')
            if not oid_legacy or oid_legacy not in order_map:
                continue
                
            order_id = order_map[oid_legacy]
            
            # --- ACCOUNTS ---
            accounts_raw = row.get('Account')
            if accounts_raw:
                names = clean_split(accounts_raw)
                for name in names:
                    clean_name = normalize_name(name)
                    cid = collab_map.get(clean_name)
                    
                    if not cid:
                        print(f"⚠️ Account not found: '{name}' -> cleaned: '{clean_name}'")
                        pass
                    
                    if cid:
                        # Upsert into order_collaborators
                        payload = {
                            "order_id": order_id,
                            "collaborator_id": cid,
                            "role_in_order": "Account"
                        }
                        res = requests.post(f"{SUPABASE_URL}/rest/v1/order_collaborators", 
                                            headers=HEADERS, json=payload, 
                                            params={"on_conflict": "order_id,collaborator_id"})
                        if res.status_code < 300:
                            updates_acc += 1
                        else:
                            print(f"❌ Account Upsert Failed: {res.status_code} {res.text}")

            # --- CONTACTS ---
            contacts_raw = row.get('Referente')
            if contacts_raw:
                names = clean_split(contacts_raw)
                for name in names:
                    cid = contact_map.get(name.lower())
                    if cid:
                        # Upsert into order_contacts
                        payload = {
                            "order_id": order_id,
                            "contact_id": cid,
                            "role": "Referente"
                        }
                        # We need to handle the case where order_contacts might not exist yet if script fails
                        # But assuming table exists from previous step (via SQL or if user ran it)
                        # Actually I can't guarantee table exists via REST if I couldn't create it.
                        # Wait, I couldn't run SQL via RPC. 
                        # I NEED the table to exist.
                        # If I can't create table, I can't insert.
                        # Assuming User will run SQL.
                        res = requests.post(f"{SUPABASE_URL}/rest/v1/order_contacts", 
                                            headers=HEADERS, json=payload, 
                                            params={"on_conflict": "order_id,contact_id"})
                        if res.status_code < 300:
                            updates_cont += 1
                        else:
                            # If table doesn't exist, this fails. 
                            # I will log error but continue.
                            if '42P01' in res.text: # undefined_table
                                print("⚠️ Table 'order_contacts' does not exist yet.")
                                return

    print(f"✅ Re-alignment Complete.")
    print(f"   - Linked {updates_acc} Accounts")
    print(f"   - Linked {updates_cont} Contacts")

if __name__ == '__main__':
    realign()
