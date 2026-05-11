import requests
import csv
import re
import json
import time
import os

# Configuration
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk"
CSV_FILE = "/Users/davidegentile/Documents/app dev/gleeye erp/tabelle_airtable/Pagamenti.csv"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean_currency(value):
    if not value or str(value).lower() in ['nan', '']:
        return 0.0
    clean = str(value).replace('€', '').replace('.', '').replace(',', '.')
    try:
        return float(clean)
    except ValueError:
        return 0.0

def clean_date(value):
    if not value or str(value).lower() in ['nan', ''] or value.strip() == '':
        return None
    try:
        # Expected DD/MM/YYYY
        parts = value.split('/')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
    except:
        return None
    return None

def fetch_map(table, key_field, value_field='id'):
    """Fetches all records and returns a map of key_field -> value_field"""
    items = {}
    page = 0
    size = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={key_field},{value_field}&limit={size}&offset={page*size}"
        r = requests.get(url, headers=HEADERS)
        try:
            r.raise_for_status()
            data = r.json()
        except:
            print(f"Failed to fetch {table}")
            return {}
            
        if not data: break
        
        for item in data:
            key = item.get(key_field)
            if key:
                # Handle case insensitivity?
                items[str(key).strip().upper()] = item.get(value_field)
        page += 1
    return items

