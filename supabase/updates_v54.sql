-- Sincronizar nao_lidas_count com unread_count no trigger de mensagens (WhatsApp)
CREATE OR REPLACE FUNCTION public.update_conversa_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversas
    SET
        last_message_at = NEW.timestamp,
        last_message_text = CASE
            WHEN NEW.conteudo IS NOT NULL AND NEW.conteudo != '' THEN LEFT(NEW.conteudo, 100)
            ELSE 'Mídia'
        END,
        last_message_kind = CASE
            WHEN NEW.tipo_envio = 'received' THEN 'received'
            ELSE 'sent'
        END,
        unread_count = CASE
            WHEN NEW.tipo_envio = 'received' THEN unread_count + 1
            ELSE unread_count
        END,
        nao_lidas_count = CASE
            WHEN NEW.tipo_envio = 'received' THEN COALESCE(nao_lidas_count, 0) + 1
            ELSE nao_lidas_count
        END,
        updated_at = NOW()
    WHERE id = NEW.conversa_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
