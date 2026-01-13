
import csv

csv_file = 'tabelle_airtable/Ordini.csv'
unique_methods = set()

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        m = row.get('Modalita Pagamento', '')
        unique_methods.add(repr(m)) # Use repr to see quotes/whitespace

print("Unique Payment Methods in CSV:")
for m in unique_methods:
    print(m)
