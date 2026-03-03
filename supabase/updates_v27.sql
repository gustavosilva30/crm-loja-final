-- Adicionando número de pedido sequencial para vendas começando em 1000
-- Primeiro criamos a sequência
CREATE SEQUENCE IF NOT EXISTS venda_numero_seq START 1000;

-- Adicionamos a coluna se não existir
ALTER TABLE public.vendas 
ADD COLUMN IF NOT EXISTS numero_pedido INTEGER DEFAULT nextval('venda_numero_seq');

-- Garantir que vendas futuras usem a sequência
-- (O DEFAULT nextval já cuida disso, mas se a coluna já existisse, poderíamos precisar de um trigger ou alteração)

-- Opcional: Fazer o mesmo para orçamentos se desejado (o usuário citou "id da venda", mas orçamentos também se beneficiam)
CREATE SEQUENCE IF NOT EXISTS orcamento_numero_seq START 1000;
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS numero_pedido INTEGER DEFAULT nextval('orcamento_numero_seq');
