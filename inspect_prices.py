import csv

csv_file = 'tabelle_airtable/Ordini.csv'
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    print(f"{'Id_Ordine':<10} | {'Previsti':<10} | {'Finali':<10} | {'Totale Commessa':<15}")
    count = 0
    for row in reader:
        prev = row.get('Prezzi Totali Previsti', '')
        final = row.get('Prezzi Finali', '')
        tot = row.get('Totale Commessa', '')
        print(f"{row['Id_Ordine']:<10} | {prev:<10} | {final:<10} | {tot:<15}")
        count += 1
        if count >= 30:
            break
