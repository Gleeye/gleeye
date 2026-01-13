import psycopg2
import json
import sys

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

def run_query(sql):
    try:
        conn = psycopg2.connect(**config)
        cur = conn.cursor()
        cur.execute(sql)
        if cur.description:
            columns = [desc[0] for desc in cur.description]
            results = cur.fetchall()
            return [{k: str(v) if v is not None and not isinstance(v, (int, float, str, bool)) else v for k, v in zip(columns, row)} for row in results]
        else:
            conn.commit()
            return [{"status": "success"}]
    except Exception as e:
        return [{"error": str(e)}]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = sys.argv[1]
    else:
        query = "SELECT name, min_notice_minutes, max_advance_days FROM booking_items;"
    
    res = run_query(query)
    print(json.dumps(res, indent=2))
