-- Versão 21: Compatibilidade de Produtos e Correção de Exclusão

-- 1. Adicionar coluna de compatibilidade na tabela de produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS compatibilidade TEXT;

-- 2. Corrigir restrições de chave estrangeira para permitir exclusão (ON DELETE CASCADE)
-- Itens da Venda
ALTER TABLE public.vendas_itens DROP CONSTRAINT IF EXISTS vendas_itens_produto_id_fkey;
ALTER TABLE public.vendas_itens 
    ADD CONSTRAINT vendas_itens_produto_id_fkey 
    FOREIGN KEY (produto_id) 
    REFERENCES public.produtos(id) 
    ON DELETE CASCADE;

-- Itens do Orçamento
ALTER TABLE public.orcamentos_itens DROP CONSTRAINT IF EXISTS orcamentos_itens_produto_id_fkey;
ALTER TABLE public.orcamentos_itens 
    ADD CONSTRAINT orcamentos_itens_produto_id_fkey 
    FOREIGN KEY (produto_id) 
    REFERENCES public.produtos(id) 
    ON DELETE CASCADE;

-- Comentário: A tabela estoque_movimentacoes já possui ON DELETE CASCADE conforme schema original.
