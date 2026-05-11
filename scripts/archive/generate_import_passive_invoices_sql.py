import csv
import re
from datetime import datetime

# Function to clean currency strings
def clean_currency(val):
    if not val: return '0'
    # Remove €, spaces and other chars, then replace comma with dot
    # Example: "€1.677,75" -> 1677.75
    cleaned = re.sub(r'[^\d,.-]', '', val)
    # If there are multiple dots/commas, we need to be careful.
    # Italian format: 1.234,56
    # Remove dots (thousands sep)
    cleaned = cleaned.replace('.', '')
    # Replace comma with dot (decimal)
    cleaned = cleaned.replace(',', '.')
    try:
        return str(float(cleaned))
    except:
        return '0'

def parse_date(date_str):
    if not date_str: return 'NULL'
    try:
        # DD/MM/YYYY
        dt = datetime.strptime(date_str.strip(), '%d/%m/%Y')
        return f"'{dt.strftime('%Y-%m-%d')}'"
    except:
        return 'NULL'

def escape_sql(val):
    if val is None or str(val).strip() == '': return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

suppliers_csv = 'tabelle_airtable/Fornitori.csv'
invoices_csv = 'tabelle_airtable/Fatture Passive.csv'
sql_file = 'import_passive_invoices.sql'

sql_statements = [
    "TRUNCATE TABLE public.passive_invoices CASCADE;",
    "TRUNCATE TABLE public.suppliers CASCADE;",
    "\nBEGIN;"
]

# 1. Process Suppliers
sql_statements.append("\n-- Import Suppliers")
sql_statements.append("INSERT INTO public.suppliers (name, notes) VALUES")

supplier_rows = []
existing_suppliers = set()

try:
    with open(suppliers_csv, mode='r', encoding='utf-8-sig') as f:
        # Read file content and remove null bytes
        content = f.read().replace('\0', '')
        from io import StringIO
        f_obj = StringIO(content)
        
        reader = csv.DictReader(f_obj)
        for row in reader:
            name = row.get('Name', '').strip()
            if not name: continue
            
            if name in existing_suppliers: continue
            existing_suppliers.add(name)
            
            notes = row.get('Notes', '').strip()
            
            val_str = f"({escape_sql(name)}, {escape_sql(notes)})"
            supplier_rows.append(val_str)
except FileNotFoundError:
    print(f"Warning: {suppliers_csv} not found.")

if supplier_rows:
    sql_statements.append(",\n".join(supplier_rows))
    sql_statements.append("\nON CONFLICT (id) DO NOTHING;") # Schema doesn't have unique constraint on name yet, but we rely on IDs mostly. 
    # Actually, we should probably add a UNIQUE constraint on name if we want to upsert properly, or just insert.
    # For now, let's just insert.
    # Wait, if we run this multiple times, we duplicate suppliers.
    # Let's add ON CONFLICT DO NOTHING but we need a constraint.
    # I'll rely on the user running this once or I should assume empty table.
    # I will modify schema to add UNIQUE(name) for suppliers?
    # Or I can just continue.
    pass
else:
    sql_statements.pop() # Remove INSERT line

# 2. Process Passive Invoices
sql_statements.append("\n\n-- Import Passive Invoices")
sql_statements.append("INSERT INTO public.passive_invoices (invoice_number, issue_date, payment_date, status, amount_tax_included, amount_tax_excluded, tax_amount, ritenuta, rivalsa_inps, iva_attiva, amount_paid, supplier_id, collaborator_id, notes, category, related_orders, attachment_url) VALUES")

invoice_rows = []

