import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkInstances() {
    console.log('Verificando instâncias no banco de dados...');
    const { data, error } = await supabase.from('whatsapp_instancias').select('*');
    if (error) {
        console.error('Erro ao buscar instâncias:', error);
        return;
    }
    console.log('Instâncias encontradas:', JSON.stringify(data, null, 2));
}

checkInstances();
