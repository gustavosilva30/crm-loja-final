-- Versão 16: Módulo Fiscal (NFe/NFce)
-- Criação da estrutura para armazenamento e gestão de notas fiscais.

-- 1. Tabela de Notas Fiscais
CREATE TABLE IF NOT EXISTS public.fiscal_notas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    numero_nota TEXT,
    serie TEXT,
    chave_acesso TEXT UNIQUE,
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Emitida', 'Cancelada', 'Erro')),
    tipo TEXT DEFAULT 'NFe' CHECK (tipo IN ('NFe', 'NFce')),
    valor_total DECIMAL(10,2),
    url_xml TEXT,
    url_pdf TEXT,
    mensagem_status TEXT,
    ambiente TEXT DEFAULT 'Homologação'
);

-- 2. Habilitar RLS
ALTER TABLE public.fiscal_notas ENABLE ROW LEVEL SECURITY;

-- 3. Políticas simples (Acesso total para autenticados por enquanto)
CREATE POLICY "Permitir tudo para usuários autenticados" 
ON public.fiscal_notas FOR ALL 
TO authenticated 
USING (true);

-- 4. Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_fiscal_venda_id ON public.fiscal_notas(venda_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_status ON public.fiscal_notas(status);
