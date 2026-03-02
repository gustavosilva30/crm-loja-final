-- Updates v8: Campos de Razão Social e Inscrição Estadual

-- Adicionando em clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50);

-- Adicionando em fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50);

-- Adicionando em transportadoras
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255);
ALTER TABLE public.transportadoras ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(50);
