
import csv

csv_file = 'tabelle_airtable/Ordini.csv'
unique_frequencies = set()

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        freq = row.get('Tipo rateizzazione', '').strip()
        if freq:
            unique_frequencies.add(freq)

print("Unique Frequencies in CSV:")
for f in sorted(list(unique_frequencies)):
    print(f"- {f}")
