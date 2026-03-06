-- Adicionar coluna de valor estimado para o funil
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS valor_estimado DECIMAL(10,2) DEFAULT 0.00;

-- Adicionar coluna de comentário/nota interna para o funil
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS nota_interna TEXT;

-- Garantir que etapa_funil tenha um padrão se estiver nulo
UPDATE conversas SET etapa_funil = 'Novo Lead' WHERE etapa_funil IS NULL;
