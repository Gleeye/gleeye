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

def find_adobe():
    print("Fetching invoices...")
    url = f"{SUPABASE_URL}/rest/v1/passive_invoices?select=*&limit=5000"
    res = requests.get(url, headers=headers)
    invoices = res.json()
    
    keywords = ["adobe", "creative", "photoshop", "illustrator", "acrobat"]
    
    found = []
    for inv in invoices:
        text = (str(inv.get('description') or '') + str(inv.get('notes') or '') + str(inv.get('category') or '')).lower()
        if any(k in text for k in keywords):
            found.append(inv)
            
    print(f"Found {len(found)} potential Adobe invoices:")
    for inv in found:
        print(f"ID: {inv['id']} | Num: {inv['invoice_number']} | Date: {inv['issue_date']} | SupplierID: {inv['supplier_id']}")
        
    if len(found) == 0:
        print("No Adobe-related invoices found in database.")

if __name__ == "__main__":
    find_adobe()
