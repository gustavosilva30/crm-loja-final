-- Atualização de Categorias e Financeiro

-- 1. Adicionar campos de dimensões e peso padrão nas categorias
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS largura_padrao DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS altura_padrao DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS comprimento_padrao DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS peso_padrao DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Tabela de Categorias para Contas a Pagar (Financeiro)
CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Inserir algumas categorias financeiras padrão se não existirem
INSERT INTO public.financeiro_categorias (nome) 
SELECT 'Aluguel' WHERE NOT EXISTS (SELECT 1 FROM public.financeiro_categorias WHERE nome = 'Aluguel');
INSERT INTO public.financeiro_categorias (nome) 
SELECT 'Salários' WHERE NOT EXISTS (SELECT 1 FROM public.financeiro_categorias WHERE nome = 'Salários');
INSERT INTO public.financeiro_categorias (nome) 
SELECT 'Fornecedores' WHERE NOT EXISTS (SELECT 1 FROM public.financeiro_categorias WHERE nome = 'Fornecedores');
INSERT INTO public.financeiro_categorias (nome) 
SELECT 'Impostos' WHERE NOT EXISTS (SELECT 1 FROM public.financeiro_categorias WHERE nome = 'Impostos');
INSERT INTO public.financeiro_categorias (nome) 
SELECT 'Infraestrutura' WHERE NOT EXISTS (SELECT 1 FROM public.financeiro_categorias WHERE nome = 'Infraestrutura');
