-- Script para verificar receptoras duplicadas no mesmo protocolo
-- (mesma receptora_id aparecendo múltiplas vezes no mesmo protocolo_id)

-- 1. Verificar duplicatas no protocolo_receptoras
SELECT 
    protocolo_id,
    receptora_id,
    COUNT(*) as quantidade,
    STRING_AGG(id::text, ', ') as ids_protocolo_receptoras,
    STRING_AGG(status, ', ') as status_lista
FROM protocolo_receptoras
GROUP BY protocolo_id, receptora_id
HAVING COUNT(*) > 1
ORDER BY protocolo_id, receptora_id;

-- 2. Ver detalhes das receptoras duplicadas
WITH duplicatas AS (
    SELECT 
        protocolo_id,
        receptora_id,
        COUNT(*) as quantidade
    FROM protocolo_receptoras
    GROUP BY protocolo_id, receptora_id
    HAVING COUNT(*) > 1
)
SELECT 
    pr.id,
    pr.protocolo_id,
    pr.receptora_id,
    r.identificacao as brinco,
    r.nome,
    pr.status,
    pr.data_inclusao,
    pr.created_at
FROM protocolo_receptoras pr
INNER JOIN duplicatas d ON pr.protocolo_id = d.protocolo_id AND pr.receptora_id = d.receptora_id
INNER JOIN receptoras r ON pr.receptora_id = r.id
ORDER BY pr.protocolo_id, pr.receptora_id, pr.created_at;

-- 3. Script para remover duplicatas (manter apenas a mais antiga)
-- ATENÇÃO: Execute apenas após revisar os resultados acima
/*
DO $$
DECLARE
    rec_duplicata RECORD;
    id_manter UUID;
    ids_remover UUID[];
BEGIN
    -- Para cada duplicata, manter a mais antiga e remover as outras
    FOR rec_duplicata IN 
        SELECT 
            protocolo_id,
            receptora_id,
            ARRAY_AGG(id ORDER BY created_at ASC) as ids_ordenados
        FROM protocolo_receptoras
        GROUP BY protocolo_id, receptora_id
        HAVING COUNT(*) > 1
    LOOP
        -- Primeiro ID (mais antigo) é o que mantemos
        id_manter := rec_duplicata.ids_ordenados[1];
        
        -- IDs restantes são os que removemos
        ids_remover := rec_duplicata.ids_ordenados[2:array_length(rec_duplicata.ids_ordenados, 1)];
        
        RAISE NOTICE 'Protocolo: %, Receptora: %, Mantendo: %, Removendo: %', 
            rec_duplicata.protocolo_id, 
            rec_duplicata.receptora_id,
            id_manter,
            ids_remover;
        
        -- Remover duplicatas (exceto a mais antiga)
        DELETE FROM protocolo_receptoras
        WHERE id = ANY(ids_remover);
        
        RAISE NOTICE 'Removidas % duplicata(s) do protocolo % para receptora %', 
            array_length(ids_remover, 1),
            rec_duplicata.protocolo_id,
            rec_duplicata.receptora_id;
    END LOOP;
    
    RAISE NOTICE 'Limpeza de duplicatas concluída';
END $$;
*/
