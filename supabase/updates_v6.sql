-- Updates v6: SKU automático e outros ajustes de banco

-- 1. Criar uma sequência para o SKU numérico
CREATE SEQUENCE IF NOT EXISTS sku_serial_seq START 1;

-- 2. Função para gerar o SKU automático antes de inserir o produto
CREATE OR REPLACE FUNCTION generate_next_sku()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sku IS NULL OR NEW.sku = '' THEN
        NEW.sku := nextval('sku_serial_seq')::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger para aplicar a função
DROP TRIGGER IF EXISTS trg_generate_sku ON public.produtos;
CREATE TRIGGER trg_generate_sku
BEFORE INSERT ON public.produtos
FOR EACH ROW
EXECUTE FUNCTION generate_next_sku();

-- 4. Ajustar os produtos existentes (opcional, se quiser renumerar tudo)
-- UPDATE public.produtos SET sku = nextval('sku_serial_seq') WHERE sku ~ '^\d+$' OR sku IS NULL;
