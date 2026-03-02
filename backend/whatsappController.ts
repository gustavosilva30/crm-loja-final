import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

export const whatsappController = {
    // Webhook Verification (GET)
    verifyWebhook: (req: Request, res: Response) => {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    },

    // Receive Messages (Webhook POST)
    receiveMessage: async (req: Request, res: Response) => {
        try {
            const entry = req.body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const message = value?.messages?.[0];

            if (message) {
                const from = message.from;
                const text = message.text?.body;
                const name = value?.contacts?.[0]?.profile?.name || from;

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
                            wa_message_id: message.id
                        }
                    ]);
                }
            }

            res.sendStatus(200);
        } catch (err) {
            console.error('Error on WhatsApp Webhook:', err);
            res.sendStatus(500);
        }
    },

    // Send Message (POST /send)
    sendMessage: async (req: Request, res: Response) => {
        const { conversa_id, telefone, conteudo } = req.body;

        try {
            // 1. Send via Meta Graph API
            const response = await axios.post(
                `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: telefone,
                    text: { body: conteudo }
                },
                {
                    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
                }
            );

            // 2. Save outgoing message to DB
            const { data, error } = await supabase.from('mensagens').insert([
                {
                    conversa_id: conversa_id,
                    conteudo: conteudo,
                    tipo_envio: 'sent',
                    wa_message_id: response.data.messages?.[0]?.id
                }
            ]).select();

            res.status(200).json(data);
        } catch (err: any) {
            console.error('Error sending WhatsApp message:', err.response?.data || err.message);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
};
