-- Versão 44: Suporte a Mídia no WhatsApp
-- Objetivo: Adicionar colunas para armazenamento de URLs de mídia e tipo de arquivo, e preparar o Storage.

-- 1. Adicionar colunas na tabela mensagens
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mensagens') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens' AND column_name='media_url') THEN
            ALTER TABLE public.mensagens ADD COLUMN media_url TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens' AND column_name='media_type') THEN
            ALTER TABLE public.mensagens ADD COLUMN media_type VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens' AND column_name='mime_type') THEN
            ALTER TABLE public.mensagens ADD COLUMN mime_type VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens' AND column_name='file_name') THEN
            ALTER TABLE public.mensagens ADD COLUMN file_name VARCHAR(255);
        END IF;
    END IF;
END $$;

-- 2. Configurar Bucket no Supabase Storage para mídias do WhatsApp
-- Insert the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('whatsapp_media', 'whatsapp_media', true, false, 52428800, null)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de RLS para o Bucket do Storage
-- Permitir leitura pública (já que o bucket é público, mas vamos garantir via RLS)
DO $$ 
BEGIN 
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp_media');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Permitir Inserção para todos (autenticados ou servicos de backend)
DO $$ 
BEGIN 
    DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
    CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'whatsapp_media');
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Recarregar schema da API
NOTIFY pgrst, 'reload schema';
