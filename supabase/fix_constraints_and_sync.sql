-- 1. CORREÇÃO DA TABELA CLIENTES (Problema das Tags)
ALTER TABLE public.clientes 
  ALTER COLUMN tags TYPE text[] USING tags::text[],
  ALTER COLUMN tags SET DEFAULT '{}';

-- 2. CORREÇÃO DA TABELA PRODUTOS (Imagens)
ALTER TABLE public.produtos 
  ALTER COLUMN imagem_urls TYPE text[] USING imagem_urls::text[],
  ALTER COLUMN imagem_urls SET DEFAULT '{}';

-- 3. CORREÇÃO DA TABELA SUCATAS E PEÇAS
ALTER TABLE public.sucatas 
  ALTER COLUMN fotos TYPE text[] USING fotos::text[],
  ALTER COLUMN fotos SET DEFAULT '{}';

ALTER TABLE public.sucatas_pecas 
  ALTER COLUMN fotos TYPE text[] USING fotos::text[],
  ALTER COLUMN fotos SET DEFAULT '{}';

-- 4. RESOLUÇÃO DAS FOTOS DOS CONTATOS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='contatos' AND COLUMN_NAME='foto_url') THEN
        ALTER TABLE public.contatos ADD COLUMN foto_url text;
    END IF;
END $$;
