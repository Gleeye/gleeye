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

def main():
    print(f"🔄 Connecting to Supabase database...")
    try:
        conn = psycopg2.connect(**config)
        print("   ✅ Connected successfully!")
        
        cur = conn.cursor()
        
        sql = """
        -- 1. Add booking_item_id to availability_overrides
        ALTER TABLE public.availability_overrides 
        ADD COLUMN IF NOT EXISTS booking_item_id UUID REFERENCES public.booking_items(id) ON DELETE CASCADE;

        -- 2. Clean up: sometimes these tables are slightly inconsistent, ensure RLS is correct
        ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;

        -- 3. Notify PostgREST
        NOTIFY pgrst, 'reload schema';
        """
        
        print("   🚀 Executing SQL...")
        cur.execute(sql)
        conn.commit()
        print("   ✅ Database updated successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    main()
