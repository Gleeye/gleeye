
import requests
import json

url = "https://whpbetjyhpttinbxcffs.supabase.co/rest/v1/orders?select=id,order_number,payment_mode"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8"
}

try:
    response = requests.get(url, headers=headers)
    orders = response.json()
    
    target_id = "18d1ba7e-fe9f-4d55-967c-fdc0060ca3a5"
    found = False
    for order in orders:
        if order['id'] == target_id:
            print(f"FOUND ORDER: {order}")
            found = True
            break
    
    if not found:
        print("Order NOT found in full list.")
        
except Exception as e:
    print(f"Error: {e}")
