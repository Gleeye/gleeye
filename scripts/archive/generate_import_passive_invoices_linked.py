import csv

csv_file_path = 'tabelle_airtable/Fatture Passive.csv'
sql_output_path = 'import_passive_invoices_linked.sql'

def clean_money(value):
    if not value:
        return '0'
    return value.replace('€', '').replace('.', '').replace(',', '.').strip()

def escape_sql(value):
    if not value:
        return 'NULL'
    return "'" + value.replace("'", "''") + "'"

def parse_date(value):
    # value is D/M/YYYY or DD/MM/YYYY
    if not value:
        return 'NULL'
    parts = value.split('/')
    if len(parts) == 3:
        return f"'{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}'"
    return 'NULL'

print(f"Reading from {csv_file_path}...")

with open(csv_file_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    sql_statements = []
    
    # We might want to truncate passive_invoices too? 
    # User said "importiamo", implying complete import. 
    # But be careful if there are manual ones.
    # Let's add truncate command commented out or just append.
    # sql_statements.append("TRUNCATE TABLE public.passive_invoices CASCADE;") 
    
    for row in reader:
        # Columns based on file content viewed earlier:
        # Name: description/ref? e.g. 'Francesco Porcile 150/001'
        # Tipo: 'Fornitori' / 'Collaboratori'
        # Fornitori: Supplier Name (if Tipo=Fornitori)
        # Collaboratore: Collaborator Name (if Tipo=Collaboratori)
        # N.: Invoice Number
        # Data Fattura
        # Servizio Fornitore / Servizio?
        # Importo: tax excluded?
        # Pagato: date? No, 'Pagato' string?
        # Stato: 'Pagato'
        # Data saldo: Payment Date
        # Allegato: URL inside text?
        # Ritenuta, Rivalsa Inps, IVA: verify if these are amounts
        
        # Let's map to schema:
        # invoice_number -> "N."
        # issue_date -> "Data Fattura"
        # due_date -> ? maybe same as issue or payment
        # payment_date -> "Data saldo"
        # status -> "Stato"
        # amount_tax_excluded -> "Importo" - wait, let's check values in CSV
        #   CSV: "€1677,75" (Importo)
        #   CSV: "€0.00" (IVA)
        #   Let's check if Importo is total or netto.
        #   Row 2: Importo €1677,75. IVA: 0. 
        #   Row 7: Importo €402,00. IVA 0. Rivalsa INPS €16.08. 
        #   Let's just import "Importo" as amount_tax_excluded for now (or tax_included if it seems so).
        #   Actually "Importo" usually implies total in user speak unless specified "Imponibile".
        #   But row 5: Importo €1,00. IVA €0.22. -> Total €1.22? 
        #   Checking Row 5 in CSV view:
        #     Importo: "€1,00"
        #     Pagato: "€1,22" (Column "Pagamenti"?? No, expected output view has "Pagato" column with date? No, let's recheck header)
        #     Header: Name,Tipo,Codice Collab,Fornitori,Tipo Collaborazione,N.,Data Fattura,Collaboratore,Servizio Fornitore,Iva Attiva,Importo,Pagato,Stato,Data saldo,Allegato,...
        #     Row 5: Importo="€1,00", Pagato="€1,22". Stato="Pagato". 
        #     So "Pagato" column seems to be Amount Paid (Total)? Or is "Pagato" Boolean?
        #     Row 2: Importo="€1677,75", Pagato="€1500,00". Recoups?
        #     Let's map:
        #       amount_tax_excluded = Importo
        #       amount_tax_included = Pagato (or calculate)
        #       But "Pagato" might be effectively "Total Amount" column in Airtable.
        
        tipo = row.get('Tipo', '')
        supplier_name = row.get('Fornitori', '').strip()
        collab_name = row.get('Collaboratore', '').strip()
        inv_num = row.get('N.', '')
        issue_date = parse_date(row.get('Data Fattura', ''))
        status = row.get('Stato', '')
        payment_date = parse_date(row.get('Data saldo', ''))
        
        amount_net = clean_money(row.get('Importo', ''))
        amount_gross = clean_money(row.get('Pagato', '')) # Seems to be the total
        vat_amount = clean_money(row.get('IVA', ''))
        
        notes = row.get('Servizio Fornitore', '') # or row.get('Name')
        
        # Attachment extraction: "Filename (url)"
        attachment_raw = row.get('Allegato', '')
        attachment_url = 'NULL'
        if 'http' in attachment_raw:
            # Extract URL between parentheses
            try:
                start = attachment_raw.find('(') + 1
                end = attachment_raw.find(')', start)
                if start > 0 and end > start:
                    url = attachment_raw[start:end]
                    attachment_url = escape_sql(url)
            except:
                pass

        # Foreign Keys
        supplier_subquery = "NULL"
        collab_subquery = "NULL"
        
        if tipo == 'Fornitori' and supplier_name:
            supplier_subquery = f"(SELECT id FROM public.suppliers WHERE name = {escape_sql(supplier_name)} LIMIT 1)"
        elif tipo == 'Collaboratori' and collab_name:
            # Try to match 'Name' or 'First Last'
            # Collaborators table usually has first_name, last_name, and maybe a full name field?
            # Creating subquery to match concatenation or a full name field if exists.
            # Let's assume there is a way to match. Schema check pending (I'll check next step).
            # Usually: SELECT id FROM collaborators WHERE (first_name || ' ' || last_name) ILIKE ...
            collab_subquery = f"(SELECT id FROM public.collaborators WHERE (first_name || ' ' || last_name) ILIKE {escape_sql(collab_name)} OR last_name ILIKE {escape_sql(collab_name)} LIMIT 1)"

        sql = f"""INSERT INTO public.passive_invoices (
            invoice_number, issue_date, payment_date, status, 
            amount_tax_excluded, amount_tax_included, tax_amount,
            supplier_id, collaborator_id, notes, attachment_url
        ) VALUES (
            {escape_sql(inv_num)}, {issue_date}, {payment_date}, {escape_sql(status)},
            {amount_net}, {amount_gross}, {vat_amount},
            {supplier_subquery}, {collab_subquery}, {escape_sql(notes)}, {attachment_url}
        );"""
        
        sql_statements.append(sql)

with open(sql_output_path, 'w', encoding='utf-8') as f:
    f.write('\\n'.join(sql_statements))

print(f"Generated {len(sql_statements)} SQL statements to {sql_output_path}")
