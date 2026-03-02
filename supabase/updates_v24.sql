-- Versão 24: Lógica Universal de Estorno (Cancelamento e Exclusão)
-- Permite exclusão de vendas e garante que estoque/financeiro sejam revertidos.

-- 1. Remove restrição de exclusão anterior
DROP TRIGGER IF EXISTS trg_bloquear_delete_venda ON public.vendas;

-- 2. Função Universal de Reversão
CREATE OR REPLACE FUNCTION public.reverter_impactos_venda()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_venda_id UUID;
    v_total_pago DECIMAL;
    v_forma_pagamento TEXT;
    v_cliente_id UUID;
BEGIN
    -- Define as variáveis dependendo se é DELETE ou UPDATE
    IF TG_OP = 'DELETE' THEN
        v_venda_id := OLD.id;
        v_total_pago := OLD.total_pago;
        v_forma_pagamento := OLD.forma_pagamento;
        v_cliente_id := OLD.cliente_id;
    ELSE
        -- No UPDATE, só executa se o status mudar para 'Cancelado'
        IF NEW.status = 'Cancelado' AND OLD.status != 'Cancelado' THEN
            v_venda_id := NEW.id;
            v_total_pago := NEW.total_pago;
            v_forma_pagamento := NEW.forma_pagamento;
            v_cliente_id := NEW.cliente_id;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- A. Devolver estoque dos produtos
    FOR v_item IN SELECT produto_id, quantidade FROM public.vendas_itens WHERE venda_id = v_venda_id LOOP
        UPDATE public.produtos 
        SET estoque_atual = estoque_atual + v_item.quantidade
        WHERE id = v_item.produto_id;
    END LOOP;

    -- B. Reverter Financeiro se houver valor pago
    IF v_total_pago > 0 THEN
        -- Se foi em DINHEIRO ou PIX/CARTÃO (que gera lançamento), cria estorno
        IF v_forma_pagamento != 'Haver Cliente' THEN
            INSERT INTO public.financeiro_lancamentos (
                tipo, valor, data_vencimento, data_pagamento, status, 
                venda_id, descricao, forma_pagamento, categoria_financeira
            ) VALUES (
                'Despesa', v_total_pago, CURRENT_DATE, CURRENT_DATE, 'Pago', 
                v_venda_id, 'ESTORNO: Venda ' || (CASE WHEN TG_OP = 'DELETE' THEN 'Excluída' ELSE 'Cancelada' END) || ' #' || SUBSTR(v_venda_id::text, 1, 8), 
                v_forma_pagamento, 'Estorno'
            );
        END IF;

        -- C. Devolver saldo de HAVER ao cliente (se aplicável)
        IF v_forma_pagamento = 'Haver Cliente' AND v_cliente_id IS NOT NULL THEN
            UPDATE public.clientes 
            SET saldo_haver = saldo_haver + v_total_pago 
            WHERE id = v_cliente_id;

            INSERT INTO public.financeiro_lancamentos (
                tipo, valor, data_vencimento, data_pagamento, status, 
                venda_id, descricao, forma_pagamento, categoria_financeira
            ) VALUES (
                'Despesa', v_total_pago, CURRENT_DATE, CURRENT_DATE, 'Pago', 
                v_venda_id, 'CRÉDITO DEVOLVIDO: ' || (CASE WHEN TG_OP = 'DELETE' THEN 'Excluída' ELSE 'Cancelada' END) || ' #' || SUBSTR(v_venda_id::text, 1, 8), 
                'Haver Cliente', 'Estorno'
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Aplica os Gatilhos
DROP TRIGGER IF EXISTS trg_reversao_venda_update ON public.vendas;
CREATE TRIGGER trg_reversao_venda_update
AFTER UPDATE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.reverter_impactos_venda();

DROP TRIGGER IF EXISTS trg_reversao_venda_delete ON public.vendas;
CREATE TRIGGER trg_reversao_venda_delete
BEFORE DELETE ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.reverter_impactos_venda();
