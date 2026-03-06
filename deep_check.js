import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: mensagens } = await supabase.from('mensagens').select('id, atendente_id, instancia_id, conversa_id, mensagem').order('timestamp', { ascending: false }).limit(3);
    console.log('--- MENSAGENS ---');
    console.log(JSON.stringify(mensagens, null, 2));

    if (mensagens && mensagens.length > 0) {
        const cid = mensagens[0].conversa_id;
        const { data: conv } = await supabase.from('conversas').select('*').eq('id', cid).single();
        console.log('--- CONVERSA DA MSG ---');
        console.log(JSON.stringify(conv, null, 2));
    }
}
check();
