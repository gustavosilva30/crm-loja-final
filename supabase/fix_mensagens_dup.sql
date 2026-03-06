-- 1. CLEANUP DE DUPLICADAS: Remove todas as mensagens onde o wa_message_id é repetido. 
-- Mantém apenas a mais antiga (a original) recebida.
DELETE FROM public.mensagens
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY wa_message_id ORDER BY timestamp ASC) AS rnum
        FROM public.mensagens
        WHERE wa_message_id IS NOT NULL 
    ) t
    WHERE t.rnum > 1
);

-- 2. TRAVA DE PREVENÇÃO: Agora que as duplicadas foram apagadas, 
-- aplicamos a trava para impedir que a Evolution (ou bugs futuros) salvem o mesmo id duas vezes.
ALTER TABLE public.mensagens ADD CONSTRAINT mensagens_wa_message_id_unique UNIQUE (wa_message_id);
