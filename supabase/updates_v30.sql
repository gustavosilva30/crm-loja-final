-- Criar função para buscar o próximo SKU sequencial
CREATE OR REPLACE FUNCTION public.get_next_sku()
RETURNS TEXT AS $$
DECLARE
    last_sku INTEGER;
BEGIN
    -- Busca o maior valor numérico de SKU na tabela
    SELECT MAX(CAST(sku AS INTEGER)) INTO last_sku 
    FROM public.produtos 
    WHERE sku ~ '^[0-9]+$'; -- Garante que estamos pegando apenas SKUs puramente numéricos

    -- Se não houver nenhum SKU numérico, começa em 25010
    -- Caso contrário, soma 1 ao maior encontrado (ou inicia em 25010 se o maior for menor que isso)
    IF last_sku IS NULL OR last_sku < 25010 THEN
        RETURN '25010';
    ELSE
        RETURN CAST(last_sku + 1 AS TEXT);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
