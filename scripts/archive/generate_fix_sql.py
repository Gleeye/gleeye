
import csv

csv_file = 'tabelle_airtable/Ordini.csv'
sql_file = 'fix_payment_modes.sql'

print("Generating SQL fix...")

order_numbers = []

with open(csv_file, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        order_number = row.get('Id_Ordine', '').strip()
        payment_method = row.get('Modalita Pagamento', '').strip()

        if not payment_method and order_number:
            order_numbers.append(f"'{order_number}'")

if order_numbers:
    sql_content = f"""
    -- Fix orders that were incorrectly defaulted to 'saldo'
    UPDATE public.orders 
    SET payment_mode = NULL,
        deposit_percentage = 0,
        balance_percentage = 0,
        installments_count = 0
    WHERE order_number IN ({", ".join(order_numbers)});
    """
    
    with open(sql_file, "w") as f:
        f.write(sql_content)
    
    print(f"Generated {sql_file} with {len(order_numbers)} orders to fix.")
else:
    print("No orders to fix found.")
