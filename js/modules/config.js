// Supabase Configuration
// Switched to Local DB where migrations are applied
// Cloud Config (Active - Original Project)
const SUPABASE_URL = 'https://whpbetjyhpttinbxcffs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocGJldGp5aHB0dGluYnhjZmZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTQzMjcsImV4cCI6MjA4MjkzMDMyN30.cwGACRAp_aLaXKHrSVcZKHz0tX1zvvHb_xGHNHxJxu8';

// Local Config (Commented out)
// const SUPABASE_URL = 'http://127.0.0.1:54321';
// const SUPABASE_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

if (!window.supabase) {
    alert("ERRORE GRAVE: La libreria Supabase non è stata caricata.\nControlla di essere connesso a Internet.");
    throw new Error("Supabase library not loaded from CDN");
}
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabase = supabaseClient; // Maintaining alias for compatibility
window.sb = supabaseClient; // For debugging
