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
