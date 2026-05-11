import psycopg2
import os

# Database configuration
password = "#1rkB&njQ$Gn5C31BWwf"
config = {
    "host": "db.whpbetjyhpttinbxcffs.supabase.co",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": password
}

SQL_FILE = "/Users/davidegentile/Documents/app dev/gleeye erp/update_orders_schema_v3.sql"

def main():
    print(f"🔄 Connecting to Supabase database...")
    try:
        conn = psycopg2.connect(**config)
        print("   ✅ Connected successfully!")
        
        with open(SQL_FILE, 'r') as f:
            sql = f.read()
            
        cur = conn.cursor()
        print("   🚀 Executing schema update...")
        cur.execute(sql)
        conn.commit()
        print("   ✅ SQL executed successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    main()
