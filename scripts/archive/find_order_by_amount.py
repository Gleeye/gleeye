
import csv

csv_file = 'tabelle_airtable/Ordini.csv'
target_amount = "26250" # Looking for string match part

print(f"Searching for amount {target_amount} in CSV...")

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Check price fields
        found = False
        for k in row.keys():
            if row[k] and target_amount in row[k].replace('.', '').replace(',', ''):
                found = True
        
        if found:
            print(f"MATCH: ID={row['Id_Ordine']}, Method='{row.get('Modalita Pagamento', '')}', Total='{row.get('Totale Commessa', '')}'")

