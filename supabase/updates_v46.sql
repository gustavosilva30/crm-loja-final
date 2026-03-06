-- Versão 46: Sistema de Funil de Vendas no Atendimento
-- Objetivo: Classificar conversas em etapas de funil para gestão comercial.

-- 1. Adicionar coluna de etapa do funil na tabela de conversas
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='conversas') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversas' AND column_name='etapa_funil') THEN
            ALTER TABLE public.conversas ADD COLUMN etapa_funil VARCHAR(50) DEFAULT 'Novo Lead';
        END IF;
    END IF;
END $$;

-- 2. Índices para busca por etapa
CREATE INDEX IF NOT EXISTS idx_conversas_etapa ON public.conversas(etapa_funil);

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
