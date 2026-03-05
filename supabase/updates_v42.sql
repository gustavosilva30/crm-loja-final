-- Versão 42: Sistema de Catálogo Master para Peças
-- Objetivo: Facilitar o cadastro de peças com templates predefinidos e compatibilidades.

-- 1. Tabela de Catálogo Master
CREATE TABLE IF NOT EXISTS public.pecas_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    preco_padrao DECIMAL(10, 2) DEFAULT 0.00,
    custo_padrao DECIMAL(10, 2) DEFAULT 0.00,
    marca_veiculo VARCHAR(100),
    modelo_veiculo VARCHAR(100),
    ano_inicio INTEGER,
    ano_fim INTEGER,
    motorizacao VARCHAR(100),
    part_number VARCHAR(100),
    imagem_url TEXT,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que as colunas novas existam (caso a tabela já tenha sido criada antes)
ALTER TABLE public.pecas_catalogo ADD COLUMN IF NOT EXISTS imagem_url TEXT;
ALTER TABLE public.pecas_catalogo ADD COLUMN IF NOT EXISTS custo_padrao DECIMAL(10, 2) DEFAULT 0.00;
ALTER TABLE public.pecas_catalogo ADD COLUMN IF NOT EXISTS motorizacao VARCHAR(100);
ALTER TABLE public.pecas_catalogo ADD COLUMN IF NOT EXISTS part_number VARCHAR(100);

-- 2. Tabela de Compatibilidades do Catálogo
CREATE TABLE IF NOT EXISTS public.pecas_catalogo_compatibilidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peca_id UUID REFERENCES public.pecas_catalogo(id) ON DELETE CASCADE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano VARCHAR(100),
    versao VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE public.pecas_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pecas_catalogo_compatibilidade ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso (Permitir tudo para usuários autenticados)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all for authenticated users on pecas_catalogo" ON public.pecas_catalogo;
    CREATE POLICY "Allow all for authenticated users on pecas_catalogo" 
    ON public.pecas_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow all for authenticated users on pecas_catalogo_compat" ON public.pecas_catalogo_compatibilidade;
    CREATE POLICY "Allow all for authenticated users on pecas_catalogo_compat" 
    ON public.pecas_catalogo_compatibilidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- 5.-- Tabelas de Auxiliares de Veículos
CREATE TABLE IF NOT EXISTS public.veiculos_marcas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.veiculos_modelos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    marca_id UUID REFERENCES public.veiculos_marcas(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    categoria VARCHAR(50), -- Sedan, Hatch, SUV, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(marca_id, nome)
);

