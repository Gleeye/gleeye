import csv
import re

def escape_sql(val):
    if val is None or str(val).strip() == '': return 'NULL'
    # Escape single quotes
    return "'" + str(val).replace("'", "''") + "'"

def parse_currency(val):
    """
    Converts "€50,00" -> 50.00
    """
    if not val or not val.strip():
        return 'NULL'
    # Remove € and dots (thousands), replace comma with dot
    clean = val.replace('€', '').replace('.', '').replace(',', '.').strip()
    try:
        return str(float(clean))
    except ValueError:
        return 'NULL'

def parse_percent(val):
    """
    Converts "67%" -> 67.0
    """
    if not val or not val.strip():
        return 'NULL'
    clean = val.replace('%', '').replace(',', '.').strip()
    try:
        return str(float(clean))
    except ValueError:
        return 'NULL'

def parse_array_str(val):
    """
    Converts "Foto,Video" -> ARRAY['Foto','Video'] string for SQL
    """
    if not val or not val.strip():
        return 'NULL'
    # Split by comma
    parts = [p.strip() for p in val.split(',') if p.strip()]
    if not parts:
        return 'NULL'
    
    # Build Postgres Array Literal: ARRAY['A','B']
    # Escape single quotes inside elements
    elements = [f"'{p.replace(chr(39), chr(39)*2)}'" for p in parts]
    return f"ARRAY[{', '.join(elements)}]"

csv_file = 'tabelle_airtable/Tariffario Servizi.csv'
sql_file = 'import_services.sql'

services_data = []

# Map CSV columns to DB fields and parsing functions
# (CSV Header) -> (DB Column, Parser)
mapping = {
    'Tariffa': ('name', escape_sql),
    'Costo': ('cost', parse_currency),
    'Prezzo': ('price', parse_currency),
    'Margine': ('margin', parse_currency),
    '% Margine': ('margin_percent', parse_percent),
    'Tags': ('tags', parse_array_str),
    'Tipo tariffa': ('type', escape_sql),
    'Dettagli Tariffa': ('details', escape_sql),
    'Area text': ('notes', escape_sql),
    'Template Servizi in Vendita': ('template_name', escape_sql),
    'Table 8': ('linked_service_ids', parse_array_str),
    'Registro Collaboratori copy': ('linked_collaborator_ids', parse_array_str),
}

print(f"Reading {csv_file}...")

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for i, row in enumerate(reader):
        entry = {}
        # Basic fields
        for csv_col, (db_col, parser) in mapping.items():
            raw_val = row.get(csv_col, '')
            entry[db_col] = parser(raw_val)
        
        # Determine airtable_id (use Name if unique, or row index fallback if needed, 
        # but better to assume Name/Tariffa is unique key for now or generate a composite)
        # The CSV doesn't seem to have a dedicated ID column like 'id'. 
        # We will use 'Tariffa' (name) as the unique key for upsert in this script, or we can use the Name as airtable_id.
        name_val = row.get('Tariffa', '')
        if name_val:
             entry['airtable_id'] = escape_sql(name_val) 
        else:
             # Skip empty rows
             continue

        services_data.append(entry)

print(f"Parsed {len(services_data)} records.")

# Generate SQL
sql = ["BEGIN;"]

sql.append("\n-- Sync Services")
# Columns
cols = [
    'name', 'cost', 'price', 'margin', 'margin_percent', 'tags', 
    'type', 'details', 'notes', 'template_name', 
    'linked_service_ids', 'linked_collaborator_ids', 'airtable_id'
]
col_str = ", ".join(cols)

sql.append(f"INSERT INTO public.services ({col_str}) VALUES")

vals_list = []
for s in services_data:
    row_vals = [str(s[c]) for c in cols]
    vals_list.append(f"({', '.join(row_vals)})")

sql.append(",\n".join(vals_list))

sql.append("ON CONFLICT (airtable_id) DO UPDATE SET")
updates = []
for c in cols:
    if c != 'airtable_id': # Don't update the key
        updates.append(f"{c} = EXCLUDED.{c}")
sql.append(", ".join(updates) + ";")

sql.append("\nCOMMIT;")

with open(sql_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql))

print(f"SQL generated: {sql_file}")
