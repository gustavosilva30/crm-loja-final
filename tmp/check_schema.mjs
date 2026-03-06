import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
    const { data, error } = await supabase.from('mensagens').select('*').limit(1)
    if (error) {
        console.error("Erro ao ler tabela mensagens:", error)
    } else {
        console.log("Colunas disponíveis:", Object.keys(data[0] || {}))
    }
}

checkSchema()
