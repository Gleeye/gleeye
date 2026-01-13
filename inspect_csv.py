import csv

csv_file = 'tabelle_airtable/Ordini.csv'
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    cols = ['Id_Ordine', 'Clienti', 'Stato Offerte ', 'Stato Lavori', 'Prezzi Finali', 'Totale Commessa']
    header = " | ".join(f"{c:<15}" for c in cols)
    print(header)
    print("-" * len(header))
    count = 0
    for row in reader:
        line = " | ".join(f"{str(row.get(c, ''))[:15]:<15}" for c in cols)
        print(line)
        count += 1
        if count >= 20:
            break
