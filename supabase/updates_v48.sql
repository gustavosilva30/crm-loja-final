-- Versão 48: Nome do Atendente nas Mensagens
-- Objetivo: Rastrear qual atendente enviou cada mensagem para exibir no chat.

-- 1. Adicionar coluna atendente_nome na tabela mensagens
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mensagens' AND column_name='atendente_nome') THEN
        ALTER TABLE public.mensagens ADD COLUMN atendente_nome TEXT;
    END IF;
END $$;

-- 2. Atualizar mensagens existentes enviadas por atendentes (opcional, apenas para retrocompatibilidade)
-- UPDATE public.mensagens SET atendente_nome = 'Sistema' WHERE tipo_envio = 'sent' AND atendente_nome IS NULL;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