-- Habilitar RLS
ALTER TABLE public.veiculos_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculos_modelos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (Leitura para todos, escrita para admin - simplificado para local)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Leitura marcas" ON public.veiculos_marcas;
    CREATE POLICY "Leitura marcas" ON public.veiculos_marcas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Escrita marcas" ON public.veiculos_marcas;
    CREATE POLICY "Escrita marcas" ON public.veiculos_marcas FOR ALL TO authenticated USING (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Leitura modelos" ON public.veiculos_modelos;
    CREATE POLICY "Leitura modelos" ON public.veiculos_modelos FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Escrita modelos" ON public.veiculos_modelos;
    CREATE POLICY "Escrita modelos" ON public.veiculos_modelos FOR ALL TO authenticated USING (true);
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Dados iniciais (Marcas)
INSERT INTO public.veiculos_marcas (nome) VALUES 
('Abarth'), ('Audi'), ('Avatr'), ('BMW'), ('BYD'), 
('Caoa Chery'), ('Changan'), ('Chevrolet'), ('Citroën'), ('Denza'), 
('Fiat'), ('Ford'), ('GAC'), ('Geely'), ('GWM'), 
('Honda'), ('Hyundai'), ('Jaguar'), ('Jaecoo'), ('Jeep'), 
('Jetour'), ('Kia'), ('Land Rover'), ('Leapmotor'), ('Lexus'), 
('Mercedes-Benz'), ('MG'), ('MINI'), ('Mitsubishi'), ('Nissan'), 
('Omoda'), ('Peugeot'), ('Porsche'), ('RAM'), ('Renault'), 
('Toyota'), ('Volkswagen'), ('Volvo')
ON CONFLICT (nome) DO NOTHING;

-- Dados iniciais (Modelos)
DO $$
DECLARE
    brand_id UUID;
BEGIN
    -- Volkswagen
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Volkswagen';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Taos'), (brand_id, 'Tera'), (brand_id, 'Nivus'), (brand_id, 'T-Cross'), (brand_id, 'Tiguan Allspace'),
    (brand_id, 'Polo Track'), (brand_id, 'Polo'), (brand_id, 'Golf GTI'), (brand_id, 'Virtus'), (brand_id, 'Jetta'),
    (brand_id, 'Saveiro'), (brand_id, 'Amarok'), (brand_id, 'ID.4'), (brand_id, 'ID. Buzz') ON CONFLICT DO NOTHING;

    -- Fiat
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Fiat';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Strada'), (brand_id, 'Toro'), (brand_id, 'Argo'), (brand_id, 'Mobi'), (brand_id, 'Fiorino'),
    (brand_id, 'Cronos'), (brand_id, 'Pulse'), (brand_id, 'Ducato'), (brand_id, 'Fastback'), (brand_id, 'Scudo'), (brand_id, 'Titano') ON CONFLICT DO NOTHING;

    -- Chevrolet
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Chevrolet';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Captiva EV'), (brand_id, 'Spark EUV'), (brand_id, 'Onix'), (brand_id, 'Onix Plus'), (brand_id, 'Spin'),
    (brand_id, 'Tracker'), (brand_id, 'Tracker 100 Anos'), (brand_id, 'Equinox'), (brand_id, 'Trailblazer'), (brand_id, 'Silverado'),
    (brand_id, 'Montana'), (brand_id, 'S10'), (brand_id, 'Camaro') ON CONFLICT DO NOTHING;

    -- Toyota
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Toyota';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Corolla'), (brand_id, 'Corolla Cross'), (brand_id, 'Hilux'), (brand_id, 'SW4'), (brand_id, 'Yaris Hatch'),
    (brand_id, 'Yaris Sedan'), (brand_id, 'Yaris Cross'), (brand_id, 'Hiace'), (brand_id, 'RAV4') ON CONFLICT DO NOTHING;

    -- Hyundai
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Hyundai';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'HB20'), (brand_id, 'HB20S'), (brand_id, 'Creta') ON CONFLICT DO NOTHING;

    -- Jeep
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Jeep';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Renegade'), (brand_id, 'Compass'), (brand_id, 'Commander'), (brand_id, 'Wrangler'), (brand_id, 'Gladiator'), (brand_id, 'Avenger') ON CONFLICT DO NOTHING;

    -- Renault
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Renault';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Kwid'), (brand_id, 'Kardian'), (brand_id, 'Duster'), (brand_id, 'Oroch'), (brand_id, 'Kwid E-Tech'), (brand_id, 'Megane E-Tech'), (brand_id, 'Kangoo E-Tech') ON CONFLICT DO NOTHING;

    -- BYD
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'BYD';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'ATTO 8'), (brand_id, 'Dolphin Mini'), (brand_id, 'Dolphin'), (brand_id, 'Dolphin Plus'), (brand_id, 'Han') ON CONFLICT DO NOTHING;

    -- Toyota (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Toyota';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Corolla'), (brand_id, 'Camry'), (brand_id, 'Yaris/Vios'), (brand_id, 'Prius'), (brand_id, 'GR86'), 
    (brand_id, 'GR Supra'), (brand_id, 'RAV4'), (brand_id, 'Highlander/Kluger'), (brand_id, 'Fortuner/SW4'), (brand_id, 'Land Cruiser'), 
    (brand_id, 'Hilux'), (brand_id, 'Tacoma'), (brand_id, 'Tundra'), (brand_id, '4Runner'), (brand_id, 'Sequoia'), 
    (brand_id, 'Sienna'), (brand_id, 'Alphard/Vellfire'), (brand_id, 'Avanza/Veloz'), (brand_id, 'C-HR'), (brand_id, 'Crown') ON CONFLICT DO NOTHING;

    -- Honda (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Honda';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Civic'), (brand_id, 'Accord'), (brand_id, 'City'), (brand_id, 'Fit/Jazz'), (brand_id, 'Brio'), 
    (brand_id, 'Amaze'), (brand_id, 'CR-V'), (brand_id, 'HR-V/Vezel'), (brand_id, 'WR-V'), (brand_id, 'BR-V'), 
    (brand_id, 'Pilot'), (brand_id, 'Passport'), (brand_id, 'Ridgeline'), (brand_id, 'Odyssey'), (brand_id, 'Freed'), 
    (brand_id, 'Stepwgn'), (brand_id, 'ZR-V') ON CONFLICT DO NOTHING;

    -- Peugeot (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Peugeot';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, '108'), (brand_id, '208'), (brand_id, '301'), (brand_id, '308'), (brand_id, '408'), 
    (brand_id, '508'), (brand_id, '2008'), (brand_id, '3008'), (brand_id, '5008'), (brand_id, 'Partner'), 
    (brand_id, 'Expert'), (brand_id, 'Boxer'), (brand_id, 'RCZ') ON CONFLICT DO NOTHING;

    -- Citroën (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Citroën';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'C1'), (brand_id, 'C2'), (brand_id, 'C3'), (brand_id, 'C4'), (brand_id, 'C4 Picasso'), 
    (brand_id, 'C5'), (brand_id, 'C5 Aircross'), (brand_id, 'C6'), (brand_id, 'Berlingo'), (brand_id, 'Jumpy'), 
    (brand_id, 'Jumper') ON CONFLICT DO NOTHING;

    -- Renault (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Renault';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Clio'), (brand_id, 'Kwid'), (brand_id, 'Mégane'), (brand_id, 'Twingo'), (brand_id, 'Sandero'), 
    (brand_id, 'Captur'), (brand_id, 'Arkana'), (brand_id, 'Kadjar'), (brand_id, 'Koleos'), (brand_id, 'Duster'), 
    (brand_id, 'Kangoo'), (brand_id, 'Master'), (brand_id, 'Trafic'), (brand_id, 'Espace'), (brand_id, 'Laguna'), 
    (brand_id, 'Scenic'), (brand_id, 'Talisman'), (brand_id, 'Fluence'), (brand_id, 'Zoe'), (brand_id, '5 E-Tech') ON CONFLICT DO NOTHING;

    -- Nissan (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Nissan';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'March'), (brand_id, 'Note'), (brand_id, 'Tiida'), (brand_id, 'Sentra'), (brand_id, 'Versa'), 
    (brand_id, 'Altima'), (brand_id, 'Maxima'), (brand_id, 'Skyline'), (brand_id, 'GT-R'), (brand_id, '370Z'), 
    (brand_id, 'Leaf'), (brand_id, 'Ariya'), (brand_id, 'Juke'), (brand_id, 'Kicks'), (brand_id, 'Qashqai'), 
    (brand_id, 'X-Trail/Rogue'), (brand_id, 'Murano'), (brand_id, 'Pathfinder'), (brand_id, 'Patrol'), (brand_id, 'Frontier'), 
    (brand_id, 'NV200') ON CONFLICT DO NOTHING;

    -- Ford (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Ford';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Fiesta'), (brand_id, 'Focus'), (brand_id, 'Ka'), (brand_id, 'Escort'), (brand_id, 'Mondeo'), 
    (brand_id, 'Taurus'), (brand_id, 'Fusion'), (brand_id, 'Mustang'), (brand_id, 'GT'), (brand_id, 'Puma'), 
    (brand_id, 'Kuga/Escape'), (brand_id, 'Explorer'), (brand_id, 'Edge'), (brand_id, 'Bronco'), (brand_id, 'Expedition'), 
    (brand_id, 'Ranger'), (brand_id, 'Maverick'), (brand_id, 'F-150'), (brand_id, 'Transit'), (brand_id, 'EcoSport') ON CONFLICT DO NOTHING;

    -- Fiat (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Fiat';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, '500'), (brand_id, 'Panda'), (brand_id, 'Punto'), (brand_id, 'Uno'), (brand_id, 'Palio'), 
    (brand_id, 'Siena'), (brand_id, 'Linea'), (brand_id, 'Tipo'), (brand_id, 'Bravo'), (brand_id, 'Mobi'), 
    (brand_id, 'Argo'), (brand_id, 'Cronos'), (brand_id, 'Strada'), (brand_id, 'Toro'), (brand_id, 'Ducato'), 
    (brand_id, 'Fiorino'), (brand_id, 'Doblo') ON CONFLICT DO NOTHING;

    -- Volkswagen (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Volkswagen';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Golf'), (brand_id, 'Polo'), (brand_id, 'Up!'), (brand_id, 'Fusca'), (brand_id, 'Passat'), 
    (brand_id, 'Jetta'), (brand_id, 'Arteon'), (brand_id, 'Bora'), (brand_id, 'Vento'), (brand_id, 'Virtus'), 
    (brand_id, 'Tiguan'), (brand_id, 'Touareg'), (brand_id, 'T-Cross'), (brand_id, 'Taos'), (brand_id, 'T-Roc'), 
    (brand_id, 'Nivus'), (brand_id, 'Atlas'), (brand_id, 'Amarok'), (brand_id, 'ID.3'), (brand_id, 'ID.4'), 
    (brand_id, 'ID.5'), (brand_id, 'ID.7'), (brand_id, 'ID.Buzz') ON CONFLICT DO NOTHING;

    -- Chevrolet (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Chevrolet';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Onix'), (brand_id, 'Prisma'), (brand_id, 'Corsa'), (brand_id, 'Astra'), (brand_id, 'Vectra'), 
    (brand_id, 'Cruze'), (brand_id, 'Malibu'), (brand_id, 'Impala'), (brand_id, 'Camaro'), (brand_id, 'Corvette'), 
    (brand_id, 'Spark'), (brand_id, 'Sonic'), (brand_id, 'Aveo'), (brand_id, 'Tracker'), (brand_id, 'Trax'), 
    (brand_id, 'Equinox'), (brand_id, 'Blazer'), (brand_id, 'Trailblazer'), (brand_id, 'Tahoe'), (brand_id, 'Suburban'), 
    (brand_id, 'S10'), (brand_id, 'Silverado'), (brand_id, 'Montana') ON CONFLICT DO NOTHING;

    -- Mitsubishi (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Mitsubishi';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Lancer'), (brand_id, 'Galant'), (brand_id, 'Mirage'), (brand_id, 'Colt'), (brand_id, 'ASX'), 
    (brand_id, 'Outlander'), (brand_id, 'Eclipse Cross'), (brand_id, 'Pajero'), (brand_id, 'Triton') ON CONFLICT DO NOTHING;

    -- Mercedes-Benz (Families)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Mercedes-Benz';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'A-Class'), (brand_id, 'B-Class'), (brand_id, 'C-Class'), (brand_id, 'E-Class'), (brand_id, 'S-Class'), 
    (brand_id, 'CLA'), (brand_id, 'CLS'), (brand_id, 'GLA'), (brand_id, 'GLB'), (brand_id, 'GLC'), 
    (brand_id, 'GLE'), (brand_id, 'GLS'), (brand_id, 'G-Class'), (brand_id, 'SL'), (brand_id, 'AMG GT'), 
    (brand_id, 'Vito'), (brand_id, 'Sprinter') ON CONFLICT DO NOTHING;

    -- Kia (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Kia';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Picanto'), (brand_id, 'Rio'), (brand_id, 'Cerato'), (brand_id, 'K3'), (brand_id, 'K5'), 
    (brand_id, 'K8'), (brand_id, 'Stonic'), (brand_id, 'Seltos'), (brand_id, 'Sportage'), (brand_id, 'Sorento'), 
    (brand_id, 'Telluride'), (brand_id, 'Carnival'), (brand_id, 'Soul'), (brand_id, 'Niro'), (brand_id, 'EV3'), 
    (brand_id, 'EV6'), (brand_id, 'EV9'), (brand_id, 'Bongo') ON CONFLICT DO NOTHING;

    -- Hyundai (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Hyundai';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'i10'), (brand_id, 'i20'), (brand_id, 'i30'), (brand_id, 'Accent'), (brand_id, 'Elantra'), 
    (brand_id, 'Sonata'), (brand_id, 'Azera'), (brand_id, 'Veloster'), (brand_id, 'Ioniq'), (brand_id, 'Kona'), 
    (brand_id, 'Creta'), (brand_id, 'Tucson'), (brand_id, 'Santa Fe'), (brand_id, 'Palisade'), (brand_id, 'HB20'), 
    (brand_id, 'Staria'), (brand_id, 'Porter') ON CONFLICT DO NOTHING;

    -- Jeep (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Jeep';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Wrangler'), (brand_id, 'Cherokee'), (brand_id, 'Grand Cherokee'), (brand_id, 'Renegade'), (brand_id, 'Compass'), 
    (brand_id, 'Commander'), (brand_id, 'Avenger'), (brand_id, 'Gladiator'), (brand_id, 'Wagoneer'), (brand_id, 'Patriot'), 
    (brand_id, 'Liberty') ON CONFLICT DO NOTHING;

    -- BMW (Families)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'BMW';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'Série 1'), (brand_id, 'Série 2'), (brand_id, 'Série 3'), (brand_id, 'Série 4'), (brand_id, 'Série 5'), 
    (brand_id, 'Série 7'), (brand_id, 'Série 8'), (brand_id, 'X1'), (brand_id, 'X2'), (brand_id, 'X3'), 
    (brand_id, 'X4'), (brand_id, 'X5'), (brand_id, 'X6'), (brand_id, 'X7'), (brand_id, 'Z4'), 
    (brand_id, 'i3'), (brand_id, 'i4'), (brand_id, 'iX'), (brand_id, 'M2'), (brand_id, 'M3'), 
    (brand_id, 'M5'), (brand_id, 'XM') ON CONFLICT DO NOTHING;

    -- Audi (Global)
    SELECT id INTO brand_id FROM public.veiculos_marcas WHERE nome = 'Audi';
    INSERT INTO public.veiculos_modelos (marca_id, nome) VALUES 
    (brand_id, 'A1'), (brand_id, 'A3'), (brand_id, 'A4'), (brand_id, 'A5'), (brand_id, 'A6'), 
    (brand_id, 'A7'), (brand_id, 'A8'), (brand_id, 'Q2'), (brand_id, 'Q3'), (brand_id, 'Q5'), 
    (brand_id, 'Q7'), (brand_id, 'Q8'), (brand_id, 'TT'), (brand_id, 'R8'), (brand_id, 'e-tron') ON CONFLICT DO NOTHING;
END $$;

-- 5. Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_pecas_catalogo_nome ON public.pecas_catalogo(nome);
CREATE INDEX IF NOT EXISTS idx_pecas_catalogo_modelo ON public.pecas_catalogo(modelo_veiculo);

-- Recarregar o cache do PostgREST (Supabase API)
NOTIFY pgrst, 'reload schema';
