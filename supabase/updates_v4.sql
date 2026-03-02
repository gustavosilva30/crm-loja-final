-- Atualização de Clientes (Limite de Crédito) e Novo Módulo de Lembretes

-- 1. Adicionar Limite de Crédito para Boleto na tabela de Clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS limite_credito DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Criar Tabela de Lembretes / Tarefas Inteligentes
CREATE TABLE IF NOT EXISTS public.lembretes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_lembrete TIMESTAMP WITH TIME ZONE NOT NULL,
    prioridade VARCHAR(20) DEFAULT 'Média', -- 'Baixa', 'Média', 'Alta', 'Urgente'
    status VARCHAR(20) DEFAULT 'Pendente', -- 'Pendente', 'Concluído', 'Cancelado'
    categoria VARCHAR(50), -- 'Vendas', 'Financeiro', 'Geral', 'Follow-up'
    vincular_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    vincular_venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
    vincular_orcamento_id UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Inserir alguns lembretes de exemplo para teste
INSERT INTO public.lembretes (titulo, descricao, data_lembrete, prioridade, categoria) 
VALUES 
('Cobrança Boleto Vencido', 'Verificar com financeiro recebimento da NF-203', NOW() + INTERVAL '1 day', 'Alta', 'Financeiro'),
('Follow-up Orçamento #82', 'Ligar para o cliente para fechamento da venda', NOW() + INTERVAL '2 hours', 'Urgente', 'Vendas');
