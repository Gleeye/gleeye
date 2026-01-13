import csv
import re
from datetime import datetime

def clean_currency(val):
    if not val: return '0'
    # Remove €, spaces and other chars, then replace comma with dot
    cleaned = re.sub(r'[^\d,.-]', '', val).replace(',', '.')
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

csv_file = 'tabelle_airtable/Fatture Attive.csv'
sql_file = 'import_invoices.sql'

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = []
    
    for row in reader:
        invoice_num = row.get('N.', '').strip()
        invoice_date = parse_date(row.get('Data Invio', ''))
        client_name = row.get('Clienti', '').strip()
        order_num = row.get('Ordini', '').strip()
        title = row.get('Titolo Commessa', '').strip()
        
        imponibile = clean_currency(row.get('Imponibile', ''))
        iva = clean_currency(row.get('IVA', ''))
        totale = clean_currency(row.get('Tot Documento', ''))
        
        status = row.get('Stato Fattura', '').strip()
        payment_date = parse_date(row.get('Data Saldo', ''))
        
        if not invoice_num: continue

        # Subqueries for lookups
        client_subquery = f"(SELECT id FROM public.clients WHERE business_name = {escape_sql(client_name)} LIMIT 1)"
        order_subquery = f"(SELECT id FROM public.orders WHERE order_number = {escape_sql(order_num)} LIMIT 1)"
        
        vals = [
            escape_sql(invoice_num),
            invoice_date,
            client_subquery,
            order_subquery,
            escape_sql(title),
            imponibile,
            iva,
            totale,
            escape_sql(status),
            payment_date
        ]
        rows.append(f"({', '.join(vals)})")

if rows:
    sql = "BEGIN;\n\n"
    sql += "INSERT INTO public.invoices (invoice_number, invoice_date, client_id, order_id, title, amount_tax_excluded, tax_amount, amount_tax_included, status, payment_date)\nVALUES\n"
    sql += ",\n".join(rows)
    sql += "\nON CONFLICT (invoice_number) DO UPDATE SET\n"
    sql += "invoice_date = EXCLUDED.invoice_date, client_id = EXCLUDED.client_id, order_id = EXCLUDED.order_id, title = EXCLUDED.title, amount_tax_excluded = EXCLUDED.amount_tax_excluded, tax_amount = EXCLUDED.tax_amount, amount_tax_included = EXCLUDED.amount_tax_included, status = EXCLUDED.status, payment_date = EXCLUDED.payment_date;\n\n"
    sql += "COMMIT;"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f"SQL file created: {sql_file} with {len(rows)} rows.")
else:
    print("No rows found.")
