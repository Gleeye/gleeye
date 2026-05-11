import csv
import requests

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

def get_db_clients():
    res = requests.get(f"{SUPABASE_URL}/rest/v1/clients?select=client_code,id", headers=headers)
    return {c['client_code']: c['id'] for c in res.json()}

db_clients = get_db_clients()
csv_file = 'tabelle_airtable/Ordini.csv'

missing_clients = set()
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        client = row.get('Clienti', '').strip()
        if client and client not in db_clients:
            missing_clients.add(client)

if missing_clients:
    print(f"Missing clients in DB ({len(missing_clients)}):")
    for c in sorted(list(missing_clients)):
        print(f" - {c}")
else:
    print("All clients in CSV found in DB!")
