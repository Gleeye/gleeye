import csv
import requests
import os
import json

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
CSV_FILE = 'tabelle_airtable/Fatture Passive.csv'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def clean_key(k):
    return k.strip().lstrip('\ufeff')

def main():
    print("🚀 Starting Link Fixer...")
    
    # 1. Fetch Suppliers
    print("Fetching suppliers...")
    r_supp = requests.get(f"{SUPABASE_URL}/rest/v1/suppliers?select=id,name", headers=headers)
    if r_supp.status_code != 200:
        print("Error fetching suppliers")
        return
    
    # Map Name -> ID (normalized)
    supplier_map = {}
    for s in r_supp.json():
        if s['name']:
            supplier_map[s['name'].strip().lower()] = s['id']
            
    print(f"Loaded {len(supplier_map)} suppliers.")
    
    # 2. Fetch Invoices
    print("Fetching invoices...")
    r_inv = requests.get(f"{SUPABASE_URL}/rest/v1/passive_invoices?select=id,invoice_number,issue_date,supplier_id", headers=headers)
    if r_inv.status_code != 200:
        print("Error fetching invoices")
        return
        
    invoices_map = {} # Key: number|date -> ID
    invoices_list = r_inv.json()
    for inv in invoices_list:
        if inv['invoice_number']:
            # Normalization might be needed
            num = inv['invoice_number'].strip()
            date = inv['issue_date'] # format YYYY-MM-DD
            
            # Key strategy: Number is key. Date is secondary check if duplicate numbers exist (which we supposedly cleaned).
            # But let's use number|date just in case CSV date format matches.
            # CSV Date format: "16/4/2024" -> "YYYY-MM-DD"?
            # We need to parse CSV date to match DB date.
            # Or just match by Number? Number should be fairly unique per supplier. 
            # If we match by Number and Supplier Name, it's safer.
            
            invoices_map[num] = inv
            
    print(f"Loaded {len(invoices_list)} invoices.")
    
    # 3. Read CSV and Match
    updates = 0
    not_found_suppliers = set()
    
    with open(CSV_FILE, mode='r', encoding='utf-8-sig', errors='ignore') as f:
        clean_f = (line.replace('\0', '') for line in f)
        reader = csv.DictReader(clean_f)
        reader.fieldnames = [clean_key(k) for k in reader.fieldnames]
        
        for row in reader:
            raw_supp_name = row.get('Fornitori', '').strip()
            inv_num = row.get('N.', '').strip() # Assuming 'N.' is Invoice Number column based on header inspection
            
            if not raw_supp_name or not inv_num:
                continue
                
            # Find Supplier ID
            supp_key = raw_supp_name.lower()
            supplier_id = supplier_map.get(supp_key)
            
            if not supplier_id:
                # Try partial match?
                # E.g. "Adobe Systems" vs "Adobe"
                for s_name, s_id in supplier_map.items():
                    if s_name in supp_key or supp_key in s_name:
                        # Use first match? Dangerous but better than nothing?
                        # Let's verify string length similarity?
                        # User specifically mentioned "Fatture passive le vedo solo per alcuni".
                        # Let's log it.
                        pass
                
                not_found_suppliers.add(raw_supp_name)
                continue
            
            # Find Invoice
            inv = invoices_map.get(inv_num)
            if not inv:
                # Try alternate key? sometimes filename is used as number?
                # Let's skip if not found.
                continue
            
            # Check if needs update
            if inv.get('supplier_id') != supplier_id:
                # Update!
                # print(f"Linking Invoice {inv_num} to Supplier {raw_supp_name} ({supplier_id})")
                
                url = f"{SUPABASE_URL}/rest/v1/passive_invoices?id=eq.{inv['id']}"
                res = requests.patch(url, headers=headers, json={'supplier_id': supplier_id})
                
                if res.status_code < 300:
                    updates += 1
                else:
                    print(f"Failed to update invoice {inv['id']}: {res.text}")

    print(f"-----")
    print(f"Total updates performed: {updates}")
    if not_found_suppliers:
        print(f"Suppliers in CSV not found in DB ({len(not_found_suppliers)}):")
        print(", ".join(list(not_found_suppliers)[:10]))

if __name__ == '__main__':
    main()
