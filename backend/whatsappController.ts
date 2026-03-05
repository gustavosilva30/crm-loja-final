import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

const EVO_API_URL = process.env.EVO_API_URL;
const EVO_API_KEY = process.env.EVO_API_KEY;
const EVO_INSTANCE = process.env.EVO_INSTANCE;

export const whatsappController = {
    // Webhook Verification (Evolution API doesn't strictly require this like Meta, but we can keep it for security check)
    verifyWebhook: (req: Request, res: Response) => {
        // Evolution API usually sends a simple POST. We can check a secret token if configured.
        res.status(200).send("Webhook is active");
    },

    // Receive Messages (Evolution API Webhook POST)
    receiveMessage: async (req: Request, res: Response) => {
        try {
            const event = req.body.event;
            const data = req.body.data;

            // Evolution API event for new messages is usually 'messages.upsert'
            if (event === 'messages.upsert' && data) {
                const message = data.message;
                const key = data.key;

                // Extract remote JID (phone number)
                const remoteJid = key?.remoteJid;
                const from = remoteJid?.split('@')[0]; // Remove @s.whatsapp.net

                // Only process external incoming messages (not from self)
                if (key?.fromMe) {
                    return res.sendStatus(200);
                }

                // Extract text content
                const text = message?.conversation ||
                    message?.extendedTextMessage?.text ||
                    message?.imageMessage?.caption || "";

                const name = data.pushName || from;

                if (from && text) {
                    // 1. Find or create conversation
                    let { data: conversa, error: convErr } = await supabase
                        .from('conversas')
                        .select('*')
                        .eq('telefone', from)
                        .single();

                    if (convErr && convErr.code === 'PGRST116') {
                        const { data: newConv, error: createErr } = await supabase
                            .from('conversas')
                            .insert([{ cliente_nome: name, telefone: from, status_aberto: true }])
                            .select()
                            .single();
                        conversa = newConv;
                    }

                    if (conversa) {
                        // 2. Save incoming message
                        await supabase.from('mensagens').insert([
                            {
                                conversa_id: conversa.id,
                                conteudo: text,
                                tipo_envio: 'received',
                                wa_message_id: key.id
                            }
                        ]);
                    }
                }
            }

            res.sendStatus(200);
        } catch (err) {
            console.error('Error on Evolution API Webhook:', err);
            res.sendStatus(500);
        }
    },

    // Send Message (POST /send)
    sendMessage: async (req: Request, res: Response) => {
        const { conversa_id, telefone, conteudo } = req.body;

        try {
            // 1. Send via Evolution API
            const response = await axios.post(
                `${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`,
                {
                    number: telefone,
                    text: conteudo
                },
                {
                    headers: { 'apikey': EVO_API_KEY }
                }
            );

            // 2. Save outgoing message to DB
            const { data, error } = await supabase.from('mensagens').insert([
                {
                    conversa_id: conversa_id,
                    conteudo: conteudo,
                    tipo_envio: 'sent',
                    wa_message_id: response.data.key?.id || 'manual-' + Date.now()
                }
            ]).select();

            res.status(200).json(data);
        } catch (err: any) {
            console.error('Error sending message via Evolution API:', err.response?.data || err.message);
            res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    }
};
