-- Versão 12: Melhorias no Controle de Caixa e Integridade
-- Regra: Não permitir lançamentos em DINHEIRO se o caixa do dia estiver fechado

CREATE OR REPLACE FUNCTION public.validar_caixa_aberto()
RETURNS TRIGGER AS $$
DECLARE
    v_status_caixa VARCHAR(50);
BEGIN
    -- Só validamos para lançamentos em DINHEIRO
    IF NEW.forma_pagamento = 'Dinheiro' THEN
        SELECT status INTO v_status_caixa 
        FROM public.caixa_registros 
        WHERE data_registro = CURRENT_DATE;

        IF v_status_caixa IS NULL THEN
            RAISE EXCEPTION 'O caixa de hoje ainda não foi aberto. Abra o caixa antes de realizar movimentações em dinheiro.';
        END IF;

        IF v_status_caixa = 'Fechado' THEN
            RAISE EXCEPTION 'O caixa de hoje já foi fechado. Não é possível realizar novas movimentações em dinheiro.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar caixa antes de inserir lançamentos financeiros
DROP TRIGGER IF EXISTS trg_validar_caixa_financeiro ON public.financeiro_lancamentos;
CREATE TRIGGER trg_validar_caixa_financeiro
BEFORE INSERT ON public.financeiro_lancamentos
FOR EACH ROW
EXECUTE FUNCTION public.validar_caixa_aberto();

-- Trigger para validar caixa antes de concluir venda em dinheiro
DROP TRIGGER IF EXISTS trg_validar_caixa_venda ON public.vendas;
CREATE TRIGGER trg_validar_caixa_venda
BEFORE INSERT OR UPDATE ON public.vendas
FOR EACH ROW
WHEN (NEW.status = 'Pago' AND NEW.forma_pagamento = 'Dinheiro')
EXECUTE FUNCTION public.validar_caixa_aberto();

-- Adicionar índice para performance nas buscas por data e forma de pagamento
CREATE INDEX IF NOT EXISTS idx_financeiro_caixa ON public.financeiro_lancamentos (forma_pagamento, created_at);
