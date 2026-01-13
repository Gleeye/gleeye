import csv
import requests
import re

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

def clean_currency(val):
    if not val: return 0.0
    val = val.replace('€', '').replace(' ', '').strip()
    if not val: return 0.0
    if ',' in val and '.' in val:
        if val.find('.') < val.find(','):
            val = val.replace('.', '').replace(',', '.')
        else:
            val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) == 2:
            val = val.replace(',', '.')
        else:
            val = val.replace(',', '')
    val = re.sub(r'[^0-9.]', '', val)
    return float(val) if val else 0.0

def get_db_orders():
    res = requests.get(f"{SUPABASE_URL}/rest/v1/orders?select=*", headers=headers)
    return {o['order_number']: o for o in res.json()}

db_orders = get_db_orders()
csv_file = 'tabelle_airtable/Ordini.csv'

errors = []
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        num = row.get('Id_Ordine', '').strip()
        if not num or num not in db_orders: continue
        
        db_o = db_orders[num]
        fields = {
            'price_planned': 'Prezzi Totali Previsti',
            'price_actual': 'Prezzi Finali',
            'cost_planned': 'Costi Totali Previsti',
            'cost_actual': 'Costi Finali',
            'revenue_planned': 'Ricavi Previsti',
            'revenue_actual': 'Ricavi Finali'
        }
        
        for db_f, csv_f in fields.items():
            csv_val = clean_currency(row.get(csv_f, ''))
            db_val = float(db_o.get(db_f) or 0)
            if abs(db_val - csv_val) > 0.01:
                errors.append(f"Order {num}: {db_f} mismatch. DB={db_val}, CSV={csv_val}")

if errors:
    print(f"Discrepancies found ({len(errors)}):")
    for e in errors[:20]:
        print(f" - {e}")
else:
    print("All financial fields match!")
