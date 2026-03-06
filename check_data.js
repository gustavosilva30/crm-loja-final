import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMessages() {
    console.log('Verificando mensagens e conversas no banco...');
    const { data, error } = await supabase
        .from('mensagens')
        .select('id, atendente_id, instancia_id, conversa_id, mensagem, created_at, conversas(id, atendente_id, instancia_id, cliente_nome, legacy)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Erro:', error);
        return;
    }
    console.log('Dados encontrados:', JSON.stringify(data, null, 2));
}

checkMessages();
