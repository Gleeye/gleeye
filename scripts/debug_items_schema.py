import requests
import json
import os
import sys

# Configuration
SUPABASE_URL = "https://whpbetjyhpttinbxcffs.supabase.co"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8"

headers = {
    "apikey": API_KEY,
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def fetch_data(table, params={}):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching {table}: {e}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"Response: {response.text}")
        return []

def main():
    print("--- DIAGNOSTIC: BOOKING ITEMS SCHEMA ---")
    
    # Fetch one item to see keys
    items = fetch_data("booking_items", {"limit": "1"})
    if items:
        print(f"Keys found: {list(items[0].keys())}")
    else:
        print("No items found.")

if __name__ == "__main__":
    main()
