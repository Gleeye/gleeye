import requests
import csv
import re
import json
import time

# Configuration
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk"
INCARICHI_CSV = "/Users/davidegentile/Documents/app dev/gleeye erp/tabelle_airtable/Incarichi.csv"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def clean_currency(value):
    if not value or str(value).lower() == 'nan':
        return 0.0
    clean = str(value).replace('€', '').replace('.', '').replace(',', '.')
    try:
        return float(clean)
    except ValueError:
        return 0.0

def clean_date(value):
    if not value or str(value).lower() == 'nan' or value.strip() == '':
        return None
    try:
        parts = value.split('/')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
    except:
        return None
    return None

def fetch_all(table):
    items = []
    page = 0
    size = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit={size}&offset={page*size}"
        r = requests.get(url, headers=HEADERS)
        r.raise_for_status()
        data = r.json()
        if not data: break
        items.extend(data)
        page += 1
    return items

def main():
    print(f"🚀 Starting Assignments import...")

    # 1. Lookups
    print("📦 Fetching lookups...")
    collab_map = { c.get('name').upper().strip(): c['id'] for c in fetch_all('collaborators') if c.get('name') }
    order_map = { o.get('order_number').strip(): o['id'] for o in fetch_all('orders') if o.get('order_number') }
    
    print(f"Loaded {len(collab_map)} collaborators and {len(order_map)} orders.")

    print(f"📝 Parsing CSV...")
    assignments = []
    with open(INCARICHI_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        print(f"   CSV Headers found: {reader.fieldnames}")
        for i, row in enumerate(reader):
            if i < 3:
                print(f"   Sample row {i}: {row}")
            
            legacy_id = row.get('Name')
            if not legacy_id or legacy_id == '--': continue
            
            order_ref = row.get('Ordini', '').strip()
            collab_ref = row.get('Collaboratori', '').strip()
            
            order_id = order_map.get(order_ref)
            collab_id = collab_map.get(collab_ref.upper())
            
            assignments.append({
                "legacy_id": legacy_id,
                "order_id": order_id,
                "collaborator_id": collab_id,
                "description": row.get('Titolo Commessa') or row.get('Attività'),
                "status": row.get('Stato Incarico'),
                "start_date": clean_date(row.get('Created')),
                "total_amount": clean_currency(row.get('Importo Totale Netto')),
                "payment_terms": row.get('Modalità Pagamento'),
                "payment_details": row.get('Descrizione Pagamento'),
                "pm_notes": row.get('Note PM'),
                "drive_link": row.get('IdFile') 
            })

    print(f"📝 Prepared {len(assignments)} assignments. Uploading...")
    
    batch_size = 50
    for i in range(0, len(assignments), batch_size):
        batch = assignments[i:i+batch_size]
        try:
            url = f"{SUPABASE_URL}/rest/v1/assignments"
            res = requests.post(url, headers=HEADERS, json=batch)
            res.raise_for_status()
            print(f"   ✓ Batch {i//batch_size + 1} done.")
        except Exception as e:
            print(f"   ❌ Batch {i} error: {e}")
            if hasattr(e, 'response') and e.response: print(e.response.text)

    print("✨ Import completed!")

if __name__ == "__main__":
    main()
