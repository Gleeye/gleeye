
import os
import psycopg2
from urllib.parse import urlparse

# Load env variables manually since we don't have dotenv
env_vars = {}
with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key] = value.strip('"').strip("'")

DB_HOST = env_vars.get('DB_HOST')
DB_NAME = env_vars.get('DB_NAME')
DB_USER = env_vars.get('DB_USER')
DB_PASSWORD = env_vars.get('DB_PASSWORD')
DB_PORT = env_vars.get('DB_PORT', '5432')

print(f"Connecting to {DB_HOST} as {DB_USER}...")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        port=DB_PORT
    )
    conn.autocommit = True
    cur = conn.cursor()

    # Check for bookings table
    cur.execute("SELECT to_regclass('public.bookings');")
    res = cur.fetchone()[0]
    
    if res:
        print("Table 'bookings' EXISTS.")
        
        # Check rows
        cur.execute("SELECT count(*) FROM bookings;")
        count = cur.fetchone()[0]
        print(f"Row count: {count}")
        
    else:
        print("Table 'bookings' DOES NOT EXIST.")
        
    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
