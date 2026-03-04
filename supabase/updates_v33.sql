-- Versão 33: Suporte a múltiplas imagens para produtos
-- Adiciona a coluna imagem_urls como um array de texto e migra o dado atual

DO $$ 
BEGIN
    -- 1. Adicionar imagem_urls
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produtos' AND column_name='imagem_urls') THEN
        ALTER TABLE public.produtos ADD COLUMN imagem_urls TEXT[] DEFAULT '{}';
    END IF;

    -- 2. Migrar imagem_url (singular) para imagem_urls (array)
    UPDATE public.produtos 
    SET imagem_urls = ARRAY[imagem_url] 
    WHERE imagem_url IS NOT NULL 
    AND (imagem_urls IS NULL OR cardinality(imagem_urls) = 0);

END $$;
