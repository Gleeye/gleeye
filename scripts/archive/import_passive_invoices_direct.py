import csv
import requests
import datetime

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE = 'tabelle_airtable/Fatture Passive.csv'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates" 
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def clean_money(val):
    if not val: return None
    # val is like "€1.677,75" or "€1,22" or "€16.08"
    # Logic: Remove € and space.
    # If comma and dot: 
    #   if dot is last, it's decimal? No, EU style usually 1.000,00
    #   if comma is last, it's decimal.
    val = val.replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    
    # Simple EU heuristic: replace dots (thousands) with empty, replace comma with dot
    # Check if multiple dots? 
    if ',' in val:
        # Assume EU style: dots are thousands, comma is decimal
        val = val.replace('.', '').replace(',', '.')
    else:
        # Maybe US style or just integer
        pass
        
    try:
        return float(val)
    except:
        return 0.0

def parse_date(val):
    if not val: return None
    # DD/MM/YYYY
    try:
        parts = val.split('/')
        if len(parts) == 3:
            return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    except:
        pass
    return None

def extract_attachment(val):
    # Filename (https://...)
    if not val: return None
    if 'http' in val:
        start = val.find('(')
        end = val.find(')', start)
        if start != -1 and end != -1:
            return val[start+1:end]
    return None

def main():
    print("🚀 Starting Passive Invoices Import...")

    # 1. Fetch Lookups
    print("Fetching suppliers...")
    r_supp = requests.get(f"{SUPABASE_URL}/rest/v1/suppliers?select=id,name", headers=headers)
    suppliers_map = {} # Name -> ID
    if r_supp.status_code == 200:
        for s in r_supp.json():
            if s.get('name'):
                suppliers_map[s['name'].strip().lower()] = s['id']
    else:
        print(f"Error fetching suppliers: {r_supp.text}")

    print("Fetching collaborators...")
    r_collab = requests.get(f"{SUPABASE_URL}/rest/v1/collaborators?select=id,full_name,first_name,last_name,name", headers=headers)
    collab_map = {} # Name variations -> ID
    if r_collab.status_code == 200:
        for c in r_collab.json():
            cid = c['id']
            # Map full name, and maybe first+last
            if c.get('full_name'): collab_map[c['full_name'].strip().lower()] = cid
            if c.get('first_name') and c.get('last_name'):
                full = f"{c['first_name']} {c['last_name']}".strip().lower()
                collab_map[full] = cid
                # Also maybe swap? No.
            if c.get('name'): # The short code e.g. WILLY
                 collab_map[c['name'].strip().lower()] = cid
    else:
        print(f"Error fetching collaborators: {r_collab.text}")
        
    # 2. Process CSV
    batch = []
    with open(CSV_FILE, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        for row in reader:
            tipo = row.get('Tipo', '')
            supplier_name = row.get('Fornitori', '').strip()
            collab_name = row.get('Collaboratore', '').strip()
            
            supplier_id = None
            collaborator_id = None
            
            if tipo == 'Fornitori' and supplier_name:
                low = supplier_name.lower()
                if low in suppliers_map:
                    supplier_id = suppliers_map[low]
                else:
                    # Try fuzzy or partial? Or just log warning
                    # Some might be "Google XXX" vs "Google"
                     # Simple check: starts with
                    for s_name, s_id in suppliers_map.items():
                         if low.startswith(s_name) or s_name.startswith(low):
                             supplier_id = s_id
                             break
                    if not supplier_id:
                        # print(f"Warning: Supplier not found: {supplier_name}")
                        pass
                        
            elif tipo == 'Collaboratori' and collab_name:
                low = collab_name.lower()
                if low in collab_map:
                    collaborator_id = collab_map[low]
                else:
                    # Check partial matches
                     for c_name, c_id in collab_map.items():
                         if low == c_name: 
                             collaborator_id = c_id
                             break
                    
            
            inv_num = row.get('N.', '')
            if not inv_num and not supplier_id and not collaborator_id:
                continue

            issue_date = parse_date(row.get('Data Fattura'))
            payment_date = parse_date(row.get('Data saldo'))
            status = row.get('Stato', '') # e.g. Pagato
            
            amount_net = clean_money(row.get('Importo'))
            amount_gross = clean_money(row.get('Pagato')) # Assuming this column holds total paid
            vat_amount = clean_money(row.get('IVA'))
            
            # If gross is 0 but net > 0, maybe gross = net? (No VAT or VAT is 0)
            if amount_gross == 0 and amount_net > 0:
                amount_gross = amount_net + (vat_amount or 0)
            
            notes = row.get('Servizio Fornitore', '')
            attachment_url = extract_attachment(row.get('Allegato'))
            
            payload = {
                "invoice_number": inv_num,
                "issue_date": issue_date,
                "payment_date": payment_date,
                "status": status,
                "amount_tax_excluded": amount_net,
                "amount_tax_included": amount_gross,
                "tax_amount": vat_amount,
                "supplier_id": supplier_id,
                "collaborator_id": collaborator_id,
                "notes": notes,
                "attachment_url": attachment_url
            }
            batch.append(payload)

    if not batch:
        print("No invoices to import.")
        return

    print(f"Importing {len(batch)} invoices...")
    # Chunking to avoid payload too large (though 90 rows is fine)
    url = f"{SUPABASE_URL}/rest/v1/passive_invoices"
    res = requests.post(url, headers=headers, json=batch)
    
    if res.status_code in [200, 201]:
        print("✅ Invoices import successful!")
    else:
        print(f"❌ Error inserting invoices: {res.text}")

if __name__ == '__main__':
    main()
