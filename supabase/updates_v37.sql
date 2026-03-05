-- ================================================================
-- Updates v37 — Sistema de Indicações
-- Execute no Supabase: Dashboard > SQL Editor
-- ================================================================

-- 1. Coluna indicador na tabela vendas
ALTER TABLE vendas
ADD COLUMN IF NOT EXISTS indicador_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_indicador ON vendas(indicador_id);

-- 2. Tabela principal de indicações
CREATE TABLE IF NOT EXISTS indicacoes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    indicador_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    indicado_id     UUID REFERENCES clientes(id) ON DELETE SET NULL,
    venda_id        UUID REFERENCES vendas(id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'Pendente', -- Pendente, Confirmada, Cancelada
    valor_venda     DECIMAL(10,2) DEFAULT 0,
    recompensa_tipo VARCHAR(20) DEFAULT 'credito',           -- credito | percentual
    recompensa_valor DECIMAL(10,2) DEFAULT 0,
    recompensa_liberada BOOLEAN DEFAULT FALSE,
    observacoes     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON indicacoes(indicador_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado  ON indicacoes(indicado_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status    ON indicacoes(status);
CREATE INDEX IF NOT EXISTS idx_indicacoes_venda     ON indicacoes(venda_id);

-- 3. Configurações do sistema de indicações na tabela da empresa
ALTER TABLE configuracoes_empresa
ADD COLUMN IF NOT EXISTS indicacao_ativa                  BOOLEAN        DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS indicacao_tipo_beneficio         VARCHAR(20)    DEFAULT 'credito',
ADD COLUMN IF NOT EXISTS indicacao_valor_fixo             DECIMAL(10,2)  DEFAULT 20.00,
ADD COLUMN IF NOT EXISTS indicacao_percentual             DECIMAL(5,2)   DEFAULT 0,
ADD COLUMN IF NOT EXISTS indicacao_valor_minimo_venda     DECIMAL(10,2)  DEFAULT 0;

-- 4. RLS
ALTER TABLE indicacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "indicacoes_all" ON indicacoes;
CREATE POLICY "indicacoes_all" ON indicacoes FOR ALL USING (true) WITH CHECK (true);
