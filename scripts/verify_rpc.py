
import requests
import json

SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk'
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_rpc():
    print("Checking for exec_sql RPC...")
    payload = {"sql": "SELECT 1"}
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/exec_sql", headers=HEADERS, json=payload)
    if r.status_code == 200:
        print("✅ exec_sql exists!")
    else:
        print(f"❌ exec_sql failed: {r.status_code} {r.text}")
        
    print("Checking for execute_sql RPC...")
    r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/execute_sql", headers=HEADERS, json=payload)
    if r.status_code == 200:
        print("✅ execute_sql exists!")
    else:
        print(f"❌ execute_sql failed: {r.status_code} {r.text}")

check_rpc()
