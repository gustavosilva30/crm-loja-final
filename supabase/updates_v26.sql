-- Adicionando novos campos à tabela de produtos para cadastro completo
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS imobilizado BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS item_seguranca BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rastreavel BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS codigo_etiqueta TEXT,
ADD COLUMN IF NOT EXISTS part_number TEXT,
ADD COLUMN IF NOT EXISTS localizacao TEXT,
ADD COLUMN IF NOT EXISTS marca TEXT,
ADD COLUMN IF NOT EXISTS modelo TEXT,
ADD COLUMN IF NOT EXISTS ano INTEGER,
ADD COLUMN IF NOT EXISTS versao TEXT,
ADD COLUMN IF NOT EXISTS cst TEXT,
ADD COLUMN IF NOT EXISTS cfop TEXT,
ADD COLUMN IF NOT EXISTS adicional_venda_percentual NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unidade_medida TEXT DEFAULT 'UN',
ADD COLUMN IF NOT EXISTS ncm TEXT,
ADD COLUMN IF NOT EXISTS cest TEXT,
ADD COLUMN IF NOT EXISTS outros_custos NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS qualidade TEXT,
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
ADD COLUMN IF NOT EXISTS peso_g NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS altura_cm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS largura_cm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS comprimento_cm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

-- Criando a tabela de compatibilidade de modelos
CREATE TABLE IF NOT EXISTS public.produtos_compatibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    ano TEXT,
    versao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitando RLS para a nova tabela
ALTER TABLE public.produtos_compatibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users on compatibilidade" 
ON public.produtos_compatibilidade FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
