import requests

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

# The REST API doesn't support raw SQL easily unless we have an RPC.
# But we can use the SQL query endpoint if available, or just use the PATCH methods.
# Since I have 74 records, I will just iterate and update them via the REST API.

import csv
import re

def clean_currency(val):
    if not val: return 0.0
    val = str(val).replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'): val = val.replace('.', '').replace(',', '.')
        else: val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) == 2 or len(parts[-1]) == 1: val = val.replace(',', '.')
        else: val = val.replace(',', '')
    elif '.' in val:
        parts = val.split('.')
        if len(parts[-1]) == 3 and len(parts) > 1: val = val.replace('.', '')
    val = re.sub(r'[^0-9.]', '', val)
    try: return float(val)
    except: return 0.0

csv_file = 'tabelle_airtable/Ordini.csv'
print("🚀 Starting direct database update...")

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        num = row.get('Id_Ordine', '').strip()
        if not num: continue
        
        # Prices
        price_planned = clean_currency(row.get('Prezzi Totali Previsti', ''))
        price_actual = clean_currency(row.get('Prezzi Finali', ''))
        cost_planned = clean_currency(row.get('Costi Totali Previsti', ''))
        cost_actual = clean_currency(row.get('Costi Finali', ''))
        revenue_planned = clean_currency(row.get('Ricavi Previsti', ''))
        revenue_actual = clean_currency(row.get('Ricavi Finali', ''))
        
        total_p = 0.0
        p_tot_val = clean_currency(row.get('Totale Commessa', ''))
        if price_actual > 0: total_p = price_actual
        elif p_tot_val > 0: total_p = p_tot_val
        else: total_p = price_planned

        data = {
            "offer_status": row.get('Stato Offerte ', '').strip(),
            "price_planned": price_planned,
            "price_actual": price_actual,
            "cost_planned": cost_planned,
            "cost_actual": cost_actual,
            "revenue_planned": revenue_planned,
            "revenue_actual": revenue_actual,
            "total_price": total_p,
            "status_works": row.get('Stato Lavori', '').strip()
        }
        
        url = f"{SUPABASE_URL}/rest/v1/orders?order_number=eq.{num}"
        res = requests.patch(url, headers=headers, json=data)
        if res.status_code in [200, 204]:
            print(f"✅ Order {num} updated.")
        else:
            print(f"❌ Order {num} failed: {res.text}")

print("✨ Done!")
