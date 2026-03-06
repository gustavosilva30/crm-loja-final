import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yxiozmjnjivkuzrsnfvo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpload() {
    console.log("Testing upload to WHATSAPP_MEDIA...");
    const { data, error } = await supabase.storage
        .from('WHATSAPP_MEDIA')
        .upload('test.txt', 'Hello world', {
            contentType: 'text/plain',
            upsert: false
        });

    console.log("WHATSAPP_MEDIA uppercase result: ", error ? error.message : "Success: " + data.path);

    console.log("Testing upload to whatsapp_media...");
    const { data: data2, error: error2 } = await supabase.storage
        .from('whatsapp_media')
        .upload('test2.txt', 'Hello world', {
            contentType: 'text/plain',
            upsert: false
        });

    console.log("whatsapp_media lowercase result: ", error2 ? error2.message : "Success: " + data2?.path);
}

testUpload()
