-- Versão 22: Setup de Storage para Imagens de Produtos

-- 1. Garante que a coluna imagem_url existe (caso não tenha sido criada antes)
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- 2. Criar bucket de storage para produtos se não existir
-- Nota: Supabase storage usa o esquema 'storage'
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Acesso para o Bucket (Permitir leitura pública e escrita autenticada)
-- Remover políticas existentes para evitar erro de duplicata ao rodar novamente
DROP POLICY IF EXISTS "Produtos - Leitura Pública" ON storage.objects;
DROP POLICY IF EXISTS "Produtos - Upload Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Produtos - Update Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Produtos - Delete Autenticado" ON storage.objects;

-- Criar novas políticas
CREATE POLICY "Produtos - Leitura Pública"
ON storage.objects FOR SELECT
USING (bucket_id = 'produtos');

CREATE POLICY "Produtos - Upload Autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'produtos');

CREATE POLICY "Produtos - Update Autenticado"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'produtos');

CREATE POLICY "Produtos - Delete Autenticado"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'produtos');
