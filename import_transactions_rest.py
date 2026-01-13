import requests
import csv
import io
import time

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
# Using the Service Role Key found in direct_update.py
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE_PATH = 'tabelle_airtable/Registro Movimenti.csv'

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def clean_currency(val):
    if not val: return 0.0
    val = str(val).replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    # Handle thousands and decimal separators
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'): val = val.replace('.', '').replace(',', '.')
        else: val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) == 2 or len(parts[-1]) == 1: val = val.replace(',', '.')
        else: val = val.replace(',', '')
    elif '.' in val:
        parts = val.split('.')
        if len(parts[-1]) == 3 and len(parts) > 1: val = val.replace('.', '')
    return float(val)

def parse_date(value):
    if not value: return None
    parts = value.split('/')
    if len(parts) == 3:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return None

def fetch_all(table, select="*"):
    print(f"Fetching {table}...")
    items = []
    page = 0
    limit = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}&offset={page*limit}&limit={limit}"
        r = requests.get(url, headers=HEADERS)
        if r.status_code != 200:
            print(f"Error fetching {table}: {r.text}")
            break
        data = r.json()
        items.extend(data)
        if len(data) < limit:
            break
        page += 1
    return items

def main():
    print("🚀 Starting Import via REST API...")

    # 1. Fetch Lookup Data
    existing_categories = fetch_all('transaction_categories', 'id,name,type')
    clients = fetch_all('clients', 'id,business_name')
    suppliers = fetch_all('suppliers', 'id,name')
    invoices = fetch_all('invoices', 'id,invoice_number')
    
    # Check if bank_transactions exists
    print("Checking bank_transactions table...")
    check = requests.get(f"{SUPABASE_URL}/rest/v1/bank_transactions?select=id&limit=1", headers=HEADERS)
    if check.status_code != 200:
        print(f"⚠️ bank_transactions table might not exist! Status: {check.status_code}, {check.text}")
    else:
        print("✅ bank_transactions table exists.")

    # Memoize for faster lookup
    cat_map = {(c['name'].lower(), c['type']): c['id'] for c in existing_categories}
    
    client_map = {} # business_name_lower -> id
    for c in clients:
        if c.get('business_name'): client_map[c['business_name'].lower()] = c['id']
        
    supplier_map = {}
    for s in suppliers:
        if s.get('name'): supplier_map[s['name'].lower()] = s['id']
        
    invoice_map = {} # invoice_number -> id
    for inv in invoices:
        if inv.get('invoice_number'): invoice_map[inv['invoice_number']] = inv['id']
        
    # 2. Read CSV
    with open(CSV_FILE_PATH, mode='r', encoding='utf-8-sig', errors='replace') as f:
        # utf-8-sig handles BOM
        content = f.read().replace('\x00', '')
    
    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    print(f"Found {len(rows)} transactions to process.")
    if rows:
        print(f"First row keys: {list(rows[0].keys())}")
    
    # 3. Process Categories First
    new_categories = set()
    for row in rows:
        tipo_mov = row.get('Tipo Movimento', '').strip()
        tipo_uscita = row.get('Tipo Uscita', '').strip()
        
        cat_name = None
        cat_type = 'altro'
        
        if tipo_mov == 'Entrata':
            cat_type = 'entrata'
            cat_name = 'Entrata Generica'
        elif tipo_mov == 'Uscita':
            cat_type = 'uscita'
            cat_name = tipo_uscita if tipo_uscita else 'Uscita Generica'
            
        if cat_name and (cat_name.lower(), cat_type) not in cat_map:
            new_categories.add((cat_name, cat_type))
            
    for name, ctype in new_categories:
        print(f"Creating category: {name} ({ctype})")
        payload = {"name": name, "type": ctype}
        r = requests.post(f"{SUPABASE_URL}/rest/v1/transaction_categories", json=payload, headers=HEADERS)
        if r.status_code == 201:
            cat_map[(name.lower(), ctype)] = r.json()[0]['id']
        elif r.status_code == 409: # Conflict, maybe fetch again or ignore
             pass
        else:
             print(f"Failed to create category {name}: {r.text}")
             
    # Refresh cat map if needed or assume success? 
    # To be safe, let's just proceed. The unique constraint prevents dupes.
    # Re-fetch specific category if missing?
    # Simple retry logic:
    if new_categories:
        existing_categories = fetch_all('transaction_categories', 'id,name,type')
        cat_map = {(c['name'].lower(), c['type']): c['id'] for c in existing_categories}

    # 4. Insert Transactions
    for row in rows:
        old_id = row.get('Name')
        if not old_id: continue
        
        # Check if already exists? (UPSERT is supported via Prefer: resolution=merge-duplicates if we defined PK or unique constraint)
        # We need to map to our schema
        
        date_str = parse_date(row.get('Data'))
        amount = clean_currency(row.get('Prezzo'))
        desc = row.get('Descrizione')
        company = row.get('Azienda', '').strip()
        
        # Determine Category ID
        tipo_mov = row.get('Tipo Movimento', '').strip()
        tipo_uscita = row.get('Tipo Uscita', '').strip()
        cat_name = None
        cat_type = 'altro'
        if tipo_mov == 'Entrata':
            cat_type = 'entrata'
            cat_name = 'Entrata Generica'
        elif tipo_mov == 'Uscita':
            cat_type = 'uscita'
            cat_name = tipo_uscita if tipo_uscita else 'Uscita Generica'
        
        cat_id = cat_map.get((cat_name.lower(), cat_type)) if cat_name else None
        
        # Match Client/Supplier
        client_id = client_map.get(company.lower())
        supplier_id = supplier_map.get(company.lower())
        
        # Match Invoice
        ref_active = row.get('Fatture Attive', '').strip()
        active_inv_id = None
        if ref_active:
            # Try exact
            active_inv_id = invoice_map.get(ref_active)
            if not active_inv_id and '-' in ref_active:
                # Try replacing - with /
                active_inv_id = invoice_map.get(ref_active.replace('-', '/'))
        
        payload = {
            "old_id": old_id,
            "date": date_str,
            "type": tipo_mov.lower() if tipo_mov else None,
            "amount": amount,
            "description": desc,
            "category_id": cat_id,
            "client_id": client_id,
            "supplier_id": supplier_id,
            "active_invoice_id": active_inv_id,
            # Passive invoice ID: Match later or manually
            "counterparty_name": company,
            "external_ref_active_invoice": ref_active,
            "external_ref_passive_invoice": row.get('Fatture Passive'),
            "attachment_url": row.get('Allegati')
        }
        
        # Upsert
        headers_upsert = HEADERS.copy()
        headers_upsert["Prefer"] = "resolution=merge-duplicates"
        
        r = requests.post(f"{SUPABASE_URL}/rest/v1/bank_transactions?on_conflict=old_id", json=payload, headers=headers_upsert)
        if r.status_code not in [200, 201, 204]:
            print(f"Failed to import {old_id}: {r.text}")
        else:
            print(f"Imported {old_id}")

    print("✅ Completed!")

if __name__ == '__main__':
    main()
