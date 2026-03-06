import { Request, Response } from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase env vars are missing');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EVO_API_URL = process.env.EVO_API_URL;
const EVO_API_KEY = process.env.EVO_API_KEY;

if (!EVO_API_URL || !EVO_API_KEY) {
    throw new Error('Evolution API env vars (URL or KEY) are missing.');
}

const uploadBase64ToSupabase = async (base64Data: string, mimeType: string) => {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const extension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
        const BUCKET_NAME = 'whatsapp_media';

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, buffer, { contentType: mimeType, upsert: false });

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

export const fetchProfilePic = async (instanceName: string, number: string): Promise<string | null> => {
    try {
        const { data } = await axios.post(`${EVO_API_URL}/chat/fetchProfilePictureUrl/${instanceName}`, {
            number: number
        }, { headers: { apikey: EVO_API_KEY } });
        return data?.profilePicUrl || null;
    } catch (err) {
        return null;
    }
};

export const fetchGroupInfo = async (instanceName: string, groupJid: string): Promise<string | null> => {
    try {
        const { data } = await axios.get(`${EVO_API_URL}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, { headers: { apikey: EVO_API_KEY } });
        return data?.subject || null;
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
            const instanceName = req.body.instance || req.body.instanceName; // Suporte a campos variados da Evolution

            console.log(`[Webhook] Evento: ${event} | Instância: ${instanceName} | Keys: ${Object.keys(req.body).join(', ')}`);

            if (!instanceName || !data) {
                // Se for um evento de checagem ou vazio, apenas confirma
                console.log('[Webhook] Payload sem instance ou data ignorado.');
                return res.sendStatus(200);
            }

            // Identificar instância pelo nome recebido no Webhook
            const { data: dbInstance, error: errInst } = await supabase
                .from('whatsapp_instancias')
                .select('*')
                .eq('instance_name', instanceName)
                .maybeSingle();

            if (errInst || !dbInstance) {
                console.log(`[Webhook] Instância '${instanceName}' não encontrada no banco de dados. Ignorando.`);
                return res.sendStatus(200);
            }

            // 1. Tratar Evento de Conexão
            if (event === 'connection.update') {
                const state = data.state;
                if (state) {
                    console.log(`[Webhook] Atualizando status de conexão da instância ${instanceName} para: ${state}`);
                    await supabase.from('whatsapp_instancias')
                        .update({
                            status_conexao: state,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', dbInstance.id);
                }
                return res.sendStatus(200);
            }

            // 2. Tratar Mensagens (Apenas upsert por enquanto)
            if (event !== 'messages.upsert') {
                return res.sendStatus(200);
            }

            const message = data.message;
            const key = data.key;
            const remoteJid = key?.remoteJid;
            const from = remoteJid?.split('@')[0];
            const isGroup = remoteJid?.endsWith('@g.us');

            if (!from) return res.sendStatus(200);

            const isFromMe = key?.fromMe || false;
            const participant = data.participant || key?.participant || data.message?.participant;
            const actualSender = isGroup && participant ? participant.split('@')[0] : from;

            let text = message?.conversation ||
                message?.extendedTextMessage?.text ||
                message?.imageMessage?.caption ||
                message?.videoMessage?.caption ||
                message?.documentMessage?.caption || '';

            const senderName = data.pushName || actualSender;
            const convName = isGroup ? (data.pushName || from) : senderName;

            let actualConvName = convName;
            if (isGroup) {
                const groupName = await fetchGroupInfo(instanceName, remoteJid);
                if (groupName) actualConvName = groupName;
            }

            let profilePicUrl = data.profilePicUrl || data.message?.profilePicUrl || null;

            if (!profilePicUrl) {
                profilePicUrl = await fetchProfilePic(instanceName, remoteJid);
            }

            // Extração de Mídia
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
                        console.error('[Supabase Storage] Erro bucket:', storageErr);
                    }
                } else {
                    text = text || `[Mídia recebida: ${mediaType}]`;
                }
            }

            if (!text && !mediaUrl) return res.sendStatus(200);

            // Resolução de Conversa baseada em instância e telefone
            let conversa: any = null;
            const { data: conversaExistente } = await supabase
                .from('conversas')
                .select('*')
                .eq('telefone', from)
                .eq('instancia_id', dbInstance.id)
                .maybeSingle();

            conversa = conversaExistente;

            if (!conversa) {
                const { data: newConv, error: createErr } = await supabase
                    .from('conversas')
                    .insert([{
                        instancia_id: dbInstance.id,
                        atendente_id: dbInstance.atendente_id,
                        telefone: from,
                        cliente_nome: actualConvName,
                        status_aberto: true,
                        is_group: isGroup,
                        unread_count: isFromMe ? 0 : 1,
                        nao_lidas_count: isFromMe ? 0 : 1,
                        last_message_at: new Date().toISOString(),
                        ultima_mensagem_em: new Date().toISOString(),
                        last_message_text: text,
                        ultima_mensagem: text,
                        updated_at: new Date().toISOString(),
                        foto_url: profilePicUrl,
                        legacy: false
                    }])
                    .select()
                    .single();

                if (createErr) {
                    if (createErr.code === '23505') {
                        const { data: retryConv } = await supabase.from('conversas').select('*').eq('telefone', from).eq('instancia_id', dbInstance.id).maybeSingle();
                        conversa = retryConv;
                    } else {
                        throw createErr;
                    }
                } else {
                    conversa = newConv;
                }
            } else {
                const newUnreadCount = isFromMe ? (conversa.unread_count || 0) : (conversa.unread_count || 0) + 1;
                const updatePayload: any = {
                    is_group: isGroup,
                    unread_count: newUnreadCount,
                    nao_lidas_count: newUnreadCount,
                    last_message_at: new Date().toISOString(),
                    ultima_mensagem_em: new Date().toISOString(),
                    last_message_text: text,
                    ultima_mensagem: text,
                    updated_at: new Date().toISOString()
                };
                if (profilePicUrl) updatePayload.foto_url = profilePicUrl;
                updatePayload.cliente_nome = actualConvName;

                await supabase.from('conversas').update(updatePayload).eq('id', conversa.id);
            }

            if (profilePicUrl && !isGroup) {
                supabase.from('contatos').update({ foto_url: profilePicUrl, updated_at: new Date().toISOString() })
                    .eq('telefone', from).then(({ error }) => { if (error) console.log('[Sync Contatos] Erro:', error.message); });
            }

            // Preparar JSON seguro e insert da mensagem
            const payloadJson = { ...data };
            if (payloadJson.base64) delete payloadJson.base64;
            if (payloadJson.message?.base64) delete payloadJson.message.base64;

            const { error: msgError } = await supabase.from('mensagens').insert([{
                instancia_id: dbInstance.id,
                atendente_id: dbInstance.atendente_id,
                conversa_id: conversa.id,
                remetente: isFromMe ? 'Celular' : senderName,
                mensagem: text,
                conteudo: text,
                tipo: mediaType || 'texto',
                tipo_envio: isFromMe ? 'sent' : 'received',
                direction: isFromMe ? 'outbound' : 'inbound',
                status_envio: isFromMe ? 'delivered' : 'read',
                wa_message_id: key?.id || `manual-${Date.now()}`,
                media_url: mediaUrl,
                media_type: mediaType,
                mime_type: mimeType,
                file_name: fileName,
                remetente_foto: isGroup && !isFromMe ? profilePicUrl : null,
                payload_json: payloadJson
            }]);

            if (msgError && msgError.code !== '23505') { // Ignora violação de constraint Unique
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
        const { conversa_id, telefone, conteudo, mediaBase64, mediaMimeType, mediaFileName, atendente_nome, instancia_id } = req.body;

        if (!telefone || !instancia_id) {
            return res.status(400).json({ error: 'telefone e instancia_id são obrigatórios' });
        }

        try {
            const { data: dbInstance, error: errInst } = await supabase.from('whatsapp_instancias').select('*').eq('id', instancia_id).maybeSingle();
            if (errInst || !dbInstance) return res.status(404).json({ error: 'Instância não encontrada' });
            const instanceName = dbInstance.instance_name;

            let evolutionResponse;
            let mediaUrl = null;
            let mediaType = 'texto';
            let messageToClient = atendente_nome ? `*${atendente_nome}:*\n${conteudo}` : conteudo;

            const tasks: Promise<any>[] = [];

            if (mediaBase64) {
                const base64Data = mediaBase64.includes(',') ? mediaBase64.split(',')[1] : mediaBase64;
                const isAudio = mediaMimeType?.startsWith('audio/');

                const uploadTask = uploadBase64ToSupabase(base64Data, mediaMimeType || 'application/octet-stream')
                    .then(res => { if (res) mediaUrl = res.publicUrl; });
                tasks.push(uploadTask);

                let evoTask;
                if (isAudio && (mediaMimeType.includes('ogg') || mediaMimeType.includes('mp4'))) {
                    mediaType = 'audio';
                    evoTask = axios.post(`${EVO_API_URL}/message/sendWhatsAppAudio/${instanceName}`, { number: telefone, audio: mediaBase64 }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                } else {
                    mediaType = mediaMimeType?.startsWith('image/') ? 'image' : mediaMimeType?.startsWith('video/') ? 'video' : 'document';
                    evoTask = axios.post(`${EVO_API_URL}/message/sendMedia/${instanceName}`, { number: telefone, mediatype: mediaType, mimetype: mediaMimeType || 'application/octet-stream', caption: messageToClient || undefined, media: base64Data, fileName: mediaFileName || 'arquivo' }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
                }
                tasks.push(evoTask.then(res => evolutionResponse = res));
            } else {
                const textTask = axios.post(`${EVO_API_URL}/message/sendText/${instanceName}`, { number: telefone, text: messageToClient }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } }).then(res => evolutionResponse = res);
                tasks.push(textTask);
            }

            await Promise.all(tasks);

            const { data, error } = await supabase.from('mensagens').insert([{
                instancia_id: dbInstance.id,
                atendente_id: dbInstance.atendente_id,
                conversa_id,
                remetente: 'atendente',
                mensagem: conteudo || '',
                conteudo: conteudo || '',
                tipo: mediaType,
                tipo_envio: 'sent',
                direction: 'outbound',
                status_envio: 'sent',
                wa_message_id: evolutionResponse?.data?.key?.id || evolutionResponse?.data?.id || `manual-${Date.now()}`,
                media_url: mediaUrl,
                media_type: mediaType,
                mime_type: mediaMimeType,
                file_name: mediaFileName,
                atendente_nome: atendente_nome || null
            }]).select();

            if (error) {
                console.error('Erro ao salvar mensagem enviada:', error);
                return res.status(500).json({ error: 'Failed to save outgoing message' });
            }

            supabase.from('conversas').update({
                last_message_at: new Date().toISOString(),
                ultima_mensagem_em: new Date().toISOString(),
                last_message_text: conteudo,
                ultima_mensagem: conteudo,
                updated_at: new Date().toISOString()
            }).eq('id', conversa_id).then();

            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Error sending message:', err.response?.data || err.message);
            return res.status(500).json({ error: 'Failed to send message via Evolution API' });
        }
    },

    deleteMessage: async (req: Request, res: Response) => {
        const { telefone, wa_message_id, deleteForEveryone, instancia_id } = req.body;
        if (!telefone || !wa_message_id || !instancia_id) return res.status(400).json({ error: 'telefone, wa_message_id e instancia_id são obrigatórios' });

        try {
            const { data: dbInstance } = await supabase.from('whatsapp_instancias').select('*').eq('id', instancia_id).maybeSingle();
            if (deleteForEveryone && dbInstance) {
                try {
                    await axios.delete(`${EVO_API_URL}/chat/deleteMessageForEveryone/${dbInstance.instance_name}`, {
                        headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' },
                        data: { number: telefone, messageId: wa_message_id }
                    });
                } catch (err: any) { console.error('Aviso: Erro delete Evo:', err.response?.data || err.message); }
            }
            return res.status(200).json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    sendReaction: async (req: Request, res: Response) => {
        const { telefone, wa_message_id, emoji, instancia_id } = req.body;
        if (!telefone || !wa_message_id || !emoji || !instancia_id) return res.status(400).json({ error: 'Faltam campos (instancia_id)' });

        try {
            const { data: dbInstance } = await supabase.from('whatsapp_instancias').select('*').eq('id', instancia_id).maybeSingle();
            if (dbInstance) {
                await axios.post(`${EVO_API_URL}/message/sendReaction/${dbInstance.instance_name}`, {
                    number: telefone, reactionMessage: { key: { id: wa_message_id, fromMe: false }, text: emoji }
                }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
            }
            return res.status(200).json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    sendLocation: async (req: Request, res: Response) => {
        const { telefone, name, address, latitude, longitude, instancia_id } = req.body;
        if (!telefone || !latitude || !longitude || !instancia_id) return res.status(400).json({ error: 'Faltam campos' });

        try {
            const { data: dbInstance } = await supabase.from('whatsapp_instancias').select('*').eq('id', instancia_id).maybeSingle();
            if (!dbInstance) return res.status(404).json({ error: 'Instância não encontrada' });
            const evolutionResponse = await axios.post(`${EVO_API_URL}/message/sendLocation/${dbInstance.instance_name}`, {
                number: telefone, name: name || 'Localização', address: address || 'Endereço', latitude: String(latitude), longitude: String(longitude)
            }, { headers: { apikey: EVO_API_KEY, 'Content-Type': 'application/json' } });
            return res.status(200).json(evolutionResponse.data);
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    getConnectionStatus: async (req: Request, res: Response) => {
        const { instance_name } = req.query;
        if (!instance_name) return res.status(400).json({ error: 'instance_name query is required' });
        try {
            const evolutionResponse = await axios.get(`${EVO_API_URL}/instance/connectionState/${instance_name}`, { headers: { apikey: EVO_API_KEY } });
            const state = evolutionResponse.data?.instance?.state || 'close';

            // Sync status on DB
            supabase.from('whatsapp_instancias').update({ status_conexao: state, updated_at: new Date().toISOString() })
                .eq('instance_name', instance_name).then();

            // Auto-heal: Ensure webhook is set if WEBHOOK_URL exists
            const WEBHOOK_URL = process.env.WEBHOOK_URL;
            if (WEBHOOK_URL) {
                axios.post(`${EVO_API_URL}/webhook/set/${instance_name}`, {
                    url: WEBHOOK_URL,
                    webhook_by_events: false,
                    webhook_base64: true,
                    events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE"]
                }, { headers: { apikey: EVO_API_KEY } }).catch(() => { });
            }

            return res.status(200).json({ state });
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error', state: 'unknown' });
        }
    },

    getQrCode: async (req: Request, res: Response) => {
        const { instance_name } = req.query;
        if (!instance_name) return res.status(400).json({ error: 'instance_name is required' });
        try {
            const evolutionResponse = await axios.get(`${EVO_API_URL}/instance/connect/${instance_name}`, { headers: { apikey: EVO_API_KEY } });
            const data = evolutionResponse.data;
            if (data?.base64) return res.status(200).json({ qr_base64: data.base64 });
            if (data?.instance?.state === 'open') return res.status(200).json({ state: 'open' });
            return res.status(200).json({ data });
        } catch (err: any) {
            return res.status(500).json({ error: err.response?.data?.response?.message?.[0] || 'Internal Server Error' });
        }
    },

    disconnect: async (req: Request, res: Response) => {
        const { instance_name } = req.body;
        if (!instance_name) return res.status(400).json({ error: 'instance_name is required' });
        try {
            await axios.delete(`${EVO_API_URL}/instance/logout/${instance_name}`, { headers: { apikey: EVO_API_KEY } });

            supabase.from('whatsapp_instancias').update({
                status_conexao: 'close',
                ultima_desconexao_em: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }).eq('instance_name', instance_name).then();

            return res.status(200).json({ success: true });
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    syncProfilePic: async (req: Request, res: Response) => {
        const { telefone, instancia_id } = req.body;
        if (!telefone || !instancia_id) return res.status(400).json({ error: 'telefone e instancia_id obrigatórios' });

        try {
            const { data: dbInstance } = await supabase.from('whatsapp_instancias').select('*').eq('id', instancia_id).maybeSingle();
            if (!dbInstance) return res.status(404).json({ error: 'Instância off' });

            const jid = telefone.includes('@') ? telefone : `${telefone}@s.whatsapp.net`;
            const profilePicUrl = await fetchProfilePic(dbInstance.instance_name, jid);

            if (profilePicUrl) {
                const updatePayload = { foto_url: profilePicUrl, updated_at: new Date().toISOString() };
                await Promise.all([
                    supabase.from('conversas').update(updatePayload).eq('telefone', telefone.split('@')[0]).eq('instancia_id', instancia_id),
                    supabase.from('contatos').update(updatePayload).eq('telefone', telefone.split('@')[0])
                ]);
                return res.status(200).json({ success: true, profilePicUrl });
            }
            return res.status(200).json({ success: false, message: 'Nenhuma foto encontrada' });
        } catch (err: any) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    createInstance: async (req: Request, res: Response) => {
        const { atendente_id } = req.body;
        if (!atendente_id) return res.status(400).json({ error: 'atendente_id é obrigatório' });

        try {
            console.log(`[createInstance] Iniciando para atendente_id: ${atendente_id}`);
            // Verifica se a instancia ja existe no banco
            const { data: existingDbInstance } = await supabase.from('whatsapp_instancias').select('*').eq('atendente_id', atendente_id).maybeSingle();

            if (existingDbInstance) {
                // Mesmo que exista no banco, vamos garantir que o webhook esteja certo na Evolution
                const instance_name = existingDbInstance.instance_name;
                const WEBHOOK_URL = process.env.WEBHOOK_URL;
                if (WEBHOOK_URL) {
                    try {
                        await axios.post(`${EVO_API_URL}/webhook/set/${instance_name}`, {
                            url: WEBHOOK_URL,
                            webhook_by_events: false,
                            webhook_base64: true,
                            events: [
                                "MESSAGES_UPSERT",
                                "MESSAGES_UPDATE",
                                "SEND_MESSAGE",
                                "CONNECTION_UPDATE"
                            ]
                        }, { headers: { apikey: EVO_API_KEY } });
                    } catch (e) { }
                }
                return res.status(200).json(existingDbInstance);
            }

            const { data: atendente } = await supabase.from('atendentes').select('nome').eq('id', atendente_id).single();
            const cleanName = (atendente?.nome || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';
            const instance_name = `crm_${cleanName}_${atendente_id.substring(0, 6)}`;

            // Tenta criar na API da Evolution
            try {
                console.log(`[createInstance] Criando na Evolution: ${instance_name}`);
                await axios.post(`${EVO_API_URL}/instance/create`, {
                    instanceName: instance_name,
                    token: "",
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS"
                }, { headers: { apikey: EVO_API_KEY } });
            } catch (createErr: any) {
                console.error(`[createInstance] Erro Evolution:`, createErr.response?.data || createErr.message);
                if (createErr.response?.data?.message !== 'Name or value already exists') {
                    throw createErr;
                }
            }

            // Configura webhook para essa nova instância
            const WEBHOOK_URL = process.env.WEBHOOK_URL;
            if (WEBHOOK_URL) {
                try {
                    await axios.post(`${EVO_API_URL}/webhook/set/${instance_name}`, {
                        url: WEBHOOK_URL,
                        webhook_by_events: false,
                        webhook_base64: true,
                        events: [
                            "MESSAGES_UPSERT",
                            "MESSAGES_UPDATE",
                            "SEND_MESSAGE",
                            "CONNECTION_UPDATE"
                        ]
                    }, { headers: { apikey: EVO_API_KEY } });
                } catch (err: any) {
                    console.log("[Aviso] Erro ao setar webhook: " + (err.response?.data?.message || err.message));
                }
            }

            // Salva no banco
            const { data: newInstance, error: dbErr } = await supabase.from('whatsapp_instancias').insert([{
                atendente_id: atendente_id,
                instance_name: instance_name,
                status_conexao: 'close'
            }]).select().single();

            if (dbErr) {
                console.error(`[createInstance] Erro Supabase DB:`, dbErr);
                return res.status(500).json({ error: 'Erro salvando instancia no DB' });
            }

            return res.status(200).json(newInstance);

        } catch (err: any) {
            console.error(`[createInstance] Erro Geral:`, err.response?.data || err.message || err);
            return res.status(500).json({ error: err.response?.data || err.message });
        }
    }
};

export { whatsappController };