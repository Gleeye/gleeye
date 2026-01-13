
import csv

def peek_account():
    with open('tabelle_airtable/Ordini.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i > 5: break
            print(f"Row {i}: Account='{row.get('Account')}', Account Gleeye='{row.get('Account Gleeye')}', Referente='{row.get('Referente')}'")

peek_account()
