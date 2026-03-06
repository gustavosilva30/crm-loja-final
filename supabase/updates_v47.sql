-- Versão 47: Melhorias para Atendimento (Grupos e Status de Leitura)
-- Objetivo: Suportar filtros de grupos e mensagens não lidas.

-- 1. Coluna para identificar se a conversa é um grupo
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversas' AND column_name='is_group') THEN
        ALTER TABLE public.conversas ADD COLUMN is_group BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Coluna para contar mensagens não lidas na conversa
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversas' AND column_name='unread_count') THEN
        ALTER TABLE public.conversas ADD COLUMN unread_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Marcar mensagens lidas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mensagens' AND column_name='lida') THEN
        ALTER TABLE public.mensagens ADD COLUMN lida BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
