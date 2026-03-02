-- Atualizações para Formas de Pagamento e Saldo Haver (VERSÃO CORRIGIDA)

-- 1. Adicionar coluna de saldo haver na tabela de clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS saldo_haver DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Atualizar Enums de forma de pagamento e status
DO $$ BEGIN
    CREATE TYPE forma_pagamento AS ENUM ('Dinheiro', 'Cartão Crédito', 'Cartão Débito', 'Boleto', 'Pix', 'Cheque', 'Haver Cliente');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Adicionar forma_pagamento na tabela de vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento DEFAULT 'Dinheiro';

-- 4. Adicionar forma_pagamento no financeiro
ALTER TABLE public.financeiro_lancamentos ADD COLUMN IF NOT EXISTS forma_pagamento forma_pagamento DEFAULT 'Dinheiro';

-- 5. Função para processar pagamento e atualizar saldo haver / caixa
CREATE OR REPLACE FUNCTION public.processar_pagamento_venda()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for pagamento em Dinheiro, cria lançamento automático no financeiro como 'Pago'
    IF NEW.forma_pagamento = 'Dinheiro' AND NEW.status = 'Pago' THEN
        INSERT INTO public.financeiro_lancamentos (tipo, valor, data_vencimento, data_pagamento, status, venda_id, descricao, forma_pagamento)
        VALUES ('Receita', NEW.total, CURRENT_DATE, CURRENT_DATE, 'Pago', NEW.id, 'Venda em Dinheiro: #' || SUBSTR(NEW.id::text, 1, 8), 'Dinheiro');
    END IF;

    -- Se for pagamento em 'Haver Cliente', desconta do saldo do cliente
    IF NEW.forma_pagamento = 'Haver Cliente' AND NEW.cliente_id IS NOT NULL THEN
        UPDATE public.clientes 
        SET saldo_haver = saldo_haver - NEW.total 
        WHERE id = NEW.cliente_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar a venda após inserção
DROP TRIGGER IF EXISTS trg_processar_pagamento_venda ON public.vendas;
CREATE TRIGGER trg_processar_pagamento_venda
AFTER INSERT ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.processar_pagamento_venda();

-- 6. Limpeza automática de orçamentos expirados (VIA VIEW)
CREATE OR REPLACE VIEW public.orcamentos_ativos AS
SELECT * FROM public.orcamentos
WHERE (validade IS NULL OR validade >= CURRENT_TIMESTAMP)
AND status != 'Cancelado';
