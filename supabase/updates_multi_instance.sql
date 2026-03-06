-- Migration Script: Multi-Instance WhatsApp Architecture

-- 1. Tabela: whatsapp_instancias
CREATE TABLE IF NOT EXISTS public.whatsapp_instancias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL UNIQUE,
    instance_name TEXT UNIQUE NOT NULL,
    numero_whatsapp TEXT,
    status_conexao TEXT DEFAULT 'close',
    ativo BOOLEAN DEFAULT true,
    ultima_conexao_em TIMESTAMPTZ,
    ultima_desconexao_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Alteração na tabela: conversas
ALTER TABLE public.conversas
    ADD COLUMN IF NOT EXISTS instancia_id UUID REFERENCES public.whatsapp_instancias(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS legacy BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS ultima_mensagem TEXT,
    ADD COLUMN IF NOT EXISTS ultima_mensagem_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS nao_lidas_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Alteração na tabela: mensagens
ALTER TABLE public.mensagens
    ADD COLUMN IF NOT EXISTS instancia_id UUID REFERENCES public.whatsapp_instancias(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS wa_message_id TEXT,
    ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')),
    ADD COLUMN IF NOT EXISTS status_envio TEXT CHECK (status_envio IN ('sending', 'sent', 'error', 'delivered', 'read')),
    ADD COLUMN IF NOT EXISTS payload_json JSONB;

-- Tratamento para evitar erro ao tentar colocar constraint unique em nulos ou duplicados caso já existam (legacy)
-- Vamos criar um índice único onde instancia_id não seja nulo, garantindo unicidade para os novos registros
CREATE UNIQUE INDEX IF NOT EXISTS idx_mensagens_instancia_wa_message_id ON public.mensagens(instancia_id, wa_message_id) WHERE instancia_id IS NOT NULL AND wa_message_id IS NOT NULL;

-- 4. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_conversas_instancia ON public.conversas(instancia_id);
CREATE INDEX IF NOT EXISTS idx_conversas_atendente ON public.conversas(atendente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_instancia ON public.mensagens(instancia_id);
CREATE INDEX IF NOT EXISTS idx_instancias_atendente ON public.whatsapp_instancias(atendente_id);

-- 5. Tratamento de Dados Legados (Legacy)
-- Marca as conversas antigas (que não têm instancia_id) como legadas
UPDATE public.conversas
SET legacy = true
WHERE instancia_id IS NULL AND legacy = false;

-- Opcional: Atualizar a estrutura de mensagens se tiver timestamp pra created_at, se faltar...
-- ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
