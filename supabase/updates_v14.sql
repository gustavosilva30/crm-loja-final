-- Versão 14: Lógica de Cancelamento de Vendas e Estorno
-- Regra: Nenhuma venda pode ser deletada, apenas cancelada.
-- Quando cancelada, estorna estoque e devolve valores (Dinheiro ou Haver).

CREATE OR REPLACE FUNCTION public.processar_cancelamento_venda()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- Se o status mudou para 'Cancelado'
    IF NEW.status = 'Cancelado' AND OLD.status != 'Cancelado' THEN
        
        -- 1. Devolver estoque dos produtos da venda
        FOR v_item IN SELECT produto_id, quantidade FROM public.vendas_itens WHERE venda_id = NEW.id LOOP
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual + v_item.quantidade
            WHERE id = v_item.produto_id;
        END LOOP;

        -- 2. Tratar estorno financeiro
        -- Se foi em DINHEIRO, cria uma DESPESA de estorno no financeiro para o caixa
        IF NEW.forma_pagamento = 'Dinheiro' AND OLD.status = 'Pago' THEN
            INSERT INTO public.financeiro_lancamentos (
                tipo, valor, data_vencimento, data_pagamento, status, 
                venda_id, descricao, forma_pagamento, categoria_financeira
            ) VALUES (
                'Despesa', NEW.total, CURRENT_DATE, CURRENT_DATE, 'Pago', 
                NEW.id, 'ESTORNO: Venda Cancelada #' || SUBSTR(NEW.id::text, 1, 8), 
                'Dinheiro', 'Estorno'
            );
        END IF;

        -- 3. Devolver saldo de HAVER ao cliente (se aplicável)
        IF NEW.forma_pagamento = 'Haver Cliente' AND NEW.cliente_id IS NOT NULL THEN
            UPDATE public.clientes 
            SET saldo_haver = saldo_haver + NEW.total 
            WHERE id = NEW.cliente_id;

            -- Registrar no financeiro o cancelamento do haver
            INSERT INTO public.financeiro_lancamentos (
                tipo, valor, data_vencimento, data_pagamento, status, 
                venda_id, descricao, forma_pagamento, categoria_financeira
            ) VALUES (
                'Despesa', NEW.total, CURRENT_DATE, CURRENT_DATE, 'Pago', 
                NEW.id, 'CRÉDITO DEVOLVIDO: Cancelamento #' || SUBSTR(NEW.id::text, 1, 8), 
                'Haver Cliente', 'Estorno'
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar cancelamento após o update na venda
DROP TRIGGER IF EXISTS trg_cancelamento_venda ON public.vendas;
CREATE TRIGGER trg_cancelamento_venda
AFTER UPDATE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.processar_cancelamento_venda();

-- Regra de Segurança: Bloquear DELETE na tabela de vendas
CREATE OR REPLACE FUNCTION public.impedir_exclusao_venda()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Não é permitido excluir vendas. Altere o status para Cancelado para estornar os valores.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_delete_venda ON public.vendas;
CREATE TRIGGER trg_bloquear_delete_venda
BEFORE DELETE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.impedir_exclusao_venda();
