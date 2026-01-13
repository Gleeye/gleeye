import csv
from collections import Counter

csv_file = 'tabelle_airtable/Ordini.csv'
numbers = []
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        num = row.get('Id_Ordine', '').strip()
        if num:
            numbers.append(num)

dupes = [item for item, count in Counter(numbers).items() if count > 1]
print(f"Duplicates: {dupes}")
print(f"Total orders with number: {len(numbers)}")
print(f"Unique numbers: {len(set(numbers))}")