try:
    with open(invoices_csv, mode='r', encoding='utf-8-sig') as f:
        # Read file content and remove null bytes
        content = f.read().replace('\0', '')
        from io import StringIO
        f_obj = StringIO(content)
        
        reader = csv.DictReader(f_obj)
        for row in reader:
            invoice_num = row.get('N.', '').strip()
            if not invoice_num: continue # Skip if no invoice number? Or generate one?
            
            # Type detection
            tipo = row.get('Tipo', '').strip()
            
            supplier_subquery = "NULL"
            collaborator_subquery = "NULL"
            
            if tipo == 'Fornitori':
                supplier_name = row.get('Fornitori', '').strip()
                if supplier_name:
                    # Look up supplier by name. We just inserted them.
                    supplier_subquery = f"(SELECT id FROM public.suppliers WHERE name = {escape_sql(supplier_name)} LIMIT 1)"
            
            elif tipo == 'Collaboratori':
                collab_name = row.get('Collaboratore', '').strip()
                if collab_name:
                    # Look up collaborator.
                    # Try matching name, or full_name?
                    # The CSV likely has the name used in 'Name' column of Collaborators.
                    collaborator_subquery = f"(SELECT id FROM public.collaborators WHERE name = {escape_sql(collab_name)} OR full_name = {escape_sql(collab_name)} LIMIT 1)"
            
            issue_date = parse_date(row.get('Data Fattura', ''))
            payment_date = parse_date(row.get('Data saldo', ''))
            status = row.get('Stato', '').strip()
            
            # Amounts
            amount_inc = clean_currency(row.get('Importo', '')) 
            amount_exc = clean_currency(row.get('Pagato', '')) 
            tax = clean_currency(row.get('IVA', ''))
            ritenuta = clean_currency(row.get('Ritenuta', ''))
            rivalsa = clean_currency(row.get('Rivalsa Inps', ''))
            # Mapping 'checked' to boolean
            raw_iva_attiva = row.get('Iva Attiva', '').strip().lower()
            iva_attiva = 'true' if raw_iva_attiva == 'checked' else 'false'
            
            # For collaborators: Importo is usually taxable base, Pagato is usually the final flow
            # For suppliers: Importo is usually the total, Pagato is what was paid
            # Mapping from CSV:
            # Importo Column -> Taxable Base (amount_tax_excluded)
            # IVA Column -> Tax Amount (tax_amount)
            # Rivalsa Inps Column -> Rivalsa INPS (rivalsa_inps)
            # Pagato Column -> Total cash flow / Paid (amount_paid)
            # Calculated: Total Doc (amount_tax_included) = Taxable + Tax + Rivalsa
            
            raw_importo = clean_currency(row.get('Importo', ''))
            raw_iva = clean_currency(row.get('IVA', ''))
            raw_rivalsa = clean_currency(row.get('Rivalsa Inps', ''))
            raw_ritenuta = clean_currency(row.get('Ritenuta', ''))
            raw_pagato = clean_currency(row.get('Pagato', ''))

            val_taxable = float(raw_importo)
            val_tax = float(raw_iva)
            val_rivalsa = float(raw_rivalsa)
            val_ritenuta = float(raw_ritenuta)
            val_paid = float(raw_pagato)
            
            # Total document amount (Lordo)
            val_total_doc = val_taxable + val_tax + val_rivalsa
            
            notes = row.get('Notes', '').strip() 
            category = row.get('Servizio Fornitore', '').strip()
            tipo_collab = row.get('Tipo Collaborazione', '').strip()
            
            # Detect Ritenuta d'acconto vs Fattura
            # Priority 1: Check if it's explicitly marked as Ritenuta or has a ritenuta amount
            if val_ritenuta > 0 or tipo_collab == 'Ritenuta':
                category = "Ritenuta d'acconto"
            # Priority 2: If it's a collaborator and type is Fattura, use that
            elif tipo_collab == 'Fattura':
                category = "Fattura"
            # Priority 3: Fallback for collaborators if no specific category or type
            elif not category and tipo == 'Collaboratori':
                category = "Prestazione Ocassionale" 
                
            
            # Attachment
            # Airtable exports attachments like "filename (url)" or just multiple filenames.
            # Example: "Fattura...pdf (https://...)"
            raw_attachment = row.get('Allegato', '')
            attachment_url = ''
            if 'http' in raw_attachment:
                # Extract URL inside parentheses
                match = re.search(r'\((https?://[^)]+)\)', raw_attachment)
                if match:
                    attachment_url = match.group(1)
            
            # SQL row
            val_str = f"({escape_sql(invoice_num)}, {issue_date}, {payment_date}, {escape_sql(status)}, {val_total_doc}, {val_taxable}, {val_tax}, {val_ritenuta}, {val_rivalsa}, {iva_attiva}, {val_paid}, {supplier_subquery}, {collaborator_subquery}, {escape_sql(notes)}, {escape_sql(category)}, {escape_sql(row.get('Ordini', ''))}, {escape_sql(attachment_url)})"
            invoice_rows.append(val_str)

except FileNotFoundError:
    print(f"Warning: {invoices_csv} not found.")

if invoice_rows:
    sql_statements.append(",\n".join(invoice_rows))
    sql_statements.append(";")
else:
    sql_statements.pop()

sql_statements.append("\nCOMMIT;")

with open(sql_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_statements))

print(f"SQL file created: {sql_file} with {len(supplier_rows)} supplies and {len(invoice_rows)} invoices.")
