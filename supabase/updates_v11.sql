-- Criação da Tabela de Controle de Caixa (Abertura e Fechamento)
CREATE TABLE IF NOT EXISTS public.caixa_registros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_registro DATE NOT NULL UNIQUE,
    valor_abertura DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    valor_fechamento DECIMAL(10, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'Aberto',
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
