-- Versão 31: Adiciona campos faltantes na tabela de entregas e garante unicidade por venda
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS cidade VARCHAR(255);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS estado VARCHAR(2);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS cep VARCHAR(20);

-- Garantir que cada venda tenha apenas um registro de entrega (para evitar duplicidade)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'entregas_venda_id_key'
    ) THEN
        ALTER TABLE public.entregas ADD CONSTRAINT entregas_venda_id_key UNIQUE (venda_id);
    END IF;
END $$;
