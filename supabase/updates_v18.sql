-- Versão 18: Numeração sequencial de pedidos
-- Adiciona número de pedido sequencial formatado (000001, 000002...)

-- Criar sequência para os números de pedido
CREATE SEQUENCE IF NOT EXISTS public.vendas_numero_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Adicionar coluna de número de pedido
ALTER TABLE public.vendas 
    ADD COLUMN IF NOT EXISTS numero_pedido INTEGER;

-- Atualizar pedidos existentes com números sequenciais (ordenados por data de criação)
DO $$
DECLARE
    v RECORD;
    seq_num INTEGER := 1;
BEGIN
    FOR v IN SELECT id FROM public.vendas ORDER BY created_at ASC LOOP
        IF (SELECT numero_pedido FROM public.vendas WHERE id = v.id) IS NULL THEN
            UPDATE public.vendas SET numero_pedido = seq_num WHERE id = v.id;
            seq_num := seq_num + 1;
        END IF;
    END LOOP;
    -- Atualizar o valor da sequência para continuar do próximo
    PERFORM setval('public.vendas_numero_seq', COALESCE((SELECT MAX(numero_pedido) FROM public.vendas), 0) + 1, false);
END $$;

-- Criar função para auto-incrementar o número do pedido
CREATE OR REPLACE FUNCTION public.set_numero_pedido()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_pedido IS NULL THEN
        NEW.numero_pedido := nextval('public.vendas_numero_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que chama a função antes de inserir
DROP TRIGGER IF EXISTS trigger_set_numero_pedido ON public.vendas;
CREATE TRIGGER trigger_set_numero_pedido
    BEFORE INSERT ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.set_numero_pedido();

-- Adicionar campo status_pagamento à tabela de entregas (se não existir)
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'A Receber';
