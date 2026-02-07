/**
 * Regras de negócio do fluxo FIV completo
 *
 * Fluxo: PASSO 1 → PASSO 2 → ASPIRAÇÃO → FECUNDAÇÃO (D0) → TE (D7) → DG → SEXAGEM
 *
 * Relação temporal das datas (referência: Passo 2):
 *   Passo2 + 1  = Aspiração (ideal)
 *   Passo2 + 2  = D0 (fecundação)
 *   Passo2 + 9  = TE (embrião em D7)
 *   D0 + 27     = DG mínimo
 *   D0 + 54     = Sexagem mínimo
 */

import { addDays, differenceInCalendarDays } from 'date-fns';

// ============ TIPOS ============

export type QualidadeTiming = 'ideal' | 'aceitavel' | 'ruim' | 'invalido';

export interface JanelaDatas {
  ideal: { min: Date; max: Date };
  aceitavel: { min: Date; max: Date };
}

export interface FluxoCompleto {
  passo2: JanelaDatas;
  aspiracao: { ideal: Date; aceitavel: Date; limite: Date };
  te: { ideal: Date; aceitavel: Date };
  d0Estimado: Date;
  dg: { min: Date };
  sexagem: { min: Date };
  parto: { estimado: Date };
}

// ============ CONSTANTES ============

/** Protocolo 2º Passo: dias após o 1º Passo */
export const PASSO2 = {
  /** Mínimo aceito (resultado pior) */
  MIN: 7,
  /** Ideal mínimo */
  IDEAL_MIN: 8,
  /** Ideal máximo */
  IDEAL_MAX: 10,
  /** Máximo aceito (resultado pior) */
  MAX: 11,
} as const;

/** Aspiração: dias após o 2º Passo (NÃO se aplica a embriões congelados) */
export const ASPIRACAO = {
  /** Dia seguinte ao 2º passo (ideal) */
  IDEAL: 1,
  /** Segundo dia (resultado pior) */
  ACEITAVEL: 2,
  /** Terceiro dia já não funciona */
  LIMITE: 3,
} as const;

/** TE: Transferência de Embriões */
export const TE = {
  /** Dia ideal do embrião (D7) */
  DIA_EMBRIAO: 7,
  /** Dia excepcional do embrião (D8, resultado pior) */
  DIA_EMBRIAO_MAX: 8,
  /** Dias após o 2º passo para a TE */
  DIAS_APOS_PASSO2: 9,
} as const;

/** DG: Diagnóstico de Gestação - dias após D0 do embrião */
export const DG = {
  MIN_DIAS: 27,
} as const;

/** Sexagem: dias após D0 do embrião */
export const SEXAGEM = {
  MIN_DIAS: 54,
} as const;

/** Gestação bovina */
export const GESTACAO = {
  /** Duração real média da gestação bovina (dias) */
  DURACAO_REAL: 283,
  /** Estimativa com margem de segurança para data provável de parto (dias após D0) */
  DURACAO_ESTIMADA: 275,
} as const;

/**
 * Status permitidos para entrar no 1º passo do protocolo.
 * A receptora também NÃO pode estar em nenhum protocolo ativo.
 */
export const STATUS_ENTRADA_PROTOCOLO = ['VAZIA', 'SERVIDA'] as const;

// ============ FUNÇÕES DE AVALIAÇÃO ============

/**
 * Avalia qualidade do intervalo entre 1º e 2º passo.
 *
 * - 8-10 dias → ideal
 * - 7 ou 11 dias → aceitável (resultado pior)
 * - Fora disso → inválido
 */
export function avaliarTimingPasso2(diasAposPasso1: number): QualidadeTiming {
  if (diasAposPasso1 >= PASSO2.IDEAL_MIN && diasAposPasso1 <= PASSO2.IDEAL_MAX) {
    return 'ideal';
  }
  if (diasAposPasso1 === PASSO2.MIN || diasAposPasso1 === PASSO2.MAX) {
    return 'aceitavel';
  }
  return 'invalido';
}

/**
 * Avalia qualidade do timing da aspiração (dias após 2º passo).
 * NÃO se aplica a embriões congelados.
 *
 * - 1 dia → ideal
 * - 2 dias → aceitável (resultado pior)
 * - 3+ dias → inválido
 */
export function avaliarTimingAspiracao(diasAposPasso2: number): QualidadeTiming {
  if (diasAposPasso2 === ASPIRACAO.IDEAL) return 'ideal';
  if (diasAposPasso2 === ASPIRACAO.ACEITAVEL) return 'aceitavel';
  return 'invalido';
}

/**
 * Avalia qualidade do timing da TE (dia do embrião).
 *
 * - D7 → ideal
 * - D8 → aceitável (excepcional, resultado pior)
 * - Outro → inválido
 */
export function avaliarTimingTE(diaEmbriao: number): QualidadeTiming {
  if (diaEmbriao === TE.DIA_EMBRIAO) return 'ideal';
  if (diaEmbriao === TE.DIA_EMBRIAO_MAX) return 'aceitavel';
  return 'invalido';
}

// ============ FUNÇÕES DE CÁLCULO ============

/**
 * Calcula a janela de datas para o 2º passo a partir da data do 1º passo.
 */
