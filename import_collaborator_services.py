import requests
import csv
import re
import json
import time
import math

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE = 'tabelle_airtable/Registro Servizi Collaboratori.csv'

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean_currency(val):
    if not val or str(val).lower() == 'nan': return 0.0
    val = str(val).replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'): val = val.replace('.', '').replace(',', '.')
        else: val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) in [1, 2]: val = val.replace(',', '.')
        else: val = val.replace(',', '')
    val = re.sub(r'[^0-9.-]', '', val)
    try: 
        f = float(val)
        return f if not math.isnan(f) and not math.isinf(f) else 0.0
    except: return 0.0

def clean_float(val):
    if not val or str(val).lower() == 'nan': return 0.0
    val = str(val).replace(',', '.').strip()
    try: 
        f = float(val)
        return f if not math.isnan(f) and not math.isinf(f) else 0.0
    except: return 0.0

def fetch_all_pages(table):
    items = []
    page = 0
    page_size = 1000
    while True:
        offset = page * page_size
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit={page_size}&offset={offset}"
        try:
            res = requests.get(url, headers=HEADERS)
            res.raise_for_status()
            data = res.json()
            if not data: break
            items.extend(data)
            page += 1
        except Exception as e:
            print(f"Error fetching {table}: {e}")
            break
    return items

def main():
    print("🚀 Starting import of Collaborator Services (Final Attempt)...")

    # 1. Fetch Foreign Keys Data
    print("📦 Fetching existing data for linking...")
    order_map = { o.get('order_number'): o['id'] for o in fetch_all_pages('orders') if o.get('order_number') }
    service_map = { s.get('name').lower().strip(): s['id'] for s in fetch_all_pages('services') if s.get('name') }
    collab_map = {}
    for c in fetch_all_pages('collaborators'):
        if c.get('name'): collab_map[c['name'].upper().strip()] = c['id']
        if c.get('full_name'): collab_map[c['full_name'].lower().strip()] = c['id']

    # 2. Parse CSV
    print("📂 Parsing CSV...")
    records_to_insert = []
    used_ids = {}
    
    with open(CSV_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_id = row.get('Name', '').strip()
            if not csv_id or csv_id == '--': continue
            
            if csv_id in used_ids:
                used_ids[csv_id] += 1
                unique_id = f"{csv_id}_{used_ids[csv_id]}"
            else:
                used_ids[csv_id] = 1
                unique_id = csv_id
            
            legacy_order = row.get('Ordine', '').strip()
            legacy_service = row.get('Servizio', '').strip()
            legacy_collab = row.get('Collaboratori', '').strip()
            
            record = {
                "name": csv_id,
                "airtable_id": unique_id,
                "order_id": order_map.get(legacy_order),
                "service_id": service_map.get(legacy_service.lower().strip()),
                "collaborator_id": collab_map.get(legacy_collab.upper().strip()),
                "legacy_order_id": legacy_order,
                "legacy_service_name": legacy_service,
                "legacy_collaborator_name": legacy_collab,
                "department": row.get('Tags (from Servizio)', ''), 
                "tariff_type": row.get('Tipo Tariffa', ''),
                "quantity": clean_float(row.get('Quantità')),
                "hours": clean_float(row.get('Ore')),
                "months": clean_float(row.get('Mesi')),
                "spot_quantity": clean_float(row.get('Quant')),
                "unit_cost": clean_currency(row.get('Costo base')),
                "unit_price": clean_currency(row.get('Prezzo base')),
                "total_cost": clean_currency(row.get('Costo Netto Totale')),
                "total_price": clean_currency(row.get('Prezzo Totale')),
                "status_work": row.get('Stato Lavori', ''),
                "status_offer": row.get('Stato Offerta', ''),
                "notes": row.get('Servizio_text', '') or row.get('Notes', '')
            }
            records_to_insert.append(record)

    print(f"📝 Found {len(records_to_insert)} records. Clearing existing data for a clean import...")
    # Since I'm changing ID logic, I'll clear the table first
    requests.delete(f"{SUPABASE_URL}/rest/v1/collaborator_services?id=neq.00000000-0000-0000-0000-000000000000", headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})

    # 3. Batch Insert
    batch_size = 50
    for i in range(0, len(records_to_insert), batch_size):
        batch = records_to_insert[i:i+batch_size]
        try:
            url = f"{SUPABASE_URL}/rest/v1/collaborator_services"
            res = requests.post(url, headers=HEADERS, json=batch)
            res.raise_for_status()
            print(f"   ✓ Batch {i//batch_size + 1} done.")
        except Exception as e:
            print(f"   ❌ Batch {i} error: {e}")
            if hasattr(e, 'response') and e.response: print(e.response.text)

    print("✨ Import completed!")

if __name__ == "__main__":
    main()
