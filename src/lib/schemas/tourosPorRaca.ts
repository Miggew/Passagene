// Schemas de campos dinâmicos por raça para o catálogo de touros

export type TipoCampo = 'number' | 'text' | 'select' | 'date' | 'boolean';

export interface CampoDinamico {
  nome: string; // Nome do campo (chave no JSONB)
  label: string; // Label para exibição
  tipo: TipoCampo;
  categoria: 'geneticos' | 'producao' | 'conformacao' | 'saude_reproducao' | 'medidas_fisicas' | 'caseinas' | 'outros';
  opcoes?: string[]; // Para campos select
  placeholder?: string;
  step?: number; // Para campos number
  min?: number;
  max?: number;
  obrigatorio?: boolean;
  agrupamento?: string; // Para agrupar campos (ex: "SUMÁRIO ANCP")
}

// ============================================
// HOLANDESA
// ============================================

export const camposHolandesa: CampoDinamico[] = [
  // Genéticos
  { nome: 'nm_dolares', label: 'NM$ (Net Merit Dollars)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'tpi', label: 'TPI (Total Performance Index)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ptat', label: 'PTAT', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'udc', label: 'UDC (Udder Composite)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'flc', label: 'FLC (Foot & Leg Composite)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'bwc', label: 'BWC (Body Weight Composite)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'gpa_lpi', label: 'GPA LPI', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'pro_dolar', label: 'PRO$ (Profit Dollars)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  
  // Produção
  { nome: 'leite_kg', label: 'Leite (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'gordura_kg', label: 'Gordura (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'gordura_porcent', label: 'Gordura (%)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'proteina_kg', label: 'Proteína (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'proteina_porcent', label: 'Proteína (%)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'eficiencia_alimentar', label: 'Eficiência Alimentar', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'bmr', label: 'BMR', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'eficiencia_metano', label: 'Eficiência em Metano', tipo: 'number', categoria: 'producao', step: 0.01 },
  
  // Saúde e Reprodução
  { nome: 'perm_rebanho', label: 'Permanência no Rebanho', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'ccs', label: 'C.C.S. (Contagem Células Somáticas)', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'facilidade_parto', label: 'Facilidade de Parto', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'fertilidade_filhas', label: 'Fertilidade Filhas', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'facilidade_parto_materna', label: 'Facilidade de Parto Materna', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'velocidade_ordenha', label: 'Velocidade Ordenha', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'temperamento', label: 'Temperamento', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'persistencia_lactacao', label: 'Persistência Lactação', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'resistencia_mastite', label: 'Resistência à Mastite', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'resistencia_doencas_metabolicas', label: 'Resistência Doenças Metabólicas', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'immunity_bezerra', label: 'Immunity Bezerra', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  { nome: 'escore_condicao_corporal', label: 'Escore Condição Corporal', tipo: 'number', categoria: 'saude_reproducao', step: 0.01 },
  
  // Conformação
  { nome: 'conformacao_geral', label: 'Conformação Geral', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'forca_leiteira', label: 'Força Leiteira', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'sistema_mamario', label: 'Sistema Mamário', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'pernas_pes', label: 'Pernas & Pés', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'garupa', label: 'Garupa', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  
  // Caseínas
  { nome: 'beta_caseina', label: 'Beta Caseína', tipo: 'select', categoria: 'caseinas', opcoes: ['A1A1', 'A1A2', 'A2A2'] },
  { nome: 'kappa_caseina', label: 'Kappa Caseína', tipo: 'select', categoria: 'caseinas', opcoes: ['AA', 'AB', 'BB'] },
  { nome: 'beta_lactoglobulina', label: 'Beta Lactoglobulina', tipo: 'select', categoria: 'caseinas', opcoes: ['AA', 'AB', 'BB'] },
];

// ============================================
// NELORE
// ============================================

export const camposNelore: CampoDinamico[] = [
  // SUMÁRIO ANCP
  { nome: 'mp120', label: 'MP120', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ANCP', step: 0.01 },
  { nome: 'dpn', label: 'DPN', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ANCP', step: 0.01 },
  { nome: 'dp365', label: 'DP365', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ANCP', step: 0.01 },
  { nome: 'dpe365', label: 'DPE365', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ANCP', step: 0.01 },
  { nome: 'mgete', label: 'MGTe', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ANCP', step: 0.01 },
  
  // SUMÁRIO ABCZ PMGZ
  { nome: 'pe365', label: 'PE365 (cm)', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ABCZ PMGZ', step: 0.01 },
  { nome: 'pe450', label: 'PE450 (cm)', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ABCZ PMGZ', step: 0.01 },
  { nome: 'stay', label: 'STAY (%)', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ABCZ PMGZ', step: 0.01 },
  { nome: 'marm', label: 'MARM (%)', tipo: 'number', categoria: 'geneticos', agrupamento: 'SUMÁRIO ABCZ PMGZ', step: 0.01 },
  
  // Medidas Físicas
  { nome: 'cc', label: 'CC - Circunferência do Coração (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'ag', label: 'AG - Altura da Garupa (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'cg', label: 'CG - Circunferência da Garupa (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'lg', label: 'LG - Largura da Garupa (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'pt', label: 'PT - Perímetro Torácico (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'pc', label: 'PC - Profundidade do Corpo (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'ce', label: 'CE - Comprimento Escápula (cm)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
  { nome: 'idade_medicao', label: 'Idade na Medição (meses)', tipo: 'number', categoria: 'medidas_fisicas' },
  { nome: 'peso_medicao', label: 'Peso na Medição (kg)', tipo: 'number', categoria: 'medidas_fisicas', step: 0.01 },
];

// ============================================
// GIROLANDO
// ============================================

export const camposGirolando: CampoDinamico[] = [
  // Genéticos
  { nome: 'gpta_leite', label: 'GPTA Leite (kg)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ipplg', label: 'IPPLG (Índice Produção e Persistência)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ietg', label: 'IETG (Índice Eficiência Tropical)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ifpg', label: 'IFPG (Índice Facilidade Parto)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ireg', label: 'IREG (Composto Reprodução)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'csmg', label: 'CSMG (Composto Sistema Mamário)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'esug', label: 'ESUG (Composto Sistema Locomotor)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ptapn', label: 'PTAPN - Peso ao Nascimento (kg)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'ptapg', label: 'PTAPG - Período Gestacional (dias ou "ROBUSTO")', tipo: 'text', categoria: 'geneticos' },
  { nome: 'idade_primeiro_parto', label: 'Idade ao 1º Parto (dias)', tipo: 'number', categoria: 'geneticos' },
  { nome: 'intervalo_partos', label: 'Intervalo de Partos (dias)', tipo: 'number', categoria: 'geneticos' },
  { nome: 'longevidade', label: 'Longevidade', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'tolerancia_estresse', label: 'Tolerância ao Estresse (TE)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  
  // Produção
  { nome: 'leite_kg', label: 'Leite (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'gordura_kg', label: 'Gordura (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'gordura_porcent', label: 'Gordura (%)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'proteina_kg', label: 'Proteína (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'proteina_porcent', label: 'Proteína (%)', tipo: 'number', categoria: 'producao', step: 0.01 },
  
  // Caseínas
  { nome: 'beta_caseina', label: 'Beta Caseína', tipo: 'select', categoria: 'caseinas', opcoes: ['A1A1', 'A1A2', 'A2A2'] },
  { nome: 'beta_lactoglobulina', label: 'Beta Lactoglobulina', tipo: 'select', categoria: 'caseinas', opcoes: ['AA', 'AB', 'BB'] },
  { nome: 'kappa_caseina', label: 'Kappa Caseína', tipo: 'select', categoria: 'caseinas', opcoes: ['AA', 'AB', 'BB'] },
  
  // Outros
  { nome: 'composicao_genetica', label: 'Composição Genética', tipo: 'text', categoria: 'outros', placeholder: 'Ex: 5/8 HOLANDÊS + 3/8 GIR' },
];

// ============================================
// GIR LEITEIRO
// ============================================

export const camposGirLeiteiro: CampoDinamico[] = [
  { nome: 'gpta_leite', label: 'GPTA Leite (kg)', tipo: 'number', categoria: 'geneticos', step: 0.01 },
  { nome: 'pta_leite', label: 'PTA Leite (kg)', tipo: 'number', categoria: 'producao', step: 0.01 },
  { nome: 'controle_leiteiro', label: 'Controle Leiteiro', tipo: 'number', categoria: 'producao', step: 0.01 },
];

// ============================================
// GUZERÁ
// ============================================

export const camposGuzera: CampoDinamico[] = [
  // Similar ao Nelore, mas pode ter campos específicos
  { nome: 'estrutura_corporal', label: 'Estrutura Corporal', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'aprumos', label: 'Aprumos', tipo: 'number', categoria: 'conformacao', step: 0.01 },
  { nome: 'beleza_racial', label: 'Beleza Racial', tipo: 'number', categoria: 'conformacao', step: 0.01 },
];

// ============================================
// Mapa de campos por raça
// ============================================

export const camposPorRaca: Record<string, CampoDinamico[]> = {
  'Holandesa': camposHolandesa,
  'Nelore': camposNelore,
  'Girolando': camposGirolando,
  'Gir Leiteiro': camposGirLeiteiro,
  'Gir': camposGirLeiteiro, // Alias
  'Guzerá': camposGuzera,
  'Guzera': camposGuzera, // Alias
};

// Labels de categorias
export const labelsCategorias: Record<string, string> = {
  'geneticos': '🧬 Informações Genéticas',
  'producao': '📊 Produção',
  'conformacao': '🏃 Conformação',
  'saude_reproducao': '💊 Saúde e Reprodução',
  'medidas_fisicas': '📏 Medidas Físicas',
  'caseinas': '🥛 Caseínas e Proteínas',
  'outros': '📝 Outros Dados',
};

// Função auxiliar para obter campos de uma raça
export function getCamposPorRaca(raca: string): CampoDinamico[] {
  return camposPorRaca[raca] || [];
}

// Função auxiliar para agrupar campos por categoria
export function agruparCamposPorCategoria(campos: CampoDinamico[]): Record<string, CampoDinamico[]> {
  const agrupados: Record<string, CampoDinamico[]> = {};
  
  campos.forEach((campo) => {
    if (!agrupados[campo.categoria]) {
      agrupados[campo.categoria] = [];
    }
    agrupados[campo.categoria].push(campo);
  });
  
  return agrupados;
}