export function calcularJanelaPasso2(dataPasso1: Date): JanelaDatas {
  return {
    ideal: {
      min: addDays(dataPasso1, PASSO2.IDEAL_MIN),
      max: addDays(dataPasso1, PASSO2.IDEAL_MAX),
    },
    aceitavel: {
      min: addDays(dataPasso1, PASSO2.MIN),
      max: addDays(dataPasso1, PASSO2.MAX),
    },
  };
}

/**
 * Calcula as datas da aspiração a partir da data do 2º passo.
 * Retorna ideal, aceitável e limite (dia que já não funciona).
 */
export function calcularDataAspiracao(dataPasso2: Date) {
  return {
    ideal: addDays(dataPasso2, ASPIRACAO.IDEAL),
    aceitavel: addDays(dataPasso2, ASPIRACAO.ACEITAVEL),
    limite: addDays(dataPasso2, ASPIRACAO.LIMITE),
  };
}

/**
 * Calcula a data da TE a partir da data do 2º passo.
 * TE = 9º dia após o 2º passo (embrião em D7).
 */
export function calcularDataTE(dataPasso2: Date) {
  return {
    ideal: addDays(dataPasso2, TE.DIAS_APOS_PASSO2),
    aceitavel: addDays(dataPasso2, TE.DIAS_APOS_PASSO2 + 1),
  };
}

/**
 * Estima a data D0 (fecundação) a partir da data do 2º passo.
 * D0 = Passo2 + 2 (aspiração no dia seguinte, fecundação no outro).
 */
export function estimarD0(dataPasso2: Date): Date {
  return addDays(dataPasso2, 2);
}

/**
 * Calcula a data mínima do DG a partir do D0 do embrião.
 */
export function calcularDataDG(dataD0: Date): Date {
  return addDays(dataD0, DG.MIN_DIAS);
}

/**
 * Calcula a data mínima da Sexagem a partir do D0 do embrião.
 */
export function calcularDataSexagem(dataD0: Date): Date {
  return addDays(dataD0, SEXAGEM.MIN_DIAS);
}

/**
 * Calcula a data provável de parto a partir do D0 do embrião.
 * Usa 275 dias (margem de segurança sobre os 283 dias reais).
 */
export function calcularDataProvavelParto(dataD0: Date): Date {
  return addDays(dataD0, GESTACAO.DURACAO_ESTIMADA);
}

/**
 * Calcula todas as datas-chave do fluxo FIV a partir da data do 1º passo.
 * Usa os valores ideais como referência.
 */
export function calcularFluxoCompleto(dataPasso1: Date): FluxoCompleto {
  const passo2 = calcularJanelaPasso2(dataPasso1);
  const dataPasso2Ref = passo2.ideal.min; // usa ideal mínimo como referência

  const aspiracao = calcularDataAspiracao(dataPasso2Ref);
  const te = calcularDataTE(dataPasso2Ref);
  const d0Estimado = estimarD0(dataPasso2Ref);

  return {
    passo2,
    aspiracao,
    te,
    d0Estimado,
    dg: { min: calcularDataDG(d0Estimado) },
    sexagem: { min: calcularDataSexagem(d0Estimado) },
    parto: { estimado: calcularDataProvavelParto(d0Estimado) },
  };
}

// ============ VALIDAÇÃO ============

/**
 * Verifica se uma receptora pode entrar no 1º passo do protocolo.
 *
 * Regras:
 * - Status deve ser VAZIA ou SERVIDA
 * - NÃO pode estar em nenhum protocolo ativo (qualquer etapa)
 */
export function podeEntrarProtocolo(status: string, emProtocoloAtivo: boolean): boolean {
  if (emProtocoloAtivo) return false;
  return (STATUS_ENTRADA_PROTOCOLO as readonly string[]).includes(status);
}

/**
 * Avalia a qualidade geral de um fluxo com base nas datas reais.
 * Retorna a pior qualidade encontrada entre as etapas.
 */
export function avaliarFluxoGeral(params: {
  dataPasso1: Date;
  dataPasso2: Date;
  dataAspiracao?: Date; // opcional (não se aplica a embriões congelados)
  dataTE: Date;
  dataD0: Date;
}): {
  passo2: QualidadeTiming;
  aspiracao: QualidadeTiming | null;
  te: QualidadeTiming;
  geral: QualidadeTiming;
} {
  const diasPasso2 = differenceInCalendarDays(params.dataPasso2, params.dataPasso1);
  const qualidadePasso2 = avaliarTimingPasso2(diasPasso2);

  let qualidadeAspiracao: QualidadeTiming | null = null;
  if (params.dataAspiracao) {
    const diasAspiracao = differenceInCalendarDays(params.dataAspiracao, params.dataPasso2);
    qualidadeAspiracao = avaliarTimingAspiracao(diasAspiracao);
  }

  const diaEmbriao = differenceInCalendarDays(params.dataTE, params.dataD0);
  const qualidadeTE = avaliarTimingTE(diaEmbriao);

  // Pior qualidade entre as etapas
  const niveis: QualidadeTiming[] = [qualidadePasso2, qualidadeTE];
  if (qualidadeAspiracao) niveis.push(qualidadeAspiracao);

  const ordem: QualidadeTiming[] = ['invalido', 'ruim', 'aceitavel', 'ideal'];
  const pior = niveis.reduce((acc, q) => {
    return ordem.indexOf(q) < ordem.indexOf(acc) ? q : acc;
  }, 'ideal' as QualidadeTiming);

  return {
    passo2: qualidadePasso2,
    aspiracao: qualidadeAspiracao,
    te: qualidadeTE,
    geral: pior,
  };
}
