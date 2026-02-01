export function formatStatusLabel(status: string): string {
  const s = (status || '').trim();
  if (!s) return '';

  const map: Record<string, string> = {
    // Estados reprodutivos (receptoras)
    DISPONIVEL: 'Disponível',
    VAZIA: 'Vazia',
    EM_SINCRONIZACAO: 'Em sincronização',
    SINCRONIZADA: 'Sincronizada',
    SERVIDA: 'Servida',
    PRENHE: 'Prenhe',
    PRENHE_RETOQUE: 'Prenhe (retoque)',
    PRENHE_FEMEA: 'Prenhe de fêmea',
    PRENHE_MACHO: 'Prenhe de macho',
    PRENHE_SEM_SEXO: 'Prenhe (sem sexo)',
    PRENHE_2_SEXOS: 'Prenhe de 2 sexos',

    // Status de protocolos / receptoras no protocolo
    SINCRONIZADO: 'Sincronizado',
    FECHADO: 'Fechado',
    PASSO1_FECHADO: 'Passo 1 fechado',
    EM_TE: 'Em TE',

    // Status de receptoras (propriedade)
    EM_PROTOCOLO: 'Em Protocolo',
    DESCARTE: 'Descarte',
    VENDIDA: 'Vendida',

    // Outros estados comuns
    APTA: 'Apta',
    INAPTA: 'Inapta',
    INICIADA: 'Iniciada',
    UTILIZADA: 'Servida',
    NAO_UTILIZADA: 'Não utilizada',
    SINCRONIZANDO: 'Sincronizando',
    RETOQUE: 'Retoque',
    TRANSFERIDO: 'Transferido',
    CONGELADO: 'Congelado',
    REALIZADA: 'Realizada',

    // Variações legadas que ainda aparecem em alguns lugares
    'EM SINCRONIZAÇÃO': 'Em sincronização',
    'PRENHE (RETOQUE)': 'Prenhe (retoque)',
    'PRENHE (FÊMEA)': 'Prenhe de fêmea',
    'PRENHE (MACHO)': 'Prenhe de macho',
    'PRENHE (SEM SEXO)': 'Prenhe (sem sexo)',
    'PRENHE (2 SEXOS)': 'Prenhe de 2 sexos',
  };

  if (map[s]) return map[s];

  // Fallback: transformar "ALGUMA_COISA" em "Alguma coisa"
  // (não tenta adivinhar acentos)
  const spaced = s.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

