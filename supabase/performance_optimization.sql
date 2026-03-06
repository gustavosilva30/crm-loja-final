-- Performance & CRM Optimization Script
-- Foco: Melhorar tempo de resposta e reduzir carga de dados

-- 1. Melhorias na tabela de Conversas
-- Denormalização para evitar queries pesadas na listagem de conversas
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS last_message_text TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS last_message_kind VARCHAR(20) DEFAULT 'texto';

-- 2. Índices de Performance
-- Índice para ordenação rápida por última mensagem
CREATE INDEX IF NOT EXISTS idx_conversas_last_message_at ON public.conversas(last_message_at DESC);
-- Índice para busca rápida de não lidas
CREATE INDEX IF NOT EXISTS idx_conversas_unread_count ON public.conversas(unread_count) WHERE unread_count > 0;
-- Índice composto para mensagens (muito importante para paginação e ordenação)
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_timestamp ON public.mensagens(conversa_id, timestamp DESC);
-- Índice para status de lida
CREATE INDEX IF NOT EXISTS idx_mensagens_lida ON public.mensagens(lida) WHERE lida = false;

-- 3. Função para atualizar denormalização automaticamente via Trigger
CREATE OR REPLACE FUNCTION public.update_conversa_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversas
    SET 
        last_message_at = NEW.timestamp,
        last_message_text = CASE 
            WHEN NEW.conteudo IS NOT NULL AND NEW.conteudo != '' THEN LEFT(NEW.conteudo, 100)
            ELSE 'Mídia'
        END,
        last_message_kind = CASE 
            WHEN NEW.tipo_envio = 'received' THEN 'received'
            ELSE 'sent'
        END,
        unread_count = CASE 
            WHEN NEW.tipo_envio = 'received' THEN unread_count + 1
            ELSE unread_count
        END,
        updated_at = NOW()
    WHERE id = NEW.conversa_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_conversa_last_message ON public.mensagens;
CREATE TRIGGER tr_update_conversa_last_message
AFTER INSERT ON public.mensagens
FOR EACH ROW
EXECUTE FUNCTION public.update_conversa_last_message();

-- 4. RPC para Dashboard (Consolida múltiplas chamadas em uma só)
-- Isso evita que o frontend baixe milhares de linhas
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_start_date DATE, p_end_date DATE)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'faturamento', COALESCE((SELECT SUM(total) FROM vendas WHERE status != 'Cancelado' AND data_venda::DATE BETWEEN p_start_date AND p_end_date), 0),
        'vendas_count', (SELECT COUNT(*) FROM vendas WHERE status != 'Cancelado' AND data_venda::DATE BETWEEN p_start_date AND p_end_date),
        'estoque_critico', (SELECT COUNT(*) FROM produtos WHERE estoque_atual <= estoque_minimo),
        'ml_faturamento', COALESCE((SELECT SUM(total) FROM vendas WHERE status != 'Cancelado' AND origem_ml = true AND data_venda::DATE BETWEEN p_start_date AND p_end_date), 0),
        'vendas_hoje', COALESCE((SELECT SUM(total) FROM vendas WHERE status != 'Cancelado' AND data_venda::DATE = CURRENT_DATE), 0),
        'clientes_total', (SELECT COUNT(*) FROM clientes),
        'despesas_mes', COALESCE((SELECT SUM(valor) FROM financeiro_lancamentos WHERE tipo = 'Despesa' AND data_vencimento BETWEEN date_trunc('month', CURRENT_DATE)::DATE AND (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::DATE), 0)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para marcar mensagens como lidas em lote (otimização de tempo de resposta)
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_conversa_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.mensagens
    SET lida = true
    WHERE conversa_id = p_conversa_id AND lida = false;
    
    UPDATE public.conversas
    SET unread_count = 0
    WHERE id = p_conversa_id;
END;
$$ LANGUAGE plpgsql;

-- Recarregar schema para tornar as funções visíveis na API do PostgREST
NOTIFY pgrst, 'reload schema';
