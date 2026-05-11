import csv
import re

# Input and output file paths
CSV_FILE_PATH = 'tabelle_airtable/Registro Movimenti.csv'
OUTPUT_SQL_FILE = 'import_transactions.sql'

def escape_sql_string(value):
    if not value:
        return 'NULL'
    return "'" + value.replace("'", "''") + "'"

def parse_currency(value):
    if not value:
        return 'NULL'
    # Remove € and replace , with .
    clean_val = value.replace('€', '').replace('.', '').replace(',', '.').strip()
    return clean_val

def parse_date(value):
    if not value:
        return 'NULL'
    # Expecting D/M/YYYY
    parts = value.split('/')
    if len(parts) == 3:
        return f"'{parts[2]}-{parts[1]}-{parts[0]}'"
    return 'NULL'

def main():
    print(f"Reading CSV from {CSV_FILE_PATH}...")
    
    categories = set()
    transactions = []
    
    print(f"Reading CSV from {CSV_FILE_PATH}...")
    
    categories = set()
    transactions = []
    
    # Read file content and remove NULL bytes
    with open(CSV_FILE_PATH, mode='r', encoding='utf-8', errors='replace') as f:
        content = f.read().replace('\x00', '')
    
    from io import StringIO
    csvfile = StringIO(content)
    reader = csv.DictReader(csvfile)
    
    for row in reader:
        # Collect categories
        # "Tipo Uscita" seems to be the category field for exits
        # The user mentioned "Tipo Movimento" as well.
        tipo_mov = row.get('Tipo Movimento', '').strip()
        tipo_uscita = row.get('Tipo Uscita', '').strip()
        
        cat_name = None
        cat_type = 'altro'
        
        if tipo_mov == 'Entrata':
            cat_type = 'entrata'
            cat_name = 'Entrata Generica' # Default if no specific field
        elif tipo_mov == 'Uscita':
            cat_type = 'uscita'
            if tipo_uscita:
                cat_name = tipo_uscita
            else:
                cat_name = 'Uscita Generica'
        
        if cat_name:
            categories.add((cat_name, cat_type))
        
        transactions.append({
            'row': row,
            'cat_name': cat_name,
            'cat_type': cat_type
        })

    with open(OUTPUT_SQL_FILE, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated import script for Bank Transactions\n\n")
        
        # 1. Insert Categories
        f.write("-- 1. Insert Categories\n")
        for name, type_ in categories:
            safe_name = escape_sql_string(name)
            safe_type = escape_sql_string(type_)
            f.write(f"""
INSERT INTO public.transaction_categories (name, type)
VALUES ({safe_name}, {safe_type})
ON CONFLICT (name, type) DO NOTHING;
""")
        
        f.write("\n-- 2. Insert Transactions\n")
        
        for item in transactions:
            row = item['row']
            old_id = escape_sql_string(row.get('Name'))
            date_val = parse_date(row.get('Data'))
            type_val = escape_sql_string(row.get('Tipo Movimento').lower() if row.get('Tipo Movimento') else None)
            amount_val = parse_currency(row.get('Prezzo'))
            desc_val = escape_sql_string(row.get('Descrizione'))
            
            cat_name = item['cat_name']
            cat_type = item['cat_type']
            
            # Subquery to find category_id
            if cat_name:
                category_subquery = f"(SELECT id FROM public.transaction_categories WHERE name = {escape_sql_string(cat_name)} AND type = {escape_sql_string(cat_type)} LIMIT 1)"
            else:
                category_subquery = "NULL"
            
            counterparty = row.get('Azienda', '').strip()
            safe_counterparty = escape_sql_string(counterparty)
            
            # Client / Supplier Subqueries
            # If Entrata -> Client? If Uscita -> Supplier?
            # User didn't specify strict rule, but usually:
            client_subquery = "NULL"
            supplier_subquery = "NULL"
            
            if counterparty:
                clean_cp = counterparty.replace("'", "''")
                # Try simple ILIKE match
                client_subquery = f"(SELECT id FROM public.clients WHERE name ILIKE '{clean_cp}' LIMIT 1)"
                supplier_subquery = f"(SELECT id FROM public.suppliers WHERE name ILIKE '{clean_cp}' LIMIT 1)"
            
            # Invoice references
            ref_active = row.get('Fatture Attive', '').strip() # e.g. "24-1"
            ref_passive = row.get('Fatture Passive', '').strip() # e.g. "Name 123"
            
            active_inv_subquery = "NULL"
            if ref_active:
                # User format in CSV: "24-1", "24-5"
                # Invoices table might have "24/1" or "1/2024".
                # Let's try to match directly first, maybe replace '-' with '/'
                
                # Check if it has a dash
                variants = [ref_active]
                if '-' in ref_active:
                    variants.append(ref_active.replace('-', '/'))
                
                # Construct OR clause
                conditions = []
                for v in variants:
                    safe_v = v.replace("'", "''")
                    conditions.append(f"invoice_number = '{safe_v}'")
                
                where_clause = " OR ".join(conditions)
                active_inv_subquery = f"(SELECT id FROM public.invoices WHERE {where_clause} LIMIT 1)"
            
            passive_inv_subquery = "NULL"
            # Passive invoice matching is harder. We'll skip complex logic for now and rely on manual fix if needed
            # or maybe matching just text if user had invoice_number in table.
            # Assuming we can't easily match passive invoices without more structured data.
            
            attachment = escape_sql_string(row.get('Allegati'))
            
            f.write(f"""
INSERT INTO public.bank_transactions (
    old_id, date, type, amount, description, 
    category_id, client_id, supplier_id, 
    active_invoice_id, passive_invoice_id,
    counterparty_name, external_ref_active_invoice, external_ref_passive_invoice,
    attachment_url
) VALUES (
    {old_id}, {date_val}, {type_val}, {amount_val}, {desc_val},
    {category_subquery}, {client_subquery}, {supplier_subquery},
    {active_inv_subquery}, {passive_inv_subquery},
    {safe_counterparty}, {escape_sql_string(ref_active)}, {escape_sql_string(ref_passive)},
    {attachment}
) ON CONFLICT (old_id) DO UPDATE SET
    amount = EXCLUDED.amount,
    description = EXCLUDED.description,
    counterparty_name = EXCLUDED.counterparty_name,
    external_ref_active_invoice = EXCLUDED.external_ref_active_invoice,
    external_ref_passive_invoice = EXCLUDED.external_ref_passive_invoice,
    attachment_url = EXCLUDED.attachment_url;
""")

    print(f"Generated {OUTPUT_SQL_FILE}")

if __name__ == '__main__':
    main()
