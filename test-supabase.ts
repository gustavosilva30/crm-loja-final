import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        const { data, error } = await supabase.from('produtos').select('*').limit(1);
        if (error) {
            console.error('Connection error:', error.message);
        } else {
            console.log('Connected successfully! Table "produtos" exists and is accessible.');
            console.log('Sample data:', data);
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

testConnection();
