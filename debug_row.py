import csv
import re

def clean_currency(val):
    if not val: return 0.0
    # Remove Euro and spaces
    val = val.replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return 0.0
    
    # Handle European format: dots as thousands, comma as decimal
    # Or US format: commas as thousands, dot as decimal
    
    # If both , and . exist
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'): # 1.234,56
            val = val.replace('.', '').replace(',', '.')
        else: # 1,234.56
            val = val.replace(',', '')
    elif ',' in val:
        # If only comma, check if it's a decimal or thousands
        parts = val.split(',')
        if len(parts[-1]) == 2 or len(parts[-1]) == 1: # Guessing decimal
            val = val.replace(',', '.')
        else: # Likely thousands: 1,234
            val = val.replace(',', '')
    elif '.' in val:
        # If only dot, it's risky. In Airtable, raw numbers often have no thousands separator.
        # So 1234.56 is likely US decimal.
        # But 1.234 could be thousands?
        # Let's check part length.
        parts = val.split('.')
        if len(parts[-1]) == 3 and len(parts) > 1: # Likely thousands: 1.234
             val = val.replace('.', '')
        # Else we keep it as decimal
            
    val = re.sub(r'[^0-9.]', '', val)
    try:
        return float(val)
    except:
        return 0.0

csv_file = 'tabelle_airtable/Ordini.csv'
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        id_o = row.get('Id_Ordine', '')
        if id_o == '24-0015':
            print(f"Row {id_o}:")
            for k, v in row.items():
                if 'Prezzi' in k or 'Costi' in k or 'Ricavi' in k or 'Totale' in k:
                    print(f"  {k}: '{v}' -> {clean_currency(v)}")
            print(f"  Stato Offerta: '{row.get('Stato Offerta')}'")
            print(f"  Stato Offerte : '{row.get('Stato Offerte ')}'")
