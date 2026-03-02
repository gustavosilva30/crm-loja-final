-- Versão 23: Pagamentos Parciais e Integração Financeira

-- 1. Atualizar tabela de vendas com colunas de controle de pagamento
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS total_pago DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS valor_aberto DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Garantir coluna de saldo de haver nos clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS saldo_haver DECIMAL(10, 2) DEFAULT 0.00;

-- 3. Criar tabela de histórico de pagamentos da venda
CREATE TABLE IF NOT EXISTS public.vendas_pagamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    valor DECIMAL(10, 2) NOT NULL,
    forma_pagamento VARCHAR(50) NOT NULL,
    data_pagamento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Índice para busca rápida de pagamentos por venda
CREATE INDEX IF NOT EXISTS idx_vendas_pagamentos_venda ON public.vendas_pagamentos(venda_id);

-- 5. Inicializar valor_aberto para vendas existentes (onde valor_aberto é 0 e status não é Pago)
UPDATE public.vendas 
SET valor_aberto = total 
WHERE valor_aberto = 0 AND status != 'Pago';

UPDATE public.vendas 
SET total_pago = total, valor_aberto = 0 
WHERE status = 'Pago';
