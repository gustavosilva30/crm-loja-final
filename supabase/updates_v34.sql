-- Adicionar colunas faltantes na tabela de orçamentos para suportar impressão completa e relatórios
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS numero_pedido SERIAL,
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS condicao_pagamento VARCHAR(50) DEFAULT 'À Vista',
ADD COLUMN IF NOT EXISTS data_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN public.orcamentos.numero_pedido IS 'Número sequencial do orçamento para fácil identificação';
COMMENT ON COLUMN public.orcamentos.vendedor_id IS 'ID do vendedor responsável pelo orçamento';
COMMENT ON COLUMN public.orcamentos.condicao_pagamento IS 'Condição de pagamento sugerida no orçamento';
COMMENT ON COLUMN public.orcamentos.data_inicio IS 'Data e hora em que o orçamento foi iniciado';
