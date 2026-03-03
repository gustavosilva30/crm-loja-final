-- Versão 32: Criação da tabela mercadolivre_accounts para suporte multi-conta

CREATE TABLE IF NOT EXISTS public.mercadolivre_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_user_id uuid NOT NULL,
    ml_user_id bigint NOT NULL,
    ml_nickname text,
    ml_site_id text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expires_at timestamptz NOT NULL,
    scope text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(system_user_id, ml_user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ml_accounts_system_user_id ON public.mercadolivre_accounts(system_user_id);
CREATE INDEX IF NOT EXISTS idx_ml_accounts_ml_user_id ON public.mercadolivre_accounts(ml_user_id);

-- Comentários para documentação
COMMENT ON TABLE public.mercadolivre_accounts IS 'Armazena as contas conectadas do Mercado Livre para múltiplos usuários do sistema.';
