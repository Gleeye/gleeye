import csv
import os

def generate_sql():
    csv_path = 'tabelle_airtable/Fatture Attive.csv'
    output_path = 'fix_vat_eligibility_data.sql'
    
    # Check if CSV exists
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found")
        return

    sql_statements = []
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            invoice_number = row.get('N.', '').strip()
            vat_eligibility = row.get('Esigibilità Iva', '').strip()
            
            # Map CSV values to normalized values if needed, otherwise use as is
            # CSV values are "Scissione dei pagamenti" and "Iva ad esigibilità immediata"
            
            if invoice_number and vat_eligibility:
                # Escape single quotes in values
                safe_eligibility = vat_eligibility.replace("'", "''")
                safe_number = invoice_number.replace("'", "''")
                
                sql = f"UPDATE public.invoices SET vat_eligibility = '{safe_eligibility}' WHERE invoice_number = '{safe_number}';"
                sql_statements.append(sql)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("-- Fix missing vat_eligibility data from CSV\n")
        f.write("\n".join(sql_statements))
    
    print(f"Generated {len(sql_statements)} update statements in {output_path}")

if __name__ == "__main__":
    generate_sql()
