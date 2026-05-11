
import psycopg2
import os

import sys

# Standard Supabase local development credentials
DB_CONFIGS = [
    # Default Supabase CLI local config
    {"host": "localhost", "port": 54322, "database": "postgres", "user": "postgres", "password": "your-super-secret-and-long-postgres-password"}, 
    {"host": "localhost", "port": 54322, "database": "postgres", "user": "postgres", "password": "postgres"},
    # Standard Postgres
    {"host": "localhost", "port": 5432, "database": "postgres", "user": "postgres", "password": "postgres"},
    {"host": "127.0.0.1", "port": 54322, "database": "postgres", "user": "postgres", "password": "postgres"}
]

if len(sys.argv) > 1:
    SQL_FILE = sys.argv[1]
else:
    SQL_FILE = "/Users/davidegentile/Documents/app dev/gleeye erp/create_collaborator_services_schema.sql"

def main():
    print("🔄 Attempting to connect to local database...")
    
    connected = False
    conn = None
    
    for config in DB_CONFIGS:
        try:
            print(f"   Trying {config['host']}:{config['port']}...")
            conn = psycopg2.connect(**config)
            print("   ✅ Connected successfully!")
            connected = True
            break
        except Exception as e:
            print(f"   ❌ Failed: {e}")
    
    if not connected:
        print("⚠️ Could not connect to any local database with default credentials.")
        return

    try:
        with open(SQL_FILE, 'r') as f:
            sql = f.read()
            
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print("✅ Schema executed successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error executing SQL: {e}")

if __name__ == "__main__":
    main()
