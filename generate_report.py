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
    val = val.replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'):
            val = val.replace('.', '').replace(',', '.')
        else:
            val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) == 2: val = val.replace(',', '.')
        else: val = val.replace(',', '')
    val = re.sub(r'[^0-9.]', '', val)
    try: return float(val)
    except: return 0.0

def get_db_orders():
    res = requests.get(f"{SUPABASE_URL}/rest/v1/orders?select=*", headers=headers)
    return {o['order_number']: o for o in res.json()}

db_orders = get_db_orders()
csv_file = 'tabelle_airtable/Ordini.csv'

with open('data_comparison_report.txt', 'w', encoding='utf-8') as report:
    with open(csv_file, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            num = row.get('Id_Ordine', '').strip()
            if not num: continue
            
            report.write(f"--- ORDER {num} ---\n")
            if num not in db_orders:
                report.write("  MISSING IN DB\n")
                continue
            
            db_o = db_orders[num]
            
            # Check Status mapping
            csv_s1 = row.get('Stato Offerta', '').strip()
            csv_s2 = row.get('Stato Offerte ', '').strip()
            report.write(f"  Status: DB='{db_o['offer_status']}', CSV1='{csv_s1}', CSV2='{csv_s2}'\n")
            
            # Check Prices
            p_prev = clean_currency(row.get('Prezzi Totali Previsti', ''))
            p_fin = clean_currency(row.get('Prezzi Finali', ''))
            p_tot = clean_currency(row.get('Totale Commessa', ''))
            report.write(f"  Price: DB_Planned={db_o['price_planned']}, DB_Actual={db_o['price_actual']}, CSV_Prev={p_prev}, CSV_Fin={p_fin}, CSV_Tot={p_tot}\n")
            
            # Check Revenue
            r_prev = clean_currency(row.get('Ricavi Previsti', ''))
            r_fin = clean_currency(row.get('Ricavi Finali', ''))
            report.write(f"  Revenue: DB_Planned={db_o['revenue_planned']}, DB_Actual={db_o['revenue_actual']}, CSV_Prev={r_prev}, CSV_Fin={r_fin}\n")
            
            report.write("\n")

print("Report generated: data_comparison_report.txt")
