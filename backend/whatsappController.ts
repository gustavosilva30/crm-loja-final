import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY is required');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EVO_API_URL = process.env.EVO_API_URL || process.env.VITE_EVO_API_URL;
const EVO_API_KEY = process.env.EVO_API_KEY || process.env.VITE_EVO_API_KEY;
const EVO_INSTANCE = process.env.EVO_INSTANCE || process.env.VITE_EVO_INSTANCE;

if (!EVO_API_URL) {
    throw new Error('EVO_API_URL is required');
}

if (!EVO_API_KEY) {
    throw new Error('EVO_API_KEY is required');
}

if (!EVO_INSTANCE) {
    throw new Error('EVO_INSTANCE is required');
}

export const whatsappController = {
    verifyWebhook: (_req: Request, res: Response) => {
        res.status(200).send('Webhook is active');
    },

    receiveMessage: async (req: Request, res: Response) => {
        try {
            const { event, data } = req.body;
            console.log(`[Webhook] Evento recebido: ${event}`);

            if (event === 'messages.upsert' && data) {
                const { message, key, pushName } = data;
                const remoteJid = key?.remoteJid;
                const from = remoteJid?.split('@')[0];

                console.log(`[Webhook] Mensagem de: ${from} (${pushName})`);

                if (key?.fromMe) {
                    return res.sendStatus(200);
                }

                const text =
                    message?.conversation ||
                    message?.extendedTextMessage?.text ||
                    message?.imageMessage?.caption ||
                    '';

                const name = pushName || from;

                if (from && text) {
                    let { data: conversa, error: convErr } = await supabase
                        .from('conversas')
                        .select('*')
                        .eq('telefone', from)
                        .maybeSingle();

                    if (!conversa) {
                        console.log(`[Webhook] Criando nova conversa para ${from}`);
                        const { data: newConv, error: createErr } = await supabase
                            .from('conversas')
                            .insert([
                                {
                                    cliente_nome: name,
                                    telefone: from,
                                    status_aberto: true,
                                },
                            ])
                            .select()
                            .single();

                        if (createErr) {
                            console.error('[Webhook] Erro ao criar conversa:', createErr);
                            return res.sendStatus(500);
                        }
                        conversa = newConv;
                    }

                    if (conversa) {
                        const { error: msgError } = await supabase.from('mensagens').insert([
                            {
                                conversa_id: conversa.id,
                                conteudo: text,
                                tipo_envio: 'received',
                                wa_message_id: key?.id,
                            },
                        ]);

                        if (msgError) {
                            console.error('[Webhook] Erro ao salvar mensagem:', msgError);
                            return res.sendStatus(500);
                        }
                        console.log(`[Webhook] Mensagem salva com sucesso na conversa ${conversa.id}`);
                    }
                }
            }

            return res.sendStatus(200);
        } catch (err) {
            console.error('[Webhook] Erro crítico no processamento:', err);
            return res.sendStatus(500);
        }
    },

    sendMessage: async (req: Request, res: Response) => {
        const { conversa_id, telefone, conteudo } = req.body;
        console.log(`[API Send] Enviando para ${telefone}`);

        try {
            const response = await axios.post(
                `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
                {
                    number: telefone,
                    text: conteudo,
                },
                {
                    headers: {
                        apikey: EVO_API_KEY,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const { data, error } = await supabase
                .from('mensagens')
                .insert([
                    {
                        conversa_id,
                        conteudo,
                        tipo_envio: 'sent',
                        wa_message_id: response.data?.key?.id || `manual-${Date.now()}`,
                    },
                ])
                .select();

            if (error) {
                console.error('[API Send] Erro ao salvar log no banco:', error);
                return res.status(500).json({ error: 'Failed to save outgoing message' });
            }

            return res.status(200).json(data);
        } catch (err: any) {
            console.error(
                '[API Send] Erro na Evolution API:',
                err.response?.data || err.message
            );
            return res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    },
};
