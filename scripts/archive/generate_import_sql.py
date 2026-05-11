import csv
import json

def escape_sql(val):
    if val is None or str(val).strip() == '':
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

csv_file = 'tabelle_airtable/Clienti.csv'
sql_file = 'import_clients.sql'

# Use 'utf-8-sig' to handle potential BOM from Excel
with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    print(f"Columns found: {reader.fieldnames}")
    rows = []
    for row in reader:
        # Mapping with strip to handle whitespace
        client_code = row.get('ID Cliente', '').strip()
        business_name = row.get('Denominazione', '').strip()
        
        # Priority: Denominazione > ID Cliente
        final_name = business_name if business_name else client_code
            
        vat = row.get('P. IVA', '').strip()
        fiscal = row.get('Codice Fiscale', '').strip()
        address = row.get('Indirizzo', '').strip()
        city = row.get('Città', '').strip()
        zip_code = row.get('Cap', '').strip()
        province = row.get('Provincia', '').strip()
        sdi = row.get('Codice SDI', '').strip()
        pec = row.get('Pec', '').strip()
        email = row.get('Email', '').strip()
        phone = row.get('Telefono', '').strip()
        dropbox = row.get('Link Dropbox', '').strip()
        airtable_id = row.get('Record ID Airtable', '').strip()

        if not final_name and not airtable_id:
            continue # Skip ghost rows

        vals = [
            escape_sql(final_name),
            escape_sql(vat),
            escape_sql(fiscal),
            escape_sql(address),
            escape_sql(city),
            escape_sql(zip_code),
            escape_sql(province),
            escape_sql(sdi),
            escape_sql(pec),
            escape_sql(email),
            escape_sql(phone),
            escape_sql(dropbox),
            escape_sql(airtable_id),
            escape_sql(client_code)
        ]
        rows.append(f"({', '.join(vals)})")

if rows:
    sql = "INSERT INTO public.clients (business_name, vat_number, fiscal_code, address, city, zip_code, province, sdi_code, pec, email, phone, dropbox_folder, airtable_id, client_code)\nVALUES\n"
    sql += ",\n".join(rows)
    sql += "\nON CONFLICT (airtable_id) DO UPDATE SET\n"
    sql += "business_name = EXCLUDED.business_name, vat_number = EXCLUDED.vat_number, fiscal_code = EXCLUDED.fiscal_code, address = EXCLUDED.address, city = EXCLUDED.city, zip_code = EXCLUDED.zip_code, province = EXCLUDED.province, sdi_code = EXCLUDED.sdi_code, pec = EXCLUDED.pec, email = EXCLUDED.email, phone = EXCLUDED.phone, dropbox_folder = EXCLUDED.dropbox_folder, client_code = EXCLUDED.client_code;"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f"SQL file created: {sql_file} with {len(rows)} rows.")
else:
    print("No rows found.")
