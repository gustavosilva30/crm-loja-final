-- ================================================================
-- Updates v38 — Sistema de Sucatas (Veículos e Peças Desmontadas)
-- Execute no Supabase: Dashboard > SQL Editor
-- ================================================================

-- 1. Tabela principal de sucatas (veículos comprados em leilão)
CREATE TABLE IF NOT EXISTS sucatas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo              VARCHAR(20) UNIQUE NOT NULL,      -- SUC-0001
    status              VARCHAR(30) NOT NULL DEFAULT 'Aguardando',
                        -- Aguardando | Em Desmontagem | Concluída | Alienada

    -- Dados do veículo
    placa               VARCHAR(10),
    chassi              VARCHAR(30),
    marca               VARCHAR(50) NOT NULL,
    modelo              VARCHAR(80) NOT NULL,
    ano_fabricacao      INT,
    ano_modelo          INT,
    cor                 VARCHAR(40),
    combustivel         VARCHAR(30),   -- Flex | Gasolina | Diesel | Elétrico
    km_entrada          INT,
    condicao            VARCHAR(50),   -- Batida | Queimada | Afogada | Desmontada | Outros

    -- Compra
    data_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_compra        DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_frete         DECIMAL(12,2) DEFAULT 0,
    outros_custos       DECIMAL(12,2) DEFAULT 0,
    custo_total         DECIMAL(12,2) GENERATED ALWAYS AS
                        (valor_compra + COALESCE(valor_frete,0) + COALESCE(outros_custos,0)) STORED,

    -- Vínculo com módulo Leilões
    auction_lot_id      UUID REFERENCES auction_lots(id) ON DELETE SET NULL,

    -- Localização física
    local_armazenagem   VARCHAR(120),   -- Pátio, Box, etc.

    -- Mídia e texto
    fotos               TEXT[] DEFAULT '{}',
    observacoes         TEXT,

    -- Controle
    responsavel_id      UUID REFERENCES atendentes(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sucatas_status      ON sucatas(status);
CREATE INDEX IF NOT EXISTS idx_sucatas_marca       ON sucatas(marca);
CREATE INDEX IF NOT EXISTS idx_sucatas_lot         ON sucatas(auction_lot_id);
CREATE INDEX IF NOT EXISTS idx_sucatas_data        ON sucatas(data_compra DESC);

-- Sequence para código automático (SUC-0001, SUC-0002...)
CREATE SEQUENCE IF NOT EXISTS sucatas_codigo_seq START 1;

-- Trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION set_sucata_codigo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'SUC-' || LPAD(nextval('sucatas_codigo_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_codigo ON sucatas;
CREATE TRIGGER trg_sucata_codigo
  BEFORE INSERT ON sucatas
  FOR EACH ROW EXECUTE FUNCTION set_sucata_codigo();

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_sucata_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sucata_updated ON sucatas;
CREATE TRIGGER trg_sucata_updated
  BEFORE UPDATE ON sucatas
  FOR EACH ROW EXECUTE FUNCTION update_sucata_timestamp();

-- ----------------------------------------------------------------
-- 2. Peças desmontadas das sucatas
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucatas_pecas (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sucata_id           UUID NOT NULL REFERENCES sucatas(id) ON DELETE CASCADE,
    produto_id          UUID REFERENCES produtos(id) ON DELETE SET NULL, -- produto no estoque

    -- Dados da peça
    nome                VARCHAR(200) NOT NULL,
    descricao           TEXT,
    part_number         VARCHAR(80),
    condicao            VARCHAR(30) DEFAULT 'Boa',
                        -- Ótima | Boa | Regular | Danificada

    -- Localização no WMS
    localizacao_id      UUID REFERENCES localizacoes(id) ON DELETE SET NULL,

    -- Financeiro
    custo_estimado      DECIMAL(12,2) DEFAULT 0,
    preco_venda         DECIMAL(12,2) DEFAULT 0,

    -- Status
    status              VARCHAR(30) DEFAULT 'Disponível',
                        -- Disponível | Cadastrada no Estoque | Vendida | Descartada

    -- Mídia
    fotos               TEXT[] DEFAULT '{}',

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sucatas_pecas_sucata      ON sucatas_pecas(sucata_id);
CREATE INDEX IF NOT EXISTS idx_sucatas_pecas_produto     ON sucatas_pecas(produto_id);
CREATE INDEX IF NOT EXISTS idx_sucatas_pecas_status      ON sucatas_pecas(status);
CREATE INDEX IF NOT EXISTS idx_sucatas_pecas_localizacao ON sucatas_pecas(localizacao_id);

-- Trigger de updated_at para peças
DROP TRIGGER IF EXISTS trg_sucata_peca_updated ON sucatas_pecas;
CREATE TRIGGER trg_sucata_peca_updated
  BEFORE UPDATE ON sucatas_pecas
  FOR EACH ROW EXECUTE PROCEDURE update_sucata_timestamp();

-- ----------------------------------------------------------------
-- 3. RLS — Row Level Security
-- ----------------------------------------------------------------
ALTER TABLE sucatas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucatas_pecas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sucatas_all"       ON sucatas;
DROP POLICY IF EXISTS "sucatas_pecas_all" ON sucatas_pecas;

CREATE POLICY "sucatas_all"
  ON sucatas FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "sucatas_pecas_all"
  ON sucatas_pecas FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 4. Coluna de vínculo em auction_lots (para badge no módulo Leilões)
-- ----------------------------------------------------------------
ALTER TABLE auction_lots
  ADD COLUMN IF NOT EXISTS sucata_id UUID REFERENCES sucatas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auction_lots_sucata ON auction_lots(sucata_id);
