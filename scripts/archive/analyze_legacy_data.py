import csv
import sys

def analyze_csv(path):
    print(f"Analyzing {path}...")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            modes = {}
            for row in reader:
                # The column name might technically vary slightly or have spaces, so we key safely
                # In the header printed earlier: "Modalita Pagamento" seems correct.
                mode = row.get('Modalita Pagamento') or row.get('Modalità Pagamento')
                if mode:
                    modes[mode] = modes.get(mode, 0) + 1
                    
                # Setup samples for other fields
                if mode == 'Anticipo + Rate' or mode == 'Anticipo e saldo alla chiusura del progetto':
                    print(f"Sample for {mode}:")
                    print(f"  Anticipo: {row.get('Anticipo')}")
                    print(f"  Valore Anticipo: {row.get('Valore Anticipo')}")
                    print(f"  Saldo: {row.get('Saldo')}")
                    print(f"  Valore Saldo: {row.get('Valore Saldo')}")
                    print(f"  N. Rate: {row.get('N. Rate')}")
                    print("-" * 20)

            print("\nUnique 'Modalita Pagamento' values:")
            for m, count in modes.items():
                print(f"  '{m}': {count}")

    except Exception as e:
        print(f"Error: {e}")

analyze_csv('tabelle_airtable/Incarichi.csv')