def main():
    print(f"🚀 Starting Payments import...")

    # 1. Fetch Lookups
    print("📦 Fetching lookups...")
    
    # Orders: order_number -> id
    orders = fetch_map('orders', 'order_number')
    print(f"   Ref: {len(orders)} orders")

    # Assignments: legacy_id -> id
    assignments = fetch_map('assignments', 'legacy_id')
    print(f"   Ref: {len(assignments)} assignments")

    # Clients: business_name -> id
    clients = fetch_map('clients', 'business_name')
    print(f"   Ref: {len(clients)} clients")
    
    # Collaborators: full_name -> id
    # Need to be careful with name matching. Usually 'Name' field in collaborators table is split?
    # Let's check collaborators schema or use `full_name` computed column if available, or just fetch * and map manually.
    # The API.js fetches `full_name`. The table usually has `name` and `surname`.
    # Let's fetch name and surname and combine.
    print("   Ref: Fetching collaborators manual map...")
    collabs = {}
    page=0
    while True:
        url = f"{SUPABASE_URL}/rest/v1/collaborators?select=id,name,first_name,last_name,full_name&limit=1000&offset={page*1000}"
        r = requests.get(url, headers=HEADERS)
        try:
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            print(f"   Error fetching collaborators: {e}")
            if hasattr(r, 'text'): print(r.text)
            break
        
        if not data: break
        for c in data:
            # Map "Full Name" -> ID
            fn = c.get('full_name')
            if fn: collabs[fn.strip().upper()] = c['id']
            
            # Map "First Last" -> ID (redundant if full_name is populated correctly, but safe)
            computed = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()
            if computed: collabs[computed.upper()] = c['id']
            
            # Map Shorthand "NAME" -> ID
            shorthand = c.get('name')
            if shorthand: collabs[shorthand.strip().upper()] = c['id']
            
        page+=1
    print(f"   Ref: {len(collabs)} collaborators map keys")
    print(f"   Ref: {len(collabs)} collaborators map keys")

    # Suppliers: name -> id
    suppliers = fetch_map('suppliers', 'name')
    print(f"   Ref: {len(suppliers)} suppliers")


    print(f"📝 Parsing CSV...")
    payments = []
    
    # To avoid duplicates if we re-run, we rely on what? ID? CSV doesn't have ID.
    # We can't easily upsert without a unique key.
    # We will just insert for now, or maybe clear table first?
    # "Prefer: resolution=merge-duplicates" only works with PK or UNIQUE constraint.
    # Since we have no unique key in CSV, we should probably DELETE ALL payments first if we want a clean slate,
    # OR we assume this is a one-time import.
    # Let's DELETE ALL for safety during dev.
    
    delete_url = f"{SUPABASE_URL}/rest/v1/payments?id=neq.00000000-0000-0000-0000-000000000000" # Delete all
    requests.delete(delete_url, headers=HEADERS)
    print("   🧹 Cleared existing payments table.")

    # Manual Client Mapping for Mismatches
    MANUAL_CLIENT_MAP = {
        "ORDINE INGEGNERI GENOVA": "ORDINE DEGLI INGEGNERI DI GENOVA",
        "TARA BIANCA": "ASSOCIAZIONE TARA BIANCA",
        "START 4.0": "CENTRO DI COMPETENZA START 4.0",
        "GRUPPO CONSILIARE PD REGIONE LIGURIA": "GRUPPO CONSILIARE PARTITO DEMOCRATICO\nARTICOLO UNO REGIONE LIGURIA",
        "FABIO GILARDI SINDACO": "FABIO GILARDI SINDACO", # Match exact
        "PARTITO DEMOCRATICO DI GENOVA E DELLA LIGURIA": "PD GENOVA E LIGURIA",
        "AUSIND": "AUSIND SRL",
        "AIGA GENOVA": "ASSOCIAZIONE ITALIANA GIOVANI AVVOCATI  SEZIONE DI GENOVA",
        "CNR IMATI": "CNR-IMATI",
        # Add others if needed
    }

    with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Foreign Keys Resolution
            order_ref = row.get('Ordini', '').strip()
            assign_ref = row.get('Incarichi', '').strip()
            client_ref = row.get('Clienti', '').strip()
            collab_ref = row.get('Collaboratori', '').strip()
            supplier_ref = row.get('Fornitori', '').strip()
            
            # Allow fallback for client if it comes from Orders rollup
            if not client_ref: client_ref = row.get('Clienti (from Ordini)', '').strip()
            if not client_ref: client_ref = row.get('Cliente_text', '').strip()

            # Apply Manual Map
            if client_ref.upper() in MANUAL_CLIENT_MAP:
                client_ref = MANUAL_CLIENT_MAP[client_ref.upper()]


            order_id = orders.get(order_ref.upper())
            assign_id = assignments.get(assign_ref.upper())
            client_id = clients.get(client_ref.upper())
            collab_id = collabs.get(collab_ref.upper())
            supplier_id = suppliers.get(supplier_ref.upper())

            # Specific fix for Collaborators: CSV might have "Nome Cognome" or just "Nome".
            # If not found, try 'Collaboratore (Nome Cognome)' column
            if not collab_id:
                alt_collab = row.get('Collaboratore (Nome Cognome)', '').strip()
                collab_id = collabs.get(alt_collab.upper())

            payments.append({
                "title": row.get('Descrizione') or row.get('Name'),  # Prioritize Descrizione as requested
                "due_date": clean_date(row.get('Data')),
                "amount": clean_currency(row.get('Importo')),
                "status": row.get('Status'),
                "payment_type": row.get('Tipo Pagamento'),
                "payment_mode": row.get('Tipo Modalità'),
                "notes": row.get('Note'),
                "order_id": order_id,
                "assignment_id": assign_id,
                "client_id": client_id,
                "collaborator_id": collab_id,
                "supplier_id": supplier_id,
                "res_partner_request": row.get('Invita a Fatturare')
            })

    print(f"📝 Prepared {len(payments)} payments. Uploading...")
    
    batch_size = 100
    for i in range(0, len(payments), batch_size):
        batch = payments[i:i+batch_size]
        if i == 0:
            print(f"   🔎 Inspecting first record to be sent: {json.dumps(batch[0], indent=2, default=str)}")

        try:
            url = f"{SUPABASE_URL}/rest/v1/payments"
            res = requests.post(url, headers=HEADERS, json=batch)
            res.raise_for_status()
            print(f"   ✓ Batch {i//batch_size + 1} done.")
        except Exception as e:
            print(f"   ❌ Batch {i} error: {e}")
            if hasattr(e, 'response') and e.response: 
                print(f"   Response Body: {e.response.text}")
            elif hasattr(res, 'text'):
                 print(f"   Response Body (fallback): {res.text}")

    print("✨ Import completed!")

if __name__ == "__main__":
    main()
