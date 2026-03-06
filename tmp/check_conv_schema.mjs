import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yxiozmjnjivkuzrsnfvo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConversas() {
    const { data, error } = await supabase.from('conversas').select('*').limit(1)
    if (error) console.error(error)
    else console.log("COLUNAS_CONVERSAS:", Object.keys(data[0] || {}))
}

checkConversas()
