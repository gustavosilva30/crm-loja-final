ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Adicionar foto do remetente na mensagem (útil para grupos)
ALTER TABLE public.mensagens ADD COLUMN IF NOT EXISTS remetente_foto TEXT;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
