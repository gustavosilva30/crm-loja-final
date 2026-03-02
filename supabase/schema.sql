-- Passo 1: Esquema do Banco de Dados Supabase (PostgreSQL)

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enumerações (Criação Segura - DO blocks para evitar erro 42710)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Vendedor', 'Operador_Estoque');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_movimentacao AS ENUM ('Entrada', 'Saida', 'Ajuste');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_venda AS ENUM ('Pendente', 'Pago', 'Enviado', 'Entregue', 'Cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_financeiro AS ENUM ('Pendente', 'Pago', 'Atrasado', 'Cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_lancamento AS ENUM ('Receita', 'Despesa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Usuários (Estendendo o auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'Vendedor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    sku_ml VARCHAR(100) UNIQUE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    estoque_atual INTEGER NOT NULL DEFAULT 0,
    estoque_minimo INTEGER NOT NULL DEFAULT 5,
    custo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    preco DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS public.estoque_movimentacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    tipo tipo_movimentacao NOT NULL,
    quantidade INTEGER NOT NULL,
    observacao TEXT,
    usuario_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    documento VARCHAR(50) UNIQUE, -- CPF/CNPJ
    email VARCHAR(255),
    telefone VARCHAR(50),
    endereco TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    documento VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    telefone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Transportadoras
CREATE TABLE IF NOT EXISTS public.transportadoras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    api_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Vendas
CREATE TABLE IF NOT EXISTS public.vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status status_venda NOT NULL DEFAULT 'Pendente',
    origem_ml BOOLEAN DEFAULT FALSE,
    ml_order_id VARCHAR(100) UNIQUE,
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Itens da Venda
CREATE TABLE IF NOT EXISTS public.vendas_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Tabela de Orçamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    validade TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'Aberto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Itens do Orçamento
CREATE TABLE IF NOT EXISTS public.orcamentos_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Tabela Financeiro (Lançamentos)
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo tipo_lancamento NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    categoria_financeira VARCHAR(100),
    status status_financeiro NOT NULL DEFAULT 'Pendente',
    venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE,
    fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Integrações Mercado Livre
CREATE TABLE IF NOT EXISTS public.ml_integracoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_in INTEGER,
    ml_user_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Ativo',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Entregas
CREATE TABLE IF NOT EXISTS public.entregas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    transportadora_id UUID REFERENCES public.transportadoras(id) ON DELETE SET NULL,
    codigo_rastreio VARCHAR(100),
    status VARCHAR(100) DEFAULT 'Preparando',
    data_envio TIMESTAMP WITH TIME ZONE,
    data_entrega TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance (Criação Segura)
DROP INDEX IF EXISTS idx_produtos_sku;
CREATE INDEX idx_produtos_sku ON public.produtos(sku);

DROP INDEX IF EXISTS idx_produtos_sku_ml;
CREATE INDEX idx_produtos_sku_ml ON public.produtos(sku_ml);

DROP INDEX IF EXISTS idx_vendas_cliente;
CREATE INDEX idx_vendas_cliente ON public.vendas(cliente_id);

DROP INDEX IF EXISTS idx_financeiro_vencimento;
CREATE INDEX idx_financeiro_vencimento ON public.financeiro_lancamentos(data_vencimento);

DROP INDEX IF EXISTS idx_financeiro_status;
CREATE INDEX idx_financeiro_status ON public.financeiro_lancamentos(status);
