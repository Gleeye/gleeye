import csv

def escape_sql(val):
    if val is None or str(val).strip() == '': return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

csv_file = 'tabelle_airtable/Referenti.csv'
sql_file = 'import_contacts.sql'

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = []
    
    for row in reader:
        first_name = row.get('Nome', '').strip()
        last_name = row.get('Cognome', '').strip()
        full_name = row.get('Referente', '').strip()
        email = row.get('Email', '').strip()
        phone = row.get('Telefono', '').strip()
        mobile = row.get('Mobile', '').strip()
        role = row.get('Ruolo', '').strip()
        client_code = row.get('Cliente', '').strip()
        airtable_id = row.get('Record ID Airtable', '').strip()
        
        if not full_name and not airtable_id:
            continue

        # Subquery per trovare il client_id corretto basato sul codice cliente (client_code)
        client_subquery = f"(SELECT id FROM public.clients WHERE client_code = {escape_sql(client_code)} LIMIT 1)"
        
        vals = [
            client_subquery,
            escape_sql(first_name),
            escape_sql(last_name),
            escape_sql(full_name),
            escape_sql(email),
            escape_sql(phone),
            escape_sql(mobile),
            escape_sql(role),
            escape_sql(airtable_id)
        ]
        rows.append(f"({', '.join(vals)})")

if rows:
    sql = "BEGIN;\n\n"
    sql += "INSERT INTO public.contacts (client_id, first_name, last_name, full_name, email, phone, mobile, role, airtable_id)\nVALUES\n"
    sql += ",\n".join(rows)
    sql += "\nON CONFLICT (airtable_id) DO UPDATE SET\n"
    sql += "client_id = EXCLUDED.client_id, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, full_name = EXCLUDED.full_name, email = EXCLUDED.email, phone = EXCLUDED.phone, mobile = EXCLUDED.mobile, role = EXCLUDED.role;\n\n"
    sql += "COMMIT;"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f"SQL file created: {sql_file} with {len(rows)} rows.")
else:
    print("No rows found.")
