import requests
import time

# Configuration
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

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
    print("🚀 Starting Passive Invoice Link Fix...")

    # 1. Fetch Data
    transactions = fetch_all('bank_transactions', 'id,external_ref_passive_invoice,passive_invoice_id,supplier_id,collaborator_id')
    
    # We only care about ones with external_ref and NO passive_invoice_id
    targets = [t for t in transactions if t.get('external_ref_passive_invoice') and not t.get('passive_invoice_id')]
    print(f"Found {len(targets)} transactions needing linkage.")
    
    if not targets:
        print("Nothing to fix.")
        return

    # Fetch reference tables
    passive_invoices = fetch_all('passive_invoices', 'id,invoice_number,supplier_id,collaborator_id')
    suppliers = fetch_all('suppliers', 'id,name')
    collaborators = fetch_all('collaborators', 'id,full_name,name') # name or full_name

    # Create maps for entity ID lookup
    supplier_map = {s['id']: s['name'].lower() for s in suppliers if s.get('name')}
    collab_map = {}
    for c in collaborators:
        name = c.get('full_name') or c.get('name')
        if name: collab_map[c['id']] = name.lower()

    matches_found = 0
    
    for t in targets:
        ref = t['external_ref_passive_invoice'].lower()
        t_supplier = t.get('supplier_id')
        t_collab = t.get('collaborator_id')
        
        match = None
        
        # Strategy 1: Entity ID Match + Invoice Number
        for cand in passive_invoices:
            # Check Entity Match
            entity_match = False
            if t_supplier and cand.get('supplier_id') == t_supplier:
                entity_match = True
            elif t_collab and cand.get('collaborator_id') == t_collab:
                entity_match = True
            
            # If entity matches, check invoice number
            if entity_match:
                inv_num = cand.get('invoice_number', '').lower()
                if inv_num and inv_num in ref:
                    match = cand
                    break
        
        # Strategy 2: Text Fallback (if no strict entity match found)
        # Try to match the supplier/collab name from the invoice against the ref string
        if not match:
            for cand in passive_invoices:
                cand_inv_num = cand.get('invoice_number', '').lower()
                if not cand_inv_num: continue
                
                # Verify if invoice number is in ref
                if cand_inv_num in ref:
                    # Now check if the entity name is also in the ref (loose match)
                    cand_supp_id = cand.get('supplier_id')
                    cand_collab_id = cand.get('collaborator_id')
                    
                    name_match = False
                    if cand_supp_id and cand_supp_id in supplier_map:
                        supp_name = supplier_map[cand_supp_id]
                        if supp_name in ref: name_match = True
                            
                    if cand_collab_id and cand_collab_id in collab_map:
                        collab_name = collab_map[cand_collab_id]
                        if collab_name in ref: name_match = True
                    
                    if name_match:
                        match = cand
                        break

        if match:
            print(f"✅ Linking Transaction {t['id']} -> Invoice {match['invoice_number']} (Ref: {t['external_ref_passive_invoice']})")
            
            # Update DB
            url = f"{SUPABASE_URL}/rest/v1/bank_transactions?id=eq.{t['id']}"
            payload = {"passive_invoice_id": match['id']}
            
            # Also fix missing entity link if we found it via text match
            if not t_supplier and not t_collab:
                if match.get('supplier_id'): payload['supplier_id'] = match['supplier_id']
                if match.get('collaborator_id'): payload['collaborator_id'] = match['collaborator_id']

            r = requests.patch(url, json=payload, headers=HEADERS)
            
            if r.status_code in [200, 204]:
                matches_found += 1
            else:
                print(f"❌ Failed to update: {r.text}")
        else:
            print(f"⚠️ No match found for Ref: {t['external_ref_passive_invoice']}")

    print(f"🎉 Finished. Linked {matches_found}/{len(targets)} transactions.")

if __name__ == '__main__':
    main()
