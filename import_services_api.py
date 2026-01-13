import requests
import csv
import re
import os

# Configuration from existing scripts
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
# Using the Service Role Key found in direct_update.py
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates" # Upsert behavior
}

CSV_FILE_PATH = 'tabelle_airtable/Tariffario Servizi.csv'

def clean_currency(val):
    """
    Converts "€50,00" -> 50.00
    """
    if not val or not val.strip():
        return None
    # Remove € and dots (thousands), replace comma with dot
    clean = val.replace('€', '').replace('.', '').replace(',', '.').strip()
    try:
        return float(clean)
    except ValueError:
        return None

def clean_percent(val):
    """
    Converts "67%" -> 67.0
    """
    if not val or not val.strip():
        return None
    clean = val.replace('%', '').replace(',', '.').strip()
    try:
        return float(clean)
    except ValueError:
        return None

def clean_array(val):
    """
    Converts "Foto,Video" -> ['Foto', 'Video'] list
    """
    if not val or not val.strip():
        return None
    return [p.strip() for p in val.split(',') if p.strip()]

def main():
    print("🚀 Starting Services Import via REST API...")
    
    if not os.path.exists(CSV_FILE_PATH):
        print(f"❌ File not found: {CSV_FILE_PATH}")
        return

    records = []
    
    # Map CSV headers to API fields
    with open(CSV_FILE_PATH, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Tariffa', '').strip()
            if not name: continue
            
            record = {
                "name": name,
                "cost": clean_currency(row.get('Costo')),
                "price": clean_currency(row.get('Prezzo')),
                "margin": clean_currency(row.get('Margine')),
                "margin_percent": clean_percent(row.get('% Margine')),
                "tags": clean_array(row.get('Tags')),
                "type": row.get('Tipo tariffa'),
                "details": row.get('Dettagli Tariffa'),
                "notes": row.get('Area text'),
                "template_name": row.get('Template Servizi in Vendita'),
                "linked_service_ids": clean_array(row.get('Table 8')),
                "linked_collaborator_ids": clean_array(row.get('Registro Collaboratori copy')),
                "airtable_id": name # Using Name as Unique ID for upsert
            }
            records.append(record)

    print(f"Parsed {len(records)} records. Sending to Supabase...")
    
    # Batch size not strictly necessary for 35 records, but good practice
    # Supabase PostgREST supports bulk insert
    url = f"{SUPABASE_URL}/rest/v1/services?on_conflict=airtable_id"
    
    # Send in chunks just in case
    chunk_size = 50
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        r = requests.post(url, json=chunk, headers=HEADERS)
        
        if r.status_code in [200, 201, 204]:
            print(f"✅ Batch {i//chunk_size + 1} imported successfully ({len(chunk)} items).")
        else:
            print(f"❌ Batch {i//chunk_size + 1} failed: {r.text}")

    print("✨ Import finished.")

if __name__ == '__main__':
    main()
