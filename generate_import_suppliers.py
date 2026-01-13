import csv
import os

csv_file_path = 'tabelle_airtable/Fornitori.csv'
sql_output_path = 'import_suppliers.sql'

def clean_currency(value):
    if not value:
        return 'NULL'
    # Remove € symbol, thousands separator dots, and replace decimal comma with dot
    cleaned = value.replace('€', '').replace('.', '').replace(',', '.').strip()
    return cleaned if cleaned else 'NULL'

def escape_sql(value):
    if not value:
        return 'NULL'
    return "'" + value.replace("'", "''") + "'"

print(f"Reading from {csv_file_path}...")

with open(csv_file_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    
    # Handle BOM and whitespace in headers
    reader.fieldnames = [key.strip().lstrip('\ufeff') for key in reader.fieldnames]
    
    sql_statements = []
    sql_statements.append("TRUNCATE TABLE public.suppliers CASCADE;") 
    
    for row in reader:
        # Get values with safe get, strip keys just in case
        name = row.get('Name')
        url = row.get('URL', '')
        notes = row.get('Notes', '')
        
        if not name:
            continue
            
        # Clean values
        name = name.strip()
        if url: url = url.strip()
        if notes: notes = notes.strip()

        sql = f"INSERT INTO public.suppliers (name, website, notes) VALUES ({escape_sql(name)}, {escape_sql(url)}, {escape_sql(notes)}) ON CONFLICT (name) DO NOTHING;" 
        sql_statements.append(sql)

with open(sql_output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print(f"Generated {len(sql_statements)} SQL statements to {sql_output_path}")
