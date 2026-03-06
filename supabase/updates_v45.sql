-- Versão 45: Sistema de Contatos e Melhorias na Tabela de Conversas
-- Objetivo: Permitir criar contatos manualmente e vincular metadados às conversas.

-- 1. Tabela de Contatos (para salvar nomes/telefones antes do primeiro contato)
CREATE TABLE IF NOT EXISTS public.contatos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    foto_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Garantir que conversas tenha metadata ou vincule a contatos se necessário
-- (Por enquanto usaremos a busca por telefone para unificar)

-- 3. Habilitar RLS para contatos
ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on contatos" ON public.contatos;
    CREATE POLICY "Allow all on contatos" ON public.contatos FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

-- 4. Habilitar Realtime para contatos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contatos') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contatos;
    END IF;
END $$;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
