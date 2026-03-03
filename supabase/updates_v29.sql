-- Renomear coluna sku_ml para meli_id na tabela de produtos
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produtos' AND column_name='sku_ml') THEN
            ALTER TABLE public.produtos RENAME COLUMN sku_ml TO meli_id;
        END IF;
    END IF;
END $$;

-- Atualizar índice se necessário (embora o Postgres renomeie o índice automaticamente em algumas versões, é bom garantir)
DROP INDEX IF EXISTS idx_produtos_sku_ml;
CREATE INDEX IF NOT EXISTS idx_produtos_meli_id ON public.produtos(meli_id);
