import csv
import requests
import json
import time

# Supabase Config
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

csv_file = 'tabelle_airtable/Ordini.csv'

print("Starting fix for Phantom Payment Data...")

count = 0
fixed = 0

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        order_number = row.get('Id_Ordine', '').strip()
        payment_method = row.get('Modalita Pagamento', '').strip()

        # If original CSV had NO payment method, we must ensure DB is NULL
        if not payment_method and order_number:
            count += 1
            
            # Construct the query to find the order by order_number
            url = f"{SUPABASE_URL}/rest/v1/orders?order_number=eq.{order_number}"
            
            # Patch payload: set payment_mode to None (NULL in JSON)
            # We also clear other fields just to be clean
            payload = {
                "payment_mode": None,
                #"payment_method": None, # Removed: column does not exist
                "deposit_percentage": 0,
                "balance_percentage": 0,
                "installments_count": 0
            }

            try:
                response = requests.patch(url, headers=headers, json=payload)
                if response.status_code in [200, 204]:
                    fixed += 1
                    # print(f"Fixed Order {order_number}")
                else:
                    print(f"Failed to fix {order_number}: {response.status_code} - {response.text}")
            except Exception as e:
                print(f"Error on {order_number}: {e}")
            
            # Rate limit politeness
            if count % 10 == 0:
                print(f"Processed {count} empty-payment rows...")
                time.sleep(0.1)

print(f"Validating complete. Found {count} orders with empty payment in CSV.")
print(f"Successfully reset {fixed} orders to NULL configuration.")
