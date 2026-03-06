import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yxiozmjnjivkuzrsnfvo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMessages() {
    const { data, error } = await supabase.from('mensagens').select('conteudo, atendente_nome').order('timestamp', { ascending: false }).limit(5)
    if (error) console.error(error)
    else console.log("ULTIMAS_MSGS:", JSON.stringify(data, null, 2))
}

checkMessages()
