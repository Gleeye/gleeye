import psycopg2
import os

# Database configuration
password = "#1rkB&njQ$Gn5C31BWwf"
project_ref = "whpbetjyhpttinbxcffs"

# Try pooler host for IPv4 support
config = {
    "host": "aws-1-eu-west-3.pooler.supabase.com",
    "port": 5432, # or 6543
    "database": "postgres",
    "user": f"postgres.{project_ref}",
    "password": password,
    "sslmode": "require"
}

import sys

if len(sys.argv) < 2:
    print("Usage: python3 execute_pooler_schema.py <sql_file>")
    sys.exit(1)

SQL_FILE = sys.argv[1]

def main():
    print(f"🔄 Connecting to Supabase pooler (aws-0-eu-central-1.pooler.supabase.com)...")
    try:
        conn = psycopg2.connect(**config)
        print("   ✅ Connected successfully via pooler!")
        
        with open(SQL_FILE, 'r') as f:
            sql = f.read()
            
        cur = conn.cursor()
        print("   🚀 Executing schema...")
        cur.execute(sql)
        conn.commit()
        print("   ✅ Schema created/updated successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"   ❌ Error: {e}")
        print("   Trying port 6543...")
        try:
            config["port"] = 6543
            conn = psycopg2.connect(**config)
            print("   ✅ Connected successfully via pooler (port 6543)!")
            cur = conn.cursor()
            cur.execute(sql)
            conn.commit()
            print("   ✅ Schema created/updated successfully!")
            cur.close()
            conn.close()
        except Exception as e2:
            print(f"   ❌ Error on 6543: {e2}")

if __name__ == "__main__":
    main()
