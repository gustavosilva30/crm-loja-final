import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxiozmjnjivkuzrsnfvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Fetching schema of mensagens...");
    const { data: msgs1, error: err1 } = await supabase.from('mensagens').select('*').order('timestamp').limit(1);
    console.log("Order by timestamp:", err1);

    const { data: msgs2, error: err2 } = await supabase.from('mensagens').select('*').order('created_at').limit(1);
    console.log("Order by created_at:", err2);
}

test();
