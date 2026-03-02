-- Adicionar colunas para relatórios de vendas e produtos por atendente

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL;
