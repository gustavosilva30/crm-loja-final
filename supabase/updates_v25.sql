-- Versão 25: Automação Total de Estoque para Vendas
-- Garante que o estoque seja baixado no momento da criação/alteração de itens de venda, independente do status.
-- Também sincroniza com a lógica de cancelamento e exclusão da Versão 24.

-- 1. Cria a função de trigger para Itens de Venda
CREATE OR REPLACE FUNCTION public.gerenciar_estoque_venda_item()
RETURNS TRIGGER AS $$
DECLARE
    v_status_venda TEXT;
BEGIN
    -- Busca o status da venda pai
    SELECT status INTO v_status_venda FROM public.vendas WHERE id = COALESCE(NEW.venda_id, OLD.venda_id);

    -- Operação: INSERIR
    IF TG_OP = 'INSERT' THEN
        -- Só baixa estoque se a venda NÃO for 'Cancelado' (vendas novas geralmente não são criadas como cancelado)
        IF v_status_venda != 'Cancelado' THEN
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual - NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
        RETURN NEW;

    -- Operação: ATUALIZAR
    ELSIF TG_OP = 'UPDATE' THEN
        -- Se a venda estiver cancelada, não alteramos o estoque (já foi devolvido pelo trigger de cancelamento ou não foi baixado)
        IF v_status_venda = 'Cancelado' THEN
            RETURN NEW;
        END IF;

        -- Se mudou o produto
        IF NEW.produto_id != OLD.produto_id THEN
            -- Devolve o antigo
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual + OLD.quantidade
            WHERE id = OLD.produto_id;
            -- Baixa o novo
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual - NEW.quantidade
            WHERE id = NEW.produto_id;
        -- Se mudou apenas a quantidade
        ELSIF NEW.quantidade != OLD.quantidade THEN
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual + OLD.quantidade - NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
        RETURN NEW;

    -- Operação: EXCLUIR
    ELSIF TG_OP = 'DELETE' THEN
        -- Só devolve estoque se a venda NÃO for 'Cancelado' (pois se for cancelado, o estoque já foi devolvido no cancelamento)
        -- E se a venda ainda existir (se foi deletada, o trigger da venda pode ter agido ou agirá)
        IF v_status_venda != 'Cancelado' THEN
             UPDATE public.produtos 
             SET estoque_atual = estoque_atual + OLD.quantidade
             WHERE id = OLD.produto_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 2. Aplica o Trigger em public.vendas_itens
DROP TRIGGER IF EXISTS trg_gerenciar_estoque_venda_item ON public.vendas_itens;
CREATE TRIGGER trg_gerenciar_estoque_venda_item
AFTER INSERT OR UPDATE OR DELETE ON public.vendas_itens
FOR EACH ROW EXECUTE FUNCTION public.gerenciar_estoque_venda_item();

-- 3. Atualiza a Função Universal de Reversão (vendas) para evitar duplicidade no DELETE
-- Mas mantém a lógica de CANCELAMENTO (que atua em lote sobre todos os itens)
CREATE OR REPLACE FUNCTION public.reverter_impactos_venda()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_venda_id UUID;
    v_total_pago DECIMAL;
    v_forma_pagamento TEXT;
    v_cliente_id UUID;
BEGIN
    -- Define as variáveis
    IF TG_OP = 'DELETE' THEN
        v_venda_id := OLD.id;
        v_total_pago := COALESCE(OLD.total_pago, 0); -- total_pago se existir
        v_forma_pagamento := OLD.forma_pagamento;
        v_cliente_id := OLD.cliente_id;
        
        -- NO DELETE: Não precisamos mais do loop de estoque aqui
        -- porque o trigger trg_gerenciar_estoque_venda_item nas linhas (vendas_itens)
        -- via cascade vai fazer o trabalho para cada item.
        
    ELSE
        -- No UPDATE:
        IF NEW.status = 'Cancelado' AND OLD.status != 'Cancelado' THEN
            v_venda_id := NEW.id;
            v_total_pago := COALESCE(NEW.total_pago, 0);
            v_forma_pagamento := NEW.forma_pagamento;
            v_cliente_id := NEW.cliente_id;

            -- A. Devolver estoque (Aqui sim precisa ser em lote, pois os itens não são deletados)
            FOR v_item IN SELECT produto_id, quantidade FROM public.vendas_itens WHERE venda_id = v_venda_id LOOP
                UPDATE public.produtos 
                SET estoque_atual = estoque_atual + v_item.quantidade
                WHERE id = v_item.produto_id;
            END LOOP;

        ELSIF OLD.status = 'Cancelado' AND NEW.status != 'Cancelado' THEN
            -- REABERTURA: Venda volta a ser ativa -> Baixar estoque novamente
            FOR v_item IN SELECT produto_id, quantidade FROM public.vendas_itens WHERE venda_id = NEW.id LOOP
                UPDATE public.produtos 
                SET estoque_atual = estoque_atual - v_item.quantidade
                WHERE id = v_item.produto_id;
            END LOOP;
            
            RETURN NEW; -- Continua para financeiro se necessário
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- B. Reverter Financeiro (Lançamentos de Despesa/Estorno)
    -- Manter lógica existente da v24
    IF v_total_pago > 0 THEN
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

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
