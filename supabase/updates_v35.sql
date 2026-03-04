-- =============================================================================
-- updates_v35.sql — Módulo de Leilões (ISOLADO)
-- Criação das tabelas auction_sources, auction_lots e auction_logs
-- NÃO modifica tabelas existentes.
-- =============================================================================

-- 1. FONTES DE LEILÃO
-- Representa cada site/plataforma de leilão que o n8n vai monitorar
CREATE TABLE IF NOT EXISTS auction_sources (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT          NOT NULL,
    source_url  TEXT          NOT NULL,
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    notes       TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Trigger para atualizar updated_at automaticamente em auction_sources
CREATE OR REPLACE FUNCTION auction_sources_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_auction_sources_updated_at
    BEFORE UPDATE ON auction_sources
    FOR EACH ROW
    EXECUTE FUNCTION auction_sources_update_timestamp();


-- 2. LOTES DE LEILÃO
-- Cada lote coletado pelo n8n. Deduplica por (source_id, lot_number).
CREATE TABLE IF NOT EXISTS auction_lots (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID          REFERENCES auction_sources(id) ON DELETE SET NULL,
    lot_number      TEXT          NOT NULL,
    lot_name        TEXT          NOT NULL,
    city            TEXT,
    auction_start_at TIMESTAMPTZ,
    auction_end_at  TIMESTAMPTZ,
    lot_url         TEXT          NOT NULL,
    scrap_type      TEXT          NOT NULL CHECK (scrap_type IN ('aproveitavel', 'inservivel')),
    external_hash   TEXT,         -- hash opcional para controle de versão/atualização
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    -- Evita duplicidade de lotes por fonte + número do lote
    CONSTRAINT auction_lots_source_lot_unique UNIQUE (source_id, lot_number)
);

-- Trigger para atualizar updated_at automaticamente em auction_lots
CREATE OR REPLACE FUNCTION auction_lots_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_auction_lots_updated_at
    BEFORE UPDATE ON auction_lots
    FOR EACH ROW
    EXECUTE FUNCTION auction_lots_update_timestamp();

-- Índices de performance para buscas e filtros comuns
CREATE INDEX IF NOT EXISTS idx_auction_lots_source_id  ON auction_lots(source_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_city        ON auction_lots(city);
CREATE INDEX IF NOT EXISTS idx_auction_lots_scrap_type  ON auction_lots(scrap_type);
CREATE INDEX IF NOT EXISTS idx_auction_lots_end_at      ON auction_lots(auction_end_at);
CREATE INDEX IF NOT EXISTS idx_auction_lots_lot_number  ON auction_lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_auction_lots_external_hash ON auction_lots(external_hash);


-- 3. LOGS DE COLETA
-- Histórico de execuções do n8n: sucesso, erro, quantidade de itens coletados.
CREATE TABLE IF NOT EXISTS auction_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id    UUID        REFERENCES auction_sources(id) ON DELETE SET NULL,
    status       TEXT        NOT NULL,      -- ex: 'success', 'error', 'partial'
    message      TEXT,
    items_found  INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_logs_source_id  ON auction_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_auction_logs_created_at ON auction_logs(created_at DESC);


-- =============================================================================
-- Permissões públicas (Row Level Security) — ajustar conforme necessidade
-- Por padrão, libera para o service_role e authenticated users.
-- =============================================================================
ALTER TABLE auction_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_lots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_logs    ENABLE ROW LEVEL SECURITY;

-- Política: apenas usuários autenticados lêem e escrevem
CREATE POLICY "auctions_auth_all" ON auction_sources FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auction_lots_auth_all" ON auction_lots FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auction_logs_auth_all" ON auction_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- O service_role (n8n usará a service key) já bypassa o RLS por padrão.
