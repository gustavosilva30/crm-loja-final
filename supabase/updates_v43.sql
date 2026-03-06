-- Versão 43: Correção de RLS para o Módulo de WhatsApp (Conversas e Mensagens)
-- Objetivo: Garantir que o frontend possa consultar e receber eventos Realtime das tabelas 'conversas' e 'mensagens'.

-- 1. Habilitar RLS (garantia de que esteja ativo, não causa erro se já estiver)
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para Conversas (Permitir tudo para todos - Autenticados e Anon)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on conversas" ON public.conversas;
    CREATE POLICY "Allow all on conversas" ON public.conversas FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

-- 3. Políticas para Mensagens (Permitir tudo para todos - Autenticados e Anon)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all on mensagens" ON public.mensagens;
    CREATE POLICY "Allow all on mensagens" ON public.mensagens FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Recarregar o cache do PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
