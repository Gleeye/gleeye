import requests
import json

SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM1NDMyNywiZXhwIjoyMDgyOTMwMzI3fQ.LNVl6fD6jM6CWfy5_Tm4DelIwghG-5wUhDyqrklMwZk"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

print("Checking payments table columns...")
# Try to insert a dummy record to see detailed error or fetch 0 rows
r = requests.get(f"{SUPABASE_URL}/rest/v1/payments?limit=1", headers=HEADERS)
print(f"GET Status: {r.status_code}")
try:
    print(f"GET Body: {r.json()}")
except:
    print(r.text)

# Check OpenAPI schema directly?
r = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=HEADERS)
print(f"Root/Schema Status: {r.status_code}")
# The root usually returns definitions.
try:
    defs = r.json().get('definitions', {})
    if 'payments' in defs:
        print("Payments structure from API:")
        print(json.dumps(defs['payments'], indent=2))
    else:
        print("Payments definition not found in root schema.")
except:
    pass
