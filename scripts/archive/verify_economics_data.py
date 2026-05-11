import psycopg2
import os

# Database configuration
password = "#1rkB&njQ$Gn5C31BWwf"
project_ref = "whpbetjyhpttinbxcffs"
config = {
    "host": "aws-1-eu-west-3.pooler.supabase.com",
    "port": 5432,
    "database": "postgres",
    "user": f"postgres.{project_ref}",
    "password": password,
    "sslmode": "require"
}

def main():
    try:
        conn = psycopg2.connect(**config)
        cur = conn.cursor()
        
        # Check columns
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'orders'
            AND column_name IN ('price_actual', 'cost_actual', 'price_final', 'cost_final', 'price_planned', 'cost_planned');
        """)
        columns = cur.fetchall()
        print("Columns in 'orders':")
        for col in columns:
            print(f" - {col[0]} ({col[1]})")
            
        print("\nSample Data (Top 5):")
        cur.execute("""
            SELECT order_number, title, price_actual, cost_actual, price_final, cost_final 
            FROM public.orders 
            LIMIT 5;
        """)
        rows = cur.fetchall()
        for row in rows:
            print(f"Num: {row[0]}, Title: {row[1]}")
            print(f"  Actual - Price: {row[2]}, Cost: {row[3]}")
            print(f"  Final  - Price: {row[4]}, Cost: {row[5]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
