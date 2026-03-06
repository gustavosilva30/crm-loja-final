-- 1. Remover restrições órfas ou incorretas que apontam para a tabela "usuarios" (que está vazia)
DO $$ 
BEGIN
    -- Remove da tabela conversas
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'conversas_atendente_id_fkey') THEN
        ALTER TABLE public.conversas DROP CONSTRAINT conversas_atendente_id_fkey;
    END IF;

    -- Remove da tabela mensagens
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'mensagens_atendente_id_fkey') THEN
        ALTER TABLE public.mensagens DROP CONSTRAINT mensagens_atendente_id_fkey;
    END IF;
END $$;

-- 2. Adicionar as restrições corretas apontando para a tabela "atendentes" (onde os dados realmente estão)
ALTER TABLE public.conversas 
    ADD CONSTRAINT conversas_atendente_id_atendentes_fkey 
    FOREIGN KEY (atendente_id) REFERENCES public.atendentes(id) ON DELETE SET NULL;

ALTER TABLE public.mensagens 
    ADD CONSTRAINT mensagens_atendente_id_atendentes_fkey 
    FOREIGN KEY (atendente_id) REFERENCES public.atendentes(id) ON DELETE SET NULL;

-- 3. Limpeza Geral: Vincular dados órfãos à instância principal encontrada
DO $$
DECLARE
    v_instancia_id UUID;
    v_atendente_id UUID;
BEGIN
    -- Busca a primeira instância válida
    SELECT id, atendente_id INTO v_instancia_id, v_atendente_id FROM public.whatsapp_instancias LIMIT 1;

    IF v_instancia_id IS NOT NULL THEN
        -- Atualiza conversas que não têm instância
        UPDATE public.conversas 
        SET instancia_id = v_instancia_id, 
            atendente_id = v_atendente_id,
            legacy = false
        WHERE instancia_id IS NULL;

        -- Atualiza mensagens que não têm instância
        UPDATE public.mensagens 
        SET instancia_id = v_instancia_id, 
            atendente_id = v_atendente_id
        WHERE instancia_id IS NULL;
        
        RAISE NOTICE 'Sincronização concluída para instância %', v_instancia_id;
    ELSE
        RAISE NOTICE 'Nenhuma instância encontrada para vincular dados órfãos.';
    END IF;
END $$;

-- 4. Notificar PostgREST
NOTIFY pgrst, 'reload schema';
