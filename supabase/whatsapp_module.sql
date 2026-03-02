-- WhatsApp Module: Conversas e Mensagens
-- Criado em: 2026-03-02

-- 1. Garante extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Conversas
CREATE TABLE IF NOT EXISTS public.conversas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_nome VARCHAR(255),
    telefone VARCHAR(50) UNIQUE NOT NULL,
    status_aberto BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Caso a tabela já exista mas falte a coluna telefone (robustez para o erro relatado)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='conversas' AND column_name='telefone') THEN
        ALTER TABLE public.conversas ADD COLUMN telefone VARCHAR(50) UNIQUE NOT NULL;
    END IF;
END $$;

-- 3. Tabela de Mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversa_id UUID REFERENCES public.conversas(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    tipo_envio VARCHAR(20) CHECK (tipo_envio IN ('sent', 'received')),
    wa_message_id VARCHAR(255), -- ID da mensagem na API da Meta
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Habilitar Realtime para estas tabelas
-- Nota: Se já estiver habilitado, não causa erro
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversas') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens;
    END IF;
END $$;

-- 5. Índices para performance
DROP INDEX IF EXISTS idx_mensagens_conversa_id;
CREATE INDEX idx_mensagens_conversa_id ON public.mensagens(conversa_id);

DROP INDEX IF EXISTS idx_conversas_telefone;
CREATE INDEX idx_conversas_telefone ON public.conversas(telefone);
