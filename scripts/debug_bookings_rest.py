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
    print("--- DIAGNOSTIC: COMPLEX QUERY CHECK (FIXED) ---")
    
    # Target Collaborator ID (Davide Gentile)
    COLLAB_ID = "61810c9c-ab9e-4c2e-9c16-2ab2f9823301"
    
    # Replicate the query from personal_agenda.js (WITHOUT COLOR)
    # .select(`
    #     *,
    #     booking_items ( name, duration_minutes ),
    #     booking_assignments!inner ( collaborator_id )
    # `)
    # .eq('booking_assignments.collaborator_id', collaboratorId)
    
    print(f"\nExecuting query for Collab ID: {COLLAB_ID}")
    
    params = {
        "select": "*,booking_items(name,duration_minutes),booking_assignments!inner(collaborator_id)",
        "booking_assignments.collaborator_id": f"eq.{COLLAB_ID}",
        "order": "start_time.asc"
    }
    
    bookings = fetch_data("bookings", params)
    print(f"Query returned {len(bookings)} bookings.")
    
    for b in bookings:
        print(f" - {b['start_time']} (ID: {b['id']})")
        item = b.get('booking_items')
        print(f"   Item: {item}")

if __name__ == "__main__":
    main()
