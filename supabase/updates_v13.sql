-- Versão 13: Sincronização de Estoque entre Orçamentos e Vendas
-- Quando um orçamento é marcado como 'Aprovado' ou 'Cancelado', libera a reserva de estoque

CREATE OR REPLACE FUNCTION public.limpar_reserva_orcamento()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o status mudou para algo que não seja 'Aberto', liberamos o estoque reservado
    IF (NEW.status = 'Aprovado' OR NEW.status = 'Cancelado') AND OLD.status = 'Aberto' THEN
        -- Para cada item desse orçamento, voltamos a quantidade de reserva para zero
        -- Nota: O estoque_atual NÃO volta, pois o trigger de orcamentos_itens já o subtraiu.
        -- Se for cancelado, o estoque_atual deve voltar.
        -- Se for aprovado, o estoque_atual permanece subtraído (será definitivamente subtraído pela venda).
        
        IF NEW.status = 'Cancelado' THEN
            UPDATE public.produtos p
            SET estoque_atual = estoque_atual + i.quantidade,
                quantidade_orcamento = quantidade_orcamento - i.quantidade
            FROM public.orcamentos_itens i
            WHERE i.produto_id = p.id AND i.orcamento_id = NEW.id;
        ELSIF NEW.status = 'Aprovado' THEN
            UPDATE public.produtos p
            SET quantidade_orcamento = quantidade_orcamento - i.quantidade
            FROM public.orcamentos_itens i
            WHERE i.produto_id = p.id AND i.orcamento_id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limpar_reserva_orcamento ON public.orcamentos;
CREATE TRIGGER trg_limpar_reserva_orcamento
AFTER UPDATE ON public.orcamentos
FOR EACH ROW
EXECUTE FUNCTION public.limpar_reserva_orcamento();
