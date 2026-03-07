-- Adicionar colunas faltantes para suportar descontos e metadados em itens de venda e orçamentos
ALTER TABLE public.vendas_itens ADD COLUMN IF NOT EXISTS desconto DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE public.vendas_itens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Garantir que orçamentos também tenham suporte a descontos se necessário no futuro
ALTER TABLE public.orcamentos_itens ADD COLUMN IF NOT EXISTS desconto DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE public.orcamentos_itens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Adicionar índices para performance no Dashboard
CREATE INDEX IF NOT EXISTS idx_vendas_data_venda ON public.vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda_id ON public.vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_produto_id ON public.vendas_itens(produto_id);
