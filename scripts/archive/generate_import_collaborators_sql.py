import csv
import re

def escape_sql(val):
    if val is None or str(val).strip() == '': return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

def clean_date(val):
    if not val or val.strip() == '': return 'NULL'
    try:
        parts = val.split('/')
        if len(parts) == 3:
            d, m, y = parts
            return f"'{y}-{m.zfill(2)}-{d.zfill(2)}'"
    except: pass
    return 'NULL'

csv_collab = 'tabelle_airtable/Collaboratori.csv'
csv_orders = 'tabelle_airtable/Ordini.csv'
sql_file = 'import_collaborators.sql'

# Map of relationships (order_num -> set of shorthands)
relationships = {}

def add_rel(order_num, shorthand):
    if not order_num or not shorthand: return
    if order_num not in relationships:
        relationships[order_num] = set()
    relationships[order_num].add(shorthand)

collabs_data = []
known_shorthands = set()
known_full_names = {} # full_name -> shorthand

# 1. Parse Collaboratori.csv (The Team Roster)
with open(csv_collab, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        shorthand = row.get('Name', '').strip()
        full_name = row.get('Collaboratore', '').strip()
        if not shorthand: continue
        
        known_shorthands.add(shorthand)
        if full_name:
            known_full_names[full_name] = shorthand
            
        collabs_data.append({
            'shorthand': shorthand,
            'first_name': row.get('Nome', '').strip(),
            'last_name': row.get('Cognome', '').strip(),
            'full_name': full_name,
            'role': row.get('Ruolo', '').strip(),
            'tags': row.get('Tags', '').strip(),
            'email': row.get('Email', '').strip(),
            'phone': row.get('Telefono', '').strip(),
            'vat': row.get('PartitaIva', '').strip(),
            'cf': row.get('CodiceFiscale', '').strip(),
            'address': row.get('Indirizzo', '').strip(),
            'birth_date': clean_date(row.get('Data-di-Nascita', '')),
            'birth_place': row.get('Luogo-di-nascita', '').strip(),
        })
        
        # Extract reverse links (Collaboratori -> Ordini)
        o_str = row.get('Ordini', '').strip()
        if o_str:
            for o_num in [x.strip() for x in o_str.split(',') if x.strip()]:
                add_rel(o_num, shorthand)

# 2. Parse Ordini.csv (The Order Assignments)
with open(csv_orders, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        order_num = row.get('Id_Ordine', '').strip()
        if not order_num: continue
        
        # A. From 'Collaboratori' column (shorthands, potentially dirty)
        c1 = row.get('Collaboratori', '')
        if c1:
            # Match known shorthands using regex to handle "GABRI:1500" or lists
            for s in known_shorthands:
                if re.search(r'\b' + re.escape(s) + r'\b', c1):
                    add_rel(order_num, s)
            
            # Additional check for frequent staff missing from the master list
            for missing in ['BEATRICE', 'ELISA', 'RICARDO']:
                if re.search(r'\b' + re.escape(missing) + r'\b', c1):
                    add_rel(order_num, missing)

        # B. From 'Collaboratori elenco' (Full Names)
        celenco = row.get('Collaboratori elenco', '')
        if celenco:
            for fname, s in known_full_names.items():
                if fname in celenco:
                    add_rel(order_num, s)
            
            # Full name fallback for missing staff
            if 'Beatrice Frugone' in celenco: add_rel(order_num, 'BEATRICE')
            if 'Elisa Bertolone' in celenco: add_rel(order_num, 'ELISA')
            if 'Ricardo Vela' in celenco: add_rel(order_num, 'RICARDO')

# 3. Handle Placeholder Creation for missing staff mentioned in orders
missing_defs = {
    'BEATRICE': ('Beatrice', 'Frugone', 'Beatrice Frugone'),
    'ELISA': ('Elisa', 'Bertolone', 'Elisa Bertolone'),
    'RICARDO': ('Ricardo', 'Vela', 'Ricardo Vela')
}
for m, info in missing_defs.items():
    is_referenced = any(m in rels for rels in relationships.values())
    if is_referenced and m not in known_shorthands:
        fname, lname, fullname = info
        collabs_data.append({
            'shorthand': m,
            'first_name': fname, 'last_name': lname, 'full_name': fullname,
            'role': 'Collaboratore Esterno', 'tags': '', 'email': '', 'phone': '', 'vat': '', 'cf': '', 'address': '', 'birth_date': 'NULL', 'birth_place': ''
        })

# 4. Final SQL Generation
sql = ["BEGIN;"]

# 4a. Collaborators Table
sql.append("\n-- Sync Collaborators Roster")
sql.append("INSERT INTO public.collaborators (name, first_name, last_name, full_name, role, tags, email, phone, vat_number, fiscal_code, address, birth_date, birth_place, airtable_id)")
sql.append("VALUES")
vals_list = []
for c in collabs_data:
    vals = [
        escape_sql(c['shorthand']), escape_sql(c['first_name']), escape_sql(c['last_name']),
        escape_sql(c['full_name']), escape_sql(c['role']), escape_sql(c['tags']),
        escape_sql(c['email']), escape_sql(c['phone']), escape_sql(c['vat']),
        escape_sql(c['cf']), escape_sql(c['address']), c['birth_date'],
        escape_sql(c['birth_place']), escape_sql(c['shorthand'])
    ]
    vals_list.append(f"({', '.join(vals)})")
sql.append(",\n".join(vals_list))
sql.append("ON CONFLICT (airtable_id) DO UPDATE SET")
sql.append("name = EXCLUDED.name, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, full_name = EXCLUDED.full_name, role = EXCLUDED.role, email = EXCLUDED.email, phone = EXCLUDED.phone;\n")

# 4b. Order Links
sql.append("-- Link Assignments")
for order_num, collab_set in relationships.items():
    order_sub = f"(SELECT id FROM public.orders WHERE order_number = {escape_sql(order_num)} LIMIT 1)"
    for s in collab_set:
        collab_sub = f"(SELECT id FROM public.collaborators WHERE airtable_id = {escape_sql(s)} LIMIT 1)"
        stmt = f"INSERT INTO public.order_collaborators (order_id, collaborator_id)\n"
        stmt += f"SELECT {order_sub}, {collab_sub}\n"
        stmt += f"WHERE EXISTS {order_sub} AND EXISTS {collab_sub}\n"
        stmt += f"ON CONFLICT DO NOTHING;"
        sql.append(stmt)

sql.append("\nCOMMIT;")

with open(sql_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql))

print(f"SQL generated: {sql_file} ({len(collabs_data)} collabs, {sum(len(s) for s in relationships.values())} links)")
