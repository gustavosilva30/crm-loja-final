import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

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

if (!EVO_API_URL || !EVO_API_KEY || !EVO_INSTANCE) {
    throw new Error('Evolution API env vars are missing.');
}

const uploadBase64ToSupabase = async (base64Data: string, mimeType: string) => {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

        const BUCKET_NAME = 'WHATSAPP_MEDIA';

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error(`[Supabase Storage] Erro ao subir para o bucket ${BUCKET_NAME}:`, error);
            // Tentar em minúsculas se falhar
            const { data: data2, error: error2 } = await supabase.storage
                .from('whatsapp_media')
                .upload(fileName, buffer, {
                    contentType: mimeType,
                    upsert: false
                });

            if (error2) {
                console.error('[Supabase Storage] Falha em ambas as tentativas de bucket.');
                return null;
            }

            const { data: { publicUrl } } = supabase.storage.from('whatsapp_media').getPublicUrl(fileName);
            return { publicUrl, fileName };
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        return { publicUrl, fileName };
    } catch (err) {
        console.error('Erro fatal no uploadBase64ToSupabase:', err);
        return null;
    }
};

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
            const isGroup = remoteJid?.endsWith('@g.us');

            if (!from || key?.fromMe) {
                return res.sendStatus(200);
            }

            let text =
                message?.conversation ||
                message?.extendedTextMessage?.text ||
                message?.imageMessage?.caption ||
                message?.videoMessage?.caption ||
                message?.documentMessage?.caption ||
                '';

            const name = data.pushName || from;

            // Media extraction
            const isMedia = message?.imageMessage || message?.audioMessage || message?.videoMessage || message?.documentMessage;
            let mediaUrl = null;
            let mediaType = null;
            let mimeType = null;
            let fileName = null;

            if (isMedia) {
                if (message?.imageMessage) { mediaType = 'image'; mimeType = message.imageMessage.mimetype; }
                else if (message?.audioMessage) { mediaType = 'audio'; mimeType = message.audioMessage.mimetype; }
                else if (message?.videoMessage) { mediaType = 'video'; mimeType = message.videoMessage.mimetype; }
                else if (message?.documentMessage) { mediaType = 'document'; mimeType = message.documentMessage.mimetype; fileName = message.documentMessage.fileName; }

                // Tentar encontrar o base64 em diferentes lugares comuns da Evolution API
                const base64Str = data.base64 ||
                    data.message?.base64 ||
                    message?.imageMessage?.base64 ||
                    message?.audioMessage?.base64 ||
                    message?.videoMessage?.base64 ||
                    message?.documentMessage?.base64;

                if (base64Str) {
                    const cleanBase64 = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
                    const uploadResult = await uploadBase64ToSupabase(cleanBase64, mimeType || 'application/octet-stream');

                    if (uploadResult) {
                        mediaUrl = uploadResult.publicUrl;
                        fileName = fileName || uploadResult.fileName;
                    }
                } else {
                    console.log(`[Webhook] Mídia ${mediaType} SEM Base64 no JID ${remoteJid}`);
                    text = text || `[Mídia recebida: ${mediaType}]`;
                }
            }

            if (!text && !mediaUrl) return res.sendStatus(200);

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
                    .insert([{ telefone: from, cliente_nome: name, status_aberto: true, is_group: isGroup }])
                    .select()
                    .single();

                if (createErr) {
                    console.error('Erro ao criar conversa:', createErr);
                    return res.sendStatus(500);
                }
                conversa = newConv;
            } else if (conversa.is_group !== isGroup) {
                // Atualizar status de grupo se mudar
                await supabase.from('conversas').update({ is_group: isGroup }).eq('id', conversa.id);
            }

            const { error: msgError } = await supabase.from('mensagens').insert([
                {
                    conversa_id: conversa.id,
                    remetente: from,
                    mensagem: text,
                    conteudo: text,
                    tipo: mediaType || 'texto',
                    tipo_envio: 'received',
                    wa_message_id: key?.id || null,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    mime_type: mimeType,
                    file_name: fileName
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
        const { conversa_id, telefone, conteudo, mediaBase64, mediaMimeType, mediaFileName, atendente_nome } = req.body;

        if (!telefone) {
            return res.status(400).json({ error: 'telefone é obrigatório' });
        }

        try {
            let evolutionResponse;
            let mediaUrl = null;
            let mediaType = 'texto';

            let messageToClient = conteudo;
            if (atendente_nome) {
                messageToClient = `*${atendente_nome}:*\n${conteudo}`;
            }

            if (mediaBase64) {
                // Determine Evo API endpoint based on mime type
                const base64Data = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
                const isAudio = mediaMimeType?.startsWith('audio/');

                // Upload to Supabase to save the URL in our DB
                const uploadResult = await uploadBase64ToSupabase(base64Data, mediaMimeType || 'application/octet-stream');
                if (uploadResult) {
                    mediaUrl = uploadResult.publicUrl;
                }

                if (isAudio && (mediaMimeType.includes('ogg') || mediaMimeType.includes('mp4'))) {
                    mediaType = 'audio';
                    evolutionResponse = await axios.post(`${EVO_API_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
                        number: telefone,
                        audio: mediaBase64 // Evo API prefere o data URI completo ou URL
                    }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                } else {
                    mediaType = mediaMimeType?.startsWith('image/') ? 'image' : mediaMimeType?.startsWith('video/') ? 'video' : 'document';
                    evolutionResponse = await axios.post(`${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`, {
                        number: telefone,
                        mediatype: mediaType,
                        mimetype: mediaMimeType || 'application/octet-stream',
                        caption: messageToClient || undefined,
                        media: base64Data, // sendMedia usually uses just the base64 string
                        fileName: mediaFileName || 'arquivo'
                    }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                }
            } else {
                evolutionResponse = await axios.post(`${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`, {
                    number: telefone,
                    text: messageToClient,
                }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
            }

            const { data, error } = await supabase
                .from('mensagens')
                .insert([
                    {
                        conversa_id,
                        remetente: 'atendente',
                        mensagem: conteudo || '',
                        conteudo: conteudo || '',
                        tipo: mediaType,
                        tipo_envio: 'sent',
                        wa_message_id: evolutionResponse.data?.key?.id || evolutionResponse.data?.id || `manual-${Date.now()}`,
                        media_url: mediaUrl,
                        media_type: mediaType,
                        mime_type: mediaMimeType,
                        file_name: mediaFileName,
                        atendente_nome: atendente_nome || null
                    },
                ])
                .select();

            if (error) {
                console.error('Erro ao salvar mensagem enviada:', error);
                return res.status(500).json({ error: 'Failed to save outgoing message' });
            }

            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Error sending message via Evolution API:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    },
};