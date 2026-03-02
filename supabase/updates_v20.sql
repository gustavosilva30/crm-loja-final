-- Versão 20: Suporte a preço a prazo e entregas manuais

-- 1. Produtos: Adiciona preço a prazo
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS preco_prazo DECIMAL(10, 2) DEFAULT 0.00;

-- 2. Orçamentos: Adiciona condição de pagamento
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS condicao_pagamento VARCHAR(50) DEFAULT 'À Vista';

-- 3. Entregas: Permite cadastro manual e campos extras
ALTER TABLE public.entregas ALTER COLUMN venda_id DROP NOT NULL;
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS cliente_contato VARCHAR(255);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS rua VARCHAR(255);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS bairro VARCHAR(255);
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS numero VARCHAR(50);
