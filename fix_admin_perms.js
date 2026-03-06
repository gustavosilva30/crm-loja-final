import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://yxiozmjnjivkuzrsnfvo.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aW96bWpuaml2a3V6cnNuZnZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjM2NzgsImV4cCI6MjA4NzkzOTY3OH0.qpPZzriJYwx69O6Kpy2Yr6ATBRcphomqfnAGg3wr150"

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log("Iniciando correção de permissões...")

    // 1. Corrigir Gustavo (pecasdourados@hotmail.com)
    const { data: d1, error: e1 } = await supabase
        .from('atendentes')
        .update({ perm_config: true })
        .ilike('email', 'pecasdourados@hotmail.com')

    if (e1) console.error("Erro ao atualizar Gustavo:", e1)
    else console.log("Permissão atualizada para Gustavo (pecasdourados@hotmail.com)")

    // 2. Corrigir Outro (pecasdourados_paccote@hotmail.com) just in case
    const { data: d2, error: e2 } = await supabase
        .from('atendentes')
        .update({ perm_config: true })
        .ilike('email', 'pecasdourados_paccote@hotmail.com')

    if (e2) console.error("Erro ao atualizar Paccote:", e2)
    else console.log("Permissão atualizada para Paccote (pecasdourados_paccote@hotmail.com)")

    // 3. Listar todos para conferir
    const { data: all } = await supabase.from('atendentes').select('nome, email, perm_config')
    console.log("Lista atualizada de atendentes:", JSON.stringify(all, null, 2))
}

run()
