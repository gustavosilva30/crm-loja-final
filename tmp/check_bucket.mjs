import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yxiozmjnjivkuzrsnfvo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBucket() {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) {
        console.error("ERRO_STORAGE:", error.message)
    } else {
        console.log("BUCKETS:", data.map(b => b.name).join(', '))
        const exists = data.find(b => b.name === 'whatsapp_media')
        console.log("WHATSAPP_MEDIA_EXISTS:", !!exists)
    }
}

checkBucket()
