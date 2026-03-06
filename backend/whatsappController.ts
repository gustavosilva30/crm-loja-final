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

        const BUCKET_NAME = 'whatsapp_media';

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error(`[Supabase Storage] Erro ao subir para o bucket ${BUCKET_NAME}:`, error);
            return null;
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        return { publicUrl, fileName };
    } catch (err) {
        console.error('[Supabase Storage] Crítico:', err);
        return null;
    }
};

export const fetchProfilePic = async (number: string): Promise<string | null> => {
    try {
        const { data } = await axios.post(`${EVO_API_URL}/chat/fetchProfilePictureUrl/${EVO_INSTANCE}`, {
            number: number
        }, { headers: { apikey: EVO_API_KEY } });
        return data?.profilePicUrl || null;
    } catch (err) {
        return null;
    }
};

const whatsappController = {
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

            if (!from) {
                return res.sendStatus(200);
            }

            const isFromMe = key?.fromMe || false;

            const participant = data.participant || key?.participant || data.message?.participant;
            const actualSender = isGroup && participant ? participant.split('@')[0] : from;

            let text =
                message?.conversation ||
                message?.extendedTextMessage?.text ||
                message?.imageMessage?.caption ||
                message?.videoMessage?.caption ||
                message?.documentMessage?.caption ||
                '';

            const senderName = data.pushName || actualSender;
            const convName = isGroup ? (data.pushName || from) : senderName;

            let profilePicUrl = data.profilePicUrl || data.message?.profilePicUrl || null;

            // Se não veio foto no webhook, tentamos buscar ativamente (apenas se for nova conversa ou se quiser forçar)
            if (!profilePicUrl) {
                profilePicUrl = await fetchProfilePic(remoteJid);
            }

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
                    try {
                        const cleanBase64 = base64Str.includes(',') ? base64Str.split(',')[1] : base64Str;
                        const uploadResult = await uploadBase64ToSupabase(cleanBase64, mimeType || 'application/octet-stream');

                        if (uploadResult) {
                            mediaUrl = uploadResult.publicUrl;
                            fileName = fileName || uploadResult.fileName;
                        }
                    } catch (storageErr) {
                        console.error('[Supabase Storage] Erro ao subir mídia. Certifique-se que o bucket WHATSAPP_MEDIA existe:', storageErr);
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
                    .insert([{
                        telefone: from,
                        cliente_nome: convName,
                        status_aberto: true,
                        is_group: isGroup,
                        unread_count: isFromMe ? 0 : 1,
                        last_message_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        foto_url: profilePicUrl
                    }])
                    .select()
                    .single();

                if (createErr) {
                    if (createErr.code === '23505') {
                        const { data: retryConv } = await supabase.from('conversas').select('*').eq('telefone', from).maybeSingle();
                        conversa = retryConv;
                    } else {
                        console.error('Erro ao criar conversa:', createErr);
                        return res.sendStatus(500);
                    }
                } else {
                    conversa = newConv;
                }
            } else {
                const updatePayload: any = {
                    is_group: isGroup,
                    unread_count: isFromMe ? (conversa.unread_count || 0) : (conversa.unread_count || 0) + 1,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                if (profilePicUrl) {
                    updatePayload.foto_url = profilePicUrl;
                }

                // Somente atualizamos o nome se NÃO for grupo (pois no grupo o pushName do webhook é da pessoa)
                if (!isGroup) {
                    updatePayload.cliente_nome = convName;
                }

                await supabase.from('conversas').update(updatePayload).eq('id', conversa.id);
            }

            const { error: msgError } = await supabase.from('mensagens').insert([
                {
                    conversa_id: conversa.id,
                    remetente: isFromMe ? 'Celular' : senderName,
                    mensagem: text,
                    conteudo: text,
                    tipo: mediaType || 'texto',
                    tipo_envio: isFromMe ? 'sent' : 'received',
                    wa_message_id: key?.id || null,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    mime_type: mimeType,
                    file_name: fileName,
                    remetente_foto: isGroup && !isFromMe ? profilePicUrl : null
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

            // Parallelize operations for better performance
            const tasks: Promise<any>[] = [];

            if (mediaBase64) {
                const base64Data = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
                const isAudio = mediaMimeType?.startsWith('audio/');

                // Task 1: Upload to Supabase
                const uploadTask = uploadBase64ToSupabase(base64Data, mediaMimeType || 'application/octet-stream')
                    .then(res => { if (res) mediaUrl = res.publicUrl; });
                tasks.push(uploadTask);

                // Task 2: Send to Evolution API
                let evoTask;
                if (isAudio && (mediaMimeType.includes('ogg') || mediaMimeType.includes('mp4'))) {
                    mediaType = 'audio';
                    evoTask = axios.post(`${EVO_API_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
                        number: telefone,
                        audio: mediaBase64
                    }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                } else {
                    mediaType = mediaMimeType?.startsWith('image/') ? 'image' : mediaMimeType?.startsWith('video/') ? 'video' : 'document';
                    evoTask = axios.post(`${EVO_API_URL}/message/sendMedia/${EVO_INSTANCE}`, {
                        number: telefone,
                        mediatype: mediaType,
                        mimetype: mediaMimeType || 'application/octet-stream',
                        caption: messageToClient || undefined,
                        media: base64Data,
                        fileName: mediaFileName || 'arquivo'
                    }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                }
                tasks.push(evoTask.then(res => evolutionResponse = res));
            } else {
                // Just text message
                const textTask = axios.post(`${EVO_API_URL}/message/sendText/${EVO_INSTANCE}`, {
                    number: telefone,
                    text: messageToClient,
                }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } })
                    .then(res => evolutionResponse = res);
                tasks.push(textTask);
            }

            // Wait for critical tasks (API Send + Upload)
            await Promise.all(tasks);

            // Save to DB
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
                        wa_message_id: evolutionResponse?.data?.key?.id || evolutionResponse?.data?.id || `manual-${Date.now()}`,
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

            // Background task: Update conversation timestamp (don't await)
            supabase.from('conversas').update({
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', conversa_id).then(({ error }) => {
                if (error) console.error('Erro ao atualizar conversa em background:', error);
            });

            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Error sending message via Evolution API:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    },

    deleteMessage: async (req: Request, res: Response) => {
        const { telefone, wa_message_id, deleteForEveryone } = req.body;

        if (!telefone || !wa_message_id) {
            return res.status(400).json({ error: 'telefone e wa_message_id são obrigatórios' });
        }

        try {
            if (deleteForEveryone) {
                // Tenta apagar via Evolution API
                try {
                    await axios.delete(`${EVO_API_URL}/chat/deleteMessageForEveryone/${EVO_INSTANCE}`, {
                        headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
                        data: {
                            number: telefone,
                            messageId: wa_message_id
                        }
                    });
                } catch (err: any) {
                    console.error('Aviso: Erro ao apagar na Evolution API:', err.response?.data || err.message);
                    // Opcionalmente podemos retornar erro se quisermos estritamente depender da api
                    // Mas vamos ignorar se falhar pois o provedor pode não aceitar mais apagar (passou do tempo)
                }
            }

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('Error on deleteMessage:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    sendReaction: async (req: Request, res: Response) => {
        const { telefone, wa_message_id, emoji } = req.body;

        if (!telefone || !wa_message_id || !emoji) {
            return res.status(400).json({ error: 'telefone, wa_message_id e emoji são obrigatórios' });
        }

        try {
            await axios.post(`${EVO_API_URL}/message/sendReaction/${EVO_INSTANCE}`, {
                number: telefone,
                reactionMessage: {
                    key: {
                        id: wa_message_id,
                        fromMe: false // or handle depending on message
                    },
                    text: emoji
                }
            }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });

            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('Error on sendReaction:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    sendLocation: async (req: Request, res: Response) => {
        const { telefone, name, address, latitude, longitude } = req.body;

        if (!telefone || !latitude || !longitude) {
            return res.status(400).json({ error: 'telefone, latitude e longitude são obrigatórios' });
        }

        try {
            const evolutionResponse = await axios.post(`${EVO_API_URL}/message/sendLocation/${EVO_INSTANCE}`, {
                number: telefone,
                name: name || 'Localização',
                address: address || 'Endereço',
                latitude: String(latitude),
                longitude: String(longitude)
            }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });

            return res.status(200).json(evolutionResponse.data);
        } catch (err: any) {
            console.error('Error on sendLocation:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    getConnectionStatus: async (req: Request, res: Response) => {
        try {
            const evolutionResponse = await axios.get(`${EVO_API_URL}/instance/connectionState/${EVO_INSTANCE}`, {
                headers: { apikey: EVO_API_KEY }
            });
            const state = evolutionResponse.data?.instance?.state || 'close';
            return res.status(200).json({ state });
        } catch (err: any) {
            console.error('Error on getConnectionStatus:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Internal Server Error', state: 'unknown' });
        }
    },

    getQrCode: async (req: Request, res: Response) => {
        try {
            const evolutionResponse = await axios.get(`${EVO_API_URL}/instance/connect/${EVO_INSTANCE}`, {
                headers: { apikey: EVO_API_KEY }
            });

            // É possível que retorne o próprio base64 se estiver em close/connecting
            // ou retornar infos da API. Depende da versão.
            const data = evolutionResponse.data;
            if (data?.base64) {
                return res.status(200).json({ qr_base64: data.base64 });
            }
            if (data?.instance?.state === 'open') {
                return res.status(200).json({ state: 'open' });
            }
            return res.status(200).json({ data });
        } catch (err: any) {
            console.error('Error on getQrCode:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    disconnect: async (req: Request, res: Response) => {
        try {
            await axios.delete(`${EVO_API_URL}/instance/logout/${EVO_INSTANCE}`, {
                headers: { apikey: EVO_API_KEY }
            });
            return res.status(200).json({ success: true });
        } catch (err: any) {
            console.error('Error on disconnect:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

export { whatsappController };