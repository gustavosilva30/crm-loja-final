-- =============================================================================
-- updates_v36.sql — Melhorias no Módulo Financeiro
-- Adiciona: centro_de_custo, recorrencia, recorrencia_meses, is_automatico
-- =============================================================================

-- Centro de custo e recorrência no lançamento financeiro
ALTER TABLE financeiro_lancamentos
    ADD COLUMN IF NOT EXISTS centro_de_custo TEXT,
    ADD COLUMN IF NOT EXISTS recorrencia TEXT DEFAULT 'unica' CHECK (recorrencia IN ('unica', 'mensal', 'semanal', 'quinzenal')),
    ADD COLUMN IF NOT EXISTS recorrencia_meses INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_automatico BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_financeiro_vencimento ON financeiro_lancamentos(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro_lancamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON financeiro_lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_financeiro_centro_custo ON financeiro_lancamentos(centro_de_custo);

-- Tabela de log de auditoria do sistema
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela TEXT NOT NULL,
    registro_id TEXT,
    acao TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    dados_anteriores JSONB,
    dados_novos JSONB,
    atendente_id UUID REFERENCES atendentes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_auth" ON audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de devoluções
CREATE TABLE IF NOT EXISTS devolucoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    motivo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'DEVOLUCAO' CHECK (tipo IN ('DEVOLUCAO', 'TROCA')),
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Concluido', 'Recusado')),
    valor_reembolso NUMERIC(12,2) DEFAULT 0,
    observacoes TEXT,
    atendente_id UUID REFERENCES atendentes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devolucoes_venda_id ON devolucoes(venda_id);
CREATE INDEX IF NOT EXISTS idx_devolucoes_cliente_id ON devolucoes(cliente_id);

ALTER TABLE devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devolucoes_auth" ON devolucoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de metas de vendedores
CREATE TABLE IF NOT EXISTS metas_vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendente_id UUID NOT NULL REFERENCES atendentes(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL,  -- formato: 'YYYY-MM'
    meta_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    comissao_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(atendente_id, mes_ano)
);

ALTER TABLE metas_vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metas_auth" ON metas_vendedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de agendamentos/visitas
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    atendente_id UUID REFERENCES atendentes(id) ON DELETE SET NULL,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ,
    tipo TEXT NOT NULL DEFAULT 'Visita' CHECK (tipo IN ('Visita', 'Reuniao', 'Entrega', 'Suporte', 'Outros')),
    status TEXT NOT NULL DEFAULT 'Agendado' CHECK (status IN ('Agendado', 'Confirmado', 'Realizado', 'Cancelado')),
    notificar_whatsapp BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agendamentos(cliente_id);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agendamentos_auth" ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tags para clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12,2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento DATE;
