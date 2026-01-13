
import requests
import json

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def migrate_contacts():
    print("🚀 Starting Migration: orders.contact_id -> order_contacts")
    
    # 1. Fetch Orders with contact_id
    r = requests.get(f"{SUPABASE_URL}/rest/v1/orders?contact_id=not.is.null&select=id,contact_id", headers=HEADERS)
    orders = r.json()
    print(f"Found {len(orders)} orders with legacy contact_id")
    
    # 2. Insert into order_contacts
    count = 0
    for o in orders:
        payload = {
            "order_id": o['id'],
            "contact_id": o['contact_id'],
            "role": "Referente"
        }
        # Upsert (ignore conflict)
        res = requests.post(f"{SUPABASE_URL}/rest/v1/order_contacts", headers=HEADERS, json=payload, params={"on_conflict": "order_id,contact_id"})
        if res.status_code < 300:
            count += 1
        else:
            print(f"Error migrating order {o['id']}: {res.text}")
            
    print(f"✅ Migrated {count} contacts.")

if __name__ == '__main__':
    migrate_contacts()
