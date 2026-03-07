import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || 'https://whpbetjyhpttinbxcffs.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || '...'; // I will get it from .env

async function query() {
    console.log("querying...");
}
query();
