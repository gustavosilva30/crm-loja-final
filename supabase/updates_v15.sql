-- Versão 15: Autenticação e Permissões Granulares
-- Vincula a tabela de atendentes ao Supabase Auth e adiciona controle de acesso.

-- 1. Adicionar colunas de auth e permissões na tabela de atendentes
ALTER TABLE public.atendentes 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS perm_vendas BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS perm_produtos BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS perm_financeiro BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS perm_fiscal BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS perm_caixa BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS perm_config BOOLEAN DEFAULT false;

-- 2. Função para buscar perfil do usuário logado (Helper)
CREATE OR REPLACE FUNCTION public.get_meu_perfil()
RETURNS SETOF public.atendentes AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM public.atendentes 
    WHERE auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Como o Supabase Auth gerencia a tabela auth.users, 
-- o administrador deve cadastrar o email no atendente via sistema 
-- e o usuário deve se cadastrar/confirmar email via Supabase Auth.
