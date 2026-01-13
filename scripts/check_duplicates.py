import requests
import os
import json

# Using credentials found in the codebase (import_suppliers_direct.py)
SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_duplicates():
    print("Fetching all passive invoices...")
    # Fetch all invoices. Limit is high to get all.
    url = f"{SUPABASE_URL}/rest/v1/passive_invoices?select=*&limit=5000"
    res = requests.get(url, headers=headers)
    
    if res.status_code != 200:
        print(f"Error fetching invoices: {res.text}")
        return

    invoices = res.json()
    print(f"Total invoices found: {len(invoices)}")
    
    # Group by invoice_number and supplier info
    grouped = {}
    
    for inv in invoices:
        # Use invoice_number + issue_date + supplier/collaborator as unique key
        number = (inv.get("invoice_number") or "NO_NUMBER").strip()
        date = inv.get("issue_date") or "NO_DATE"
        
        target_id = inv.get("supplier_id") or inv.get("collaborator_id") or "UNKNOWN"
        target_type = "S" if inv.get("supplier_id") else "C" if inv.get("collaborator_id") else "?"
        
        # We need a robust key. 
        # Sometimes duplicates have same number but NULL supplier?
        # Let's group strictly by number + date first?
        # If we have same number and same date, it's likely a duplicate even if supplier is missing in one.
        
        # Let's stick to strict duplicate definition for now:
        # Same Number AND Same Date AND Same Supplier/Collaborator
        
        key = f"{number}|{date}|{target_type}|{target_id}"
        
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(inv)
        
    # Analyze duplicates
    duplicate_count = 0
    invoices_to_delete = 0
    
    print("\n--- DUPLICATE ANALYSIS ---")
    for key, items in grouped.items():
        if len(items) > 1:
            duplicate_count += 1
            invoices_to_delete += (len(items) - 1)
            print(f"Found {len(items)} copies of: {key}")
            # Identify which one to keep (e.g. latest created_at or highest ID)
            items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            keep = items[0]
            # print(f"  Keep ID: {keep['id']} (Created: {keep.get('created_at')})")
            # for item in items[1:]:
            #     print(f"  Delete ID: {item['id']} (Created: {item.get('created_at')})")
            
    print("\n--------------------------")
    print(f"Unique invoice groups: {len(grouped)}")
    print(f"Groups with duplicates: {duplicate_count}")
    print(f"Total redundant invoices to delete: {invoices_to_delete}")

if __name__ == "__main__":
    check_duplicates()
