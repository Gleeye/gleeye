
import csv

def inspect_csv():
    multiple_accounts = []
    multiple_contacts = []
    
    with open('tabelle_airtable/Ordini.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            oid = row.get('Id_Ordine')
            acc = row.get('Account')
            ref = row.get('Referente')
            
            if acc and (',' in acc or ' e ' in acc):
                multiple_accounts.append(f"{oid}: {acc}")
                
            if ref and (',' in ref or ' e ' in ref):
                multiple_contacts.append(f"{oid}: {ref}")
                
    print(f"--- Multiple Accounts ({len(multiple_accounts)}) ---")
    for x in multiple_accounts[:10]: print(x)
    
    print(f"\n--- Multiple Contacts ({len(multiple_contacts)}) ---")
    for x in multiple_contacts[:10]: print(x)
    
inspect_csv()
