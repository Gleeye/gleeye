import requests
import os
import json

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def reconcile():
    print("Fetching all passive invoices...")
    url = f"{SUPABASE_URL}/rest/v1/passive_invoices?select=*&limit=5000"
    res = requests.get(url, headers=headers)
    
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return

    invoices = res.json()
    print(f"Total invoices: {len(invoices)}")
    
    grouped = {}
    for inv in invoices:
        number = (inv.get("invoice_number") or "NO_NUMBER").strip()
        date = inv.get("issue_date") or "NO_DATE"
        target_id = inv.get("supplier_id") or inv.get("collaborator_id") or "UNKNOWN"
        target_type = "S" if inv.get("supplier_id") else "C" if inv.get("collaborator_id") else "?"
        
        key = f"{number}|{date}|{target_type}|{target_id}"
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(inv)
        
    ids_to_delete = []
    
    print("Identifying duplicates...")
    for key, items in grouped.items():
        if len(items) > 1:
            # Sort by created_at descending (keep newest)
            # If created_at is missing, sort by ID (random but consistent)
            items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            # Keep the first one, delete the rest
            keep = items[0]
            to_remove = items[1:]
            
            for item in to_remove:
                ids_to_delete.append(item['id'])
            
            # print(f"Keeping {keep['id']} for {key}, deleting {len(to_remove)} duplicates")

    print(f"Found {len(ids_to_delete)} invoices to delete.")
    
    if not ids_to_delete:
        print("No duplicates to delete.")
        return

    # Batch delete
    # Supabase REST doesn't support massive DELETE with list of IDs easily in one go unless using 'in' filter with comma separated.
    # URI length limit is a concern. Let's do batches of 20.
    
    batch_size = 20
    for i in range(0, len(ids_to_delete), batch_size):
        batch = ids_to_delete[i:i+batch_size]
        id_list = ",".join(batch)
        del_url = f"{SUPABASE_URL}/rest/v1/passive_invoices?id=in.({id_list})"
        
        print(f"Deleting batch {i // batch_size + 1}...")
        r = requests.delete(del_url, headers=headers)
        if r.status_code >= 300:
            print(f"Error deleting batch: {r.text}")
        else:
            print("Batch deleted.")

    print("Reconciliation complete.")

if __name__ == "__main__":
    reconcile()
