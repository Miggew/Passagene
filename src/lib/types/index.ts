/**
 * Exportacao centralizada de tipos
 *
 * Este arquivo serve como ponto de entrada para todos os tipos do sistema.
 * Prefira importar tipos daqui ao inves de arquivos individuais.
 *
 * Exemplo:
 *   import type { Cliente, Fazenda, LoteFIVComNomes } from '@/lib/types';
 */

// ========================================
// Tipos principais do sistema (domain)
// ========================================
export type {
  // Entidades principais
  Cliente,
  Fazenda,
  Doadora,
  Receptora,
  Touro,
  Embriao,
  Animal,

  // Protocolos
  ProtocoloSincronizacao,
  ProtocoloReceptora,

  // Aspiracoes e Lotes
  PacoteAspiracao,
  AspiracaoDoadora,
  LoteFIV,
  LoteFIVAcasalamento,
  AcasalamentoEmbrioesMedia,

  // EmbryoScore (análise IA)
  EmbryoScore,
  EmbryoAnalysisQueue,
  EmbryoScoreConfig,
  EmbriaoComScore,
  ClassificacaoEmbriao,

  // Doses e Transferencias
  DoseSemen,
  TransferenciaEmbriao,
  DiagnosticoGestacao,
  HistoricoEmbriao,

  // Dados geneticos por raca
  DadosGeneticosHolandesa,
  DadosProducaoHolandesa,
  DadosConformacaoHolandesa,
  DadosSaudeReproducaoHolandesa,
  DadosGeneticosNelore,
  MedidasFisicasNelore,
  DadosGeneticosGirolando,
  DadosProducaoGirolando,
  Caseinas,
  OutrosDados,

  // Tipos com relacionamentos
  ReceptoraComStatus,
  EmbriaoComRelacionamentos,
  DoseSemenComTouro,
  ProtocoloReceptoraComProtocolo,

  // Tipos para insercao
  DiagnosticoGestacaoInsert,
  DiagnosticoGestacaoUpdate,
  DoseSemenInsert,
  TouroInsert,

  // Sessoes
  TransferenciaSessao,

  // Queries auxiliares
  AspiracaoComDoadora,
  AcasalamentoComDados,
  LoteFIVComPacote,
  SupabaseError,
  EmbriaoQuery,
  DoseComTouroQuery,
  ProtocoloReceptoraQuery,
  ItemTransferenciaQuery,
} from '../types';

// ========================================
// Tipos de Lotes FIV
// ========================================
export type {
  LoteFIVComNomes,
  PacoteComNomes,
  AcasalamentoComNomes,
  AspiracaoComOocitosDisponiveis,
  LoteHistorico,
  DetalhesLoteHistorico,
  HistoricoDespacho,
} from './lotesFiv';

// ========================================
// Tipos de Transferencia de Embrioes
// ========================================
export type {
  SessaoPersistida,
  TransferenciaComReceptora,
  ReceptoraSincronizada,
  EmbrioCompleto,
  PacoteAspiracaoInfo,
  PacoteEmbrioes,
  SessaoTransferenciaStorage,
  RelatorioTransferenciaItem,
  TransferenciaRelatorioData,
  DoseComTouro,
  EmbriaoComLote,
  TransferenciaFormData,
  CamposPacote,
} from './transferenciaEmbrioes';
