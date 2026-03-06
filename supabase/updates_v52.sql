-- Adicionar coluna para data real da última mensagem
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
-- Adicionar coluna de fixado para conversas
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Garantir que os dados atuais usem updated_at como base inicial
UPDATE public.conversas SET last_message_at = updated_at WHERE last_message_at IS NULL;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
