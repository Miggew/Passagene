-- QUERY 1: Ver protocolos EM_TE em detalhe
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS num_receptoras_total,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS num_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS num_inaptas,
    CASE 
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) = COUNT(pr.id) 
        THEN 'TODAS UTILIZADAS'
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) > 0 
        THEN 'ALGUMAS UTILIZADAS'
        ELSE 'NENHUMA UTILIZADA'
    END AS situacao_receptoras
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
ORDER BY ps.data_inicio DESC;

-- QUERY 2: Ver protocolos PASSO2_FECHADO em detalhe
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    ps.data_retirada,
    COUNT(pr.id) AS num_receptoras_total,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS num_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS num_inaptas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'PASSO2_FECHADO'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data, ps.data_retirada
ORDER BY ps.data_inicio DESC;

-- QUERY 3: Ver protocolos PASSO1_FECHADO
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS num_receptoras_total,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS num_iniciadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'PASSO1_FECHADO'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
ORDER BY ps.data_inicio DESC;

-- QUERY 4: Análise cruzada - Status vs situação das receptoras
SELECT 
    ps.status,
    CASE 
        WHEN ps.passo2_data IS NOT NULL THEN 'Com Passo2'
        ELSE 'Sem Passo2'
    END AS tem_passo2,
    COUNT(DISTINCT ps.id) AS total_protocolos,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS receptoras_inaptas,
    ROUND(
        100.0 * COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) / 
        NULLIF(COUNT(pr.id), 0), 
        1
    ) AS percentual_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status IN ('EM_TE', 'PASSO2_FECHADO', 'PASSO1_FECHADO')
GROUP BY ps.status, CASE WHEN ps.passo2_data IS NOT NULL THEN 'Com Passo2' ELSE 'Sem Passo2' END
ORDER BY ps.status, tem_passo2;

-- QUERY 5: Verificar hipótese sobre EM_TE
SELECT 
    ps.status AS status_atual,
    CASE 
        WHEN ps.passo2_data IS NOT NULL THEN 'Tem Passo2'
        ELSE 'Sem Passo2'
    END AS tem_passo2,
    CASE 
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) > 0 
        THEN 'Tem UTILIZADAS'
        ELSE 'Sem UTILIZADAS'
    END AS tem_utilizadas,
    CASE 
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) = COUNT(pr.id) 
             AND COUNT(pr.id) > 0
        THEN 'TODAS UTILIZADAS'
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) > 0 
        THEN 'Algumas UTILIZADAS'
        ELSE 'Nenhuma UTILIZADA'
    END AS situacao,
    COUNT(pr.id) AS num_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status IN ('EM_TE', 'PASSO2_FECHADO', 'PASSO1_FECHADO')
GROUP BY ps.id, ps.status, ps.passo2_data
ORDER BY ps.status;
