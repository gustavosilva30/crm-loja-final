-- Adiciona o vínculo de vendedor à tabela de clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.atendentes(id);

-- Comentário para documentação
COMMENT ON COLUMN public.clientes.vendedor_id IS 'ID do vendedor (atendente) responsável pela carteira deste cliente';

-- Índice para performance em filtros de carteira
CREATE INDEX IF NOT EXISTS idx_clientes_vendedor_id ON public.clientes(vendedor_id);

-- Opcional: Se quiser garantir que clientes sem vendedor possam ser vistos por todos, ou definir um comportamento padrão.
-- Por agora, vamos apenas permitir o vínculo.
