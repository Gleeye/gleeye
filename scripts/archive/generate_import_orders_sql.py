import csv
import re

def clean_currency(val):
    if not val: return '0'
    val = str(val).replace('€', '').replace(' ', '').replace('\xa0', '').strip()
    if not val: return '0'
    
    if ',' in val and '.' in val:
        if val.rfind(',') > val.rfind('.'): # 1.234,56
            val = val.replace('.', '').replace(',', '.')
        else: # 1,234.56
            val = val.replace(',', '')
    elif ',' in val:
        parts = val.split(',')
        if len(parts[-1]) == 2 or len(parts[-1]) == 1:
            val = val.replace(',', '.')
        else:
            val = val.replace(',', '')
    elif '.' in val:
        parts = val.split('.')
        if len(parts[-1]) == 3 and len(parts) > 1:
            val = val.replace('.', '')
            
    val = re.sub(r'[^0-9.]', '', val)
    return val if val else '0'

def clean_date(val):
    if not val: return 'NULL'
    parts = val.split('/')
    if len(parts) == 3:
        d, m, y = parts
        return f"'{y}-{m.zfill(2)}-{d.zfill(2)}'"
    return 'NULL'

def escape_sql(val):
    if val is None or str(val).strip() == '':
        return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

csv_file = 'tabelle_airtable/Ordini.csv'
sql_file = 'import_orders.sql'

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = []
    for row in reader:
        order_number = row.get('Id_Ordine', '').strip()
        if not order_number: continue

        client_code = row.get('Clienti', '').strip()
        order_date = clean_date(row.get('Data Ordine', ''))
        title = row.get('Titolo Commessa', '').strip()
        if not title:
            title = f'Commessa {order_number}'
            
        # Prices
        price_planned = clean_currency(row.get('Prezzi Totali Previsti', ''))
        price_actual = clean_currency(row.get('Prezzi Finali', ''))
        cost_planned = clean_currency(row.get('Costi Totali Previsti', ''))
        cost_actual = clean_currency(row.get('Costi Finali', ''))
        revenue_planned = clean_currency(row.get('Ricavi Previsti', ''))
        revenue_actual = clean_currency(row.get('Ricavi Finali', ''))
        
        # total_price fallback logic
        total_p = 0.0
        try:
            p_act_val = float(price_actual)
            p_pla_val = float(price_planned)
            p_tot_str = clean_currency(row.get('Totale Commessa', ''))
            p_tot_val = float(p_tot_str)
            
            if p_act_val > 0:
                total_p = p_act_val
            elif p_tot_val > 0:
                total_p = p_tot_val
            else:
                total_p = p_pla_val
        except:
            pass

        status = row.get('Stato Lavori', '').strip()
        offer_status = row.get('Stato Offerte ', '').strip()
        
        client_subquery = f"(SELECT id FROM public.clients WHERE client_code = {escape_sql(client_code)} LIMIT 1)"

        # Payment fields
        payment_method = row.get('Modalita Pagamento', '').strip()
        
        # Map payment_method to payment_mode
        mode_map = {
            'Pagamento completo': 'saldo',
            'Saldo alla fattura': 'saldo',
            'Pagamento a rate': 'rate',
            'Anticipo e saldo': 'anticipo_saldo',
            'Anticipo + Rate': 'anticipo_rate',
            'A&S + Rate': 'as_rate'
        }
        payment_mode = mode_map.get(payment_method, 'saldo') if payment_method else 'saldo'
        
        # Clean percentages (remove %, replace , with .)
        def clean_pct(val):
            if not val: return '0'
            val = val.replace('%', '').replace(',', '.').strip()
            return val if val else '0'

        deposit_pct = clean_pct(row.get('Anticipo', ''))
        balance_pct = clean_pct(row.get('Saldo', '')) # Note: CSV col might be "Saldo" (pct) or "Valore Saldo"
        # Checking CSV header line 1: "Saldo" exists, "Valore Saldo" exists. "Saldo" seems to be the percentage column? 
        # Line 5: Anticipo "22%", Saldo (empty? or calculated?). line 5 col "Saldo" is ",Saldato" (Status?).
        # Wait, let's re-read CSV header.
        # "Anticipo", "Valore Anticipo", "Stato Anticipo", "Saldo", "Valore Saldo", "Stato Saldo"
        # Sample Line 5 (Aqua): "Anticipo"= "21%" (col 61?), "Valore..."
        # Actually let's look at the content.
        # Header: ...,Anticipo,Valore Anticipo,Stato Anticipo,Saldo,Valore Saldo,Stato Saldo,...
        # Line 7 (24-0015): Anticipo="53%", Saldo="47%"
        # So "Saldo" is the percentage.
        
        installments_count = row.get('N. Rate', '').strip() or '0'
        installment_type = row.get('Tipo rateizzazione', '').strip()

        
        # Account & Contact logic
        account_name = row.get('Account', '').strip()
        referente_raw = row.get('Referente', '').strip()
        
        account_subquery = "NULL"
        if account_name:
            account_subquery = f"(SELECT id FROM public.collaborators WHERE full_name ILIKE {escape_sql(account_name)} LIMIT 1)"

        contact_subquery = "NULL"
        if referente_raw:
            # Take first name if comma separated
            first_ref = referente_raw.split(',')[0].strip()
            if first_ref:
                contact_subquery = f"(SELECT id FROM public.contacts WHERE full_name ILIKE {escape_sql(first_ref)} LIMIT 1)"
        
        vals = [
            client_subquery,
            escape_sql(order_number),
            escape_sql(title),
            order_date,
            str(total_p),
            escape_sql(status),
            escape_sql(order_number),
            escape_sql(offer_status),
            price_planned,
            price_actual,
            cost_planned,
            cost_actual,
            revenue_planned,
            revenue_actual,
            escape_sql(payment_method),
            escape_sql(payment_mode),
            str(deposit_pct),
            str(balance_pct),
            str(installments_count),
            escape_sql(installment_type),
            account_subquery,
            contact_subquery
        ]
        rows.append(f"({', '.join(vals)})")

if rows:
    sql = "INSERT INTO public.orders (client_id, order_number, title, order_date, total_price, status_works, airtable_id, offer_status, price_planned, price_actual, cost_planned, cost_actual, revenue_planned, revenue_actual, payment_method, payment_mode, deposit_percentage, balance_percentage, installments_count, installment_type, account_id, contact_id)\nVALUES\n"
    sql += ",\n".join(rows)
    sql += "\nON CONFLICT (airtable_id) DO UPDATE SET\n"
    sql += "client_id = EXCLUDED.client_id, order_number = EXCLUDED.order_number, title = EXCLUDED.title, order_date = EXCLUDED.order_date, total_price = EXCLUDED.total_price, status_works = EXCLUDED.status_works, offer_status = EXCLUDED.offer_status, price_planned = EXCLUDED.price_planned, price_actual = EXCLUDED.price_actual, cost_planned = EXCLUDED.cost_planned, cost_actual = EXCLUDED.cost_actual, revenue_planned = EXCLUDED.revenue_planned, revenue_actual = EXCLUDED.revenue_actual, payment_method = EXCLUDED.payment_method, payment_mode = EXCLUDED.payment_mode, deposit_percentage = EXCLUDED.deposit_percentage, balance_percentage = EXCLUDED.balance_percentage, installments_count = EXCLUDED.installments_count, installment_type = EXCLUDED.installment_type, account_id = EXCLUDED.account_id, contact_id = EXCLUDED.contact_id;"
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write(sql)
    print(f"SQL file created: {sql_file} with {len(rows)} rows.")
else:
    print("No rows found.")
