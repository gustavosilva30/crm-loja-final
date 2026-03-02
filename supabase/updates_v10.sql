-- Atualização para descontar estoque ao criar orçamento e gerar o status "em orçamento"

-- 1. Cria a coluna que armazena a quantidade presa em orçamentos para um produto
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS quantidade_orcamento INTEGER DEFAULT 0;

-- 2. Cria a função de trigger para itens de orçamento
CREATE OR REPLACE FUNCTION public.atualizar_estoque_orcamento()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.produtos 
        SET estoque_atual = estoque_atual - NEW.quantidade,
            quantidade_orcamento = quantidade_orcamento + NEW.quantidade
        WHERE id = NEW.produto_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.quantidade != OLD.quantidade THEN
            UPDATE public.produtos 
            SET estoque_atual = estoque_atual + OLD.quantidade - NEW.quantidade,
                quantidade_orcamento = quantidade_orcamento - OLD.quantidade + NEW.quantidade
            WHERE id = NEW.produto_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.produtos 
        SET estoque_atual = estoque_atual + OLD.quantidade,
            quantidade_orcamento = quantidade_orcamento - OLD.quantidade
        WHERE id = OLD.produto_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Aplica a Trigger
DROP TRIGGER IF EXISTS trg_orcamento_item_estoque ON public.orcamentos_itens;
CREATE TRIGGER trg_orcamento_item_estoque
AFTER INSERT OR UPDATE OR DELETE ON public.orcamentos_itens
FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_orcamento();
