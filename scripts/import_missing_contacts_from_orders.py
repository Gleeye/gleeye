
import csv
import requests
import json

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
ORDERS_CSV = 'tabelle_airtable/Ordini.csv'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def main():
    print("🚀 Starting Missing Contacts Import from Orders...")

    # 1. Fetch Existing Contacts
    print("Fetching existing contacts...")
    r_cons = requests.get(f"{SUPABASE_URL}/rest/v1/contacts?select=full_name", headers=headers)
    if r_cons.status_code != 200:
        print(f"Error fetching contacts: {r_cons.text}")
        return
    existing_names = {c['full_name'].strip().lower() for c in r_cons.json() if c['full_name']}
    print(f"Loaded {len(existing_names)} existing contacts.")

    # 2. Fetch Clients (to link client_id)
    print("Fetching clients...")
    r_clients = requests.get(f"{SUPABASE_URL}/rest/v1/clients?select=id,client_code", headers=headers)
    if r_clients.status_code != 200:
        print(f"Error fetching clients: {r_clients.text}")
        return
    client_map = {c['client_code'].strip().upper(): c['id'] for c in r_clients.json() if c['client_code']}

    # 3. Parse Orders for new Contacts
    new_contacts = {} # name -> {full_name, client_id}

    with open(ORDERS_CSV, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        for row in reader:
            referente_raw = row.get('Referente', '').strip()
            client_code = row.get('Clienti', '').strip()
            
            if not referente_raw:
                continue
                
            # Handle comma separated
            refs = [r.strip() for r in referente_raw.split(',') if r.strip()]
            
            client_id = client_map.get(client_code.upper())
            
            for r_name in refs:
                if r_name.lower() not in existing_names and r_name.lower() not in new_contacts:
                    # Parse first/last name roughly
                    parts = r_name.split(' ')
                    first = parts[0]
                    last = ' '.join(parts[1:]) if len(parts) > 1 else ''
                    
                    new_contacts[r_name.lower()] = {
                        "full_name": r_name,
                        "first_name": first,
                        "last_name": last,
                        "client_id": client_id,
                        "role": "Da Ordine"
                    }

    print(f"Found {len(new_contacts)} new contacts to import.")
    
    # 4. Insert New Contacts
    if new_contacts:
        payload = list(new_contacts.values())
        # Insert in batches of 50
        batch_size = 50
        for i in range(0, len(payload), batch_size):
            batch = payload[i:i+batch_size]
            res = requests.post(f"{SUPABASE_URL}/rest/v1/contacts", headers=headers, json=batch)
            if res.status_code >= 300:
                print(f"Error inserting batch {i}: {res.text}")
            else:
                print(f"Inserted batch {i}-{i+len(batch)}")
                
    print("✅ Done importing missing contacts.")

if __name__ == '__main__':
    main()
