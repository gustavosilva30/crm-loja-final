-- 1. Vincular Atendentes ao Auth do Supabase
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='atendentes') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='atendentes' AND column_name='auth_user_id') THEN
            ALTER TABLE public.atendentes ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 2. Vincular Produtos ao Atendente (autor da criação/edição)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produtos' AND column_name='atendente_id') THEN
            ALTER TABLE public.produtos ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id);
        END IF;
    END IF;
END $$;

-- 3. Vincular Lançamentos Financeiros ao Atendente
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financeiro_lancamentos') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_lancamentos' AND column_name='atendente_id') THEN
            ALTER TABLE public.financeiro_lancamentos ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id);
        END IF;
    END IF;
END $$;

-- 4. Vincular Caixa ao Atendente (Quem abriu/fechou)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='caixa_registros') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='caixa_registros' AND column_name='atendente_id') THEN
            ALTER TABLE public.caixa_registros ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id);
        END IF;
    END IF;
END $$;

-- 5. Vincular Mensagens ao Atendente (Quem respondeu no WhatsApp)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mensagens') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mensagens' AND column_name='atendente_id') THEN
            ALTER TABLE public.mensagens ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id);
        END IF;
    END IF;
END $$;

-- 6. Tabela de Carrinho Persistente (Para trava de vendedor e baixa de estoque)
-- Nota: Só cria se a tabela de atendentes e produtos existirem
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='atendentes') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos') THEN
        
        CREATE TABLE IF NOT EXISTS public.carrinho_itens (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            atendente_id UUID REFERENCES public.atendentes(id) ON DELETE CASCADE,
            produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
            quantidade INTEGER NOT NULL DEFAULT 1,
            preco_unitario NUMERIC(10,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(atendente_id, produto_id)
        );

        -- Habilitar Realtime para o carrinho
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'carrinho_itens') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.carrinho_itens;
        END IF;
    END IF;
END $$;

-- 7. Função/Trigger para Baixa Automática de Estoque ao Adicionar no Carrinho
-- ATENÇÃO: Se remover do carrinho ou cancelar, o estoque deve voltar.
CREATE OR REPLACE FUNCTION public.fn_carrinho_baixa_estoque()
RETURNS TRIGGER AS $$
BEGIN
    -- Só executa se as tabelas relacionadas existirem (garantia extra)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos') THEN
        -- Se inseriu no carrinho
        IF (TG_OP = 'INSERT') THEN
            UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
        -- Se atualizou a quantidade
        ELSIF (TG_OP = 'UPDATE') THEN
            UPDATE public.produtos SET estoque_atual = estoque_atual - (NEW.quantidade - OLD.quantidade) WHERE id = NEW.produto_id;
        -- Se removeu do carrinho
        ELSIF (TG_OP = 'DELETE') THEN
            UPDATE public.produtos SET estoque_atual = estoque_atual + OLD.quantidade WHERE id = OLD.produto_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criação Segura da Trigger
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='carrinho_itens') THEN
        DROP TRIGGER IF EXISTS trg_carrinho_estoque ON public.carrinho_itens;
        CREATE TRIGGER trg_carrinho_estoque
        AFTER INSERT OR UPDATE OR DELETE ON public.carrinho_itens
        FOR EACH ROW EXECUTE FUNCTION public.fn_carrinho_baixa_estoque();
    END IF;
END $$;

-- 8. Adicionar coluna atendente_id na tabela vendas (caso não exista)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendas') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendas' AND column_name='atendente_id') THEN
            ALTER TABLE public.vendas ADD COLUMN atendente_id UUID REFERENCES public.atendentes(id);
        END IF;
    END IF;
END $$;

-- 9. Ajustar numeração de pedidos para começar em 1000
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'vendas_numero_seq') THEN
        -- Se o valor atual for menor que 1000, pula para 1000
        IF (SELECT nextval('public.vendas_numero_seq') < 1000) THEN
            PERFORM setval('public.vendas_numero_seq', 1000, false);
        END IF;
    END IF;
END $$;

-- 10. Tabela de Armazenamento de Notas Fiscais (NF-e)
CREATE TABLE IF NOT EXISTS public.nfe_documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chave_acesso VARCHAR(100) UNIQUE,
    numero_nota VARCHAR(50),
    data_emissao TIMESTAMP WITH TIME ZONE,
    valor_total NUMERIC(10,2),
    xml_content TEXT,
    tipo VARCHAR(20) DEFAULT 'Entrada', -- Entrada ou Saida
    atendente_id UUID REFERENCES public.atendentes(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Sistema de Localização Hierárquica (WMS)
CREATE TABLE IF NOT EXISTS public.localizacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    sigla VARCHAR(20),
    descricao TEXT,
    parent_id UUID REFERENCES public.localizacoes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vincular produtos à nova tabela de localização
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produtos' AND column_name='localizacao_id') THEN
            ALTER TABLE public.produtos ADD COLUMN localizacao_id UUID REFERENCES public.localizacoes(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
