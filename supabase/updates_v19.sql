-- Versão 19: Melhorias no sistema de orçamentos
-- Adiciona vendedor e data de início para controle de validade

ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL;
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Comentário: A coluna 'validade' já existe, mas vamos garantir que ela seja preenchida 
-- automaticamente pelo frontend ou por um trigger se necessário. 
-- Por enquanto, o frontend lidará com o padrão de 10 dias.
