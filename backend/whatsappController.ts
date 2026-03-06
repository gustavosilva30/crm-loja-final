import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
}

if (!supabaseAnonKey) {
    throw new Error('SUPABASE_ANON_KEY is required');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EVO_API_URL = process.env.EVO_API_URL;
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_INSTANCE = process.env.EVO_INSTANCE;

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
        return res.status(200).send('Webhook is active');
    },

    receiveMessage: async (req: Request, res: Response) => {
        try {
            const event = req.body.event;
            const data = req.body.data;

            if (event !== 'messages.upsert' || !data) {
                return res.sendStatus(200);
            }

            const message = data.message;
            const key = data.key;

            const remoteJid = key?.remoteJid;
            const from = remoteJid?.split('@')[0];

            if (!from) {
                return res.sendStatus(200);
            }

            if (key?.fromMe) {
                return res.sendStatus(200);
            }

            const text =
                message?.conversation ||
                message?.extendedTextMessage?.text ||
                message?.imageMessage?.caption ||
                message?.videoMessage?.caption ||
                '';

            const name = data.pushName || from;

            if (!text) {
                return res.sendStatus(200);
            }

            let conversa: any = null;

            const { data: conversaExistente, error: convErr } = await supabase
                .from('conversas')
                .select('*')
                .eq('telefone', from)
                .maybeSingle();

            if (convErr) {
                console.error('Erro ao buscar conversa:', convErr);
                return res.sendStatus(500);
            }

            conversa = conversaExistente;

            if (!conversa) {
                const { data: newConv, error: createErr } = await supabase
                    .from('conversas')
                    .insert([
                        {
                            telefone: from,
                            cliente_nome: name,
                            status_aberto: true,
                        },
                    ])
                    .select()
                    .single();

                if (createErr) {
                    console.error('Erro ao criar conversa:', createErr);
                    return res.sendStatus(500);
                }

                conversa = newConv;
            }

            const { error: msgError } = await supabase.from('mensagens').insert([
                {
                    conversa_id: conversa.id,
                    remetente: from,
                    mensagem: text,
                    conteudo: text,
                    tipo: 'texto',
                    tipo_envio: 'received',
                    wa_message_id: key?.id || null,
                },
            ]);

            if (msgError) {
                console.error('Erro ao salvar mensagem recebida:', msgError);
                return res.sendStatus(500);
            }

            return res.sendStatus(200);
        } catch (err) {
            console.error('Error on Evolution API Webhook:', err);
            return res.sendStatus(500);
        }
    },

    sendMessage: async (req: Request, res: Response) => {
        const { conversa_id, telefone, conteudo } = req.body;

        if (!telefone || !conteudo) {
            return res.status(400).json({
                error: 'telefone e conteudo são obrigatórios',
            });
        }

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
                        remetente: 'atendente',
                        mensagem: conteudo,
                        conteudo: conteudo,
                        tipo: 'texto',
                        tipo_envio: 'sent',
                        wa_message_id: response.data?.key?.id || `manual-${Date.now()}`,
                    },
                ])
                .select();

            if (error) {
                console.error('Erro ao salvar mensagem enviada:', error);
                return res.status(500).json({ error: 'Failed to save outgoing message' });
            }

            return res.status(200).json(data);
        } catch (err: any) {
            console.error(
                'Error sending message via Evolution API:',
                err.response?.data || err.message
            );
            return res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    },
};