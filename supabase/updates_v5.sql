-- Atualização para Lembretes por Atendente e Imagens de Produtos

-- 1. Criar Tabela de Atendentes (Staff)
CREATE TABLE IF NOT EXISTS public.atendentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(100), -- 'Vendedor', 'Financeiro', 'Gerente'
    cor_identificacao VARCHAR(20) DEFAULT '#3b82f6', -- Cor para os cards
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vincular Lembretes ao Atendente
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL;

-- 3. Inserir alguns atendentes padrão se não existirem
INSERT INTO public.atendentes (nome, cargo, cor_identificacao) 
SELECT 'Admin Sistema', 'Gerente', '#22c55e' WHERE NOT EXISTS (SELECT 1 FROM public.atendentes WHERE nome = 'Admin Sistema');

-- 4. Adicionar campo de Imagem nos Produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- 5. Atualizar Lembretes existentes para o atendente padrão
UPDATE public.lembretes SET atendente_id = (SELECT id FROM public.atendentes LIMIT 1) WHERE atendente_id IS NULL;
