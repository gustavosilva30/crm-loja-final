-- Versão 17: Configurações da Empresa e Dados para Impressão
-- Permite armazenar os dados da empresa para exibição em pedidos, notas e orçamentos.

CREATE TABLE IF NOT EXISTS public.configuracoes_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome_fantasia TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT UNIQUE,
    inscricao_estadual TEXT,
    email TEXT,
    telefone TEXT,
    logradouro TEXT,
    numero TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    cep TEXT,
    logotipo_url TEXT,
    mensagem_rodape TEXT
);

-- Inserir registro inicial com os dados da Dourados Auto Peças
INSERT INTO public.configuracoes_empresa (
    nome_fantasia, 
    razao_social, 
    logradouro, 
    numero, 
    bairro, 
    cidade, 
    estado, 
    telefone,
    mensagem_rodape
)
SELECT 
    'Dourados Auto Peças', 
    'Leandro B Leal Auto Peças Eireli ME', 
    'Av. Marcelino Pires', 
    '5235', 
    'vila Ubiratã', 
    'Dourados', 
    'MS', 
    '(67) 3424-3068 / (67) 9 9910-0220',
    'Obrigado pela preferência!'
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_empresa);

-- Adicionar atendente na venda para registro de quem vendeu
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS atendente_id UUID REFERENCES public.atendentes(id) ON DELETE SET NULL;

-- Adicionar detalhes de endereço na entrega se não existirem
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS endereco_entrega TEXT;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS contato_entrega TEXT;

-- Habilitar RLS
ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.configuracoes_empresa;
CREATE POLICY "Permitir leitura para todos" 
ON public.configuracoes_empresa FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Permitir atualização para administradores" ON public.configuracoes_empresa;
CREATE POLICY "Permitir atualização para administradores" 
ON public.configuracoes_empresa FOR UPDATE 
TO authenticated 
USING (true);
