/**
 * Hook para gerenciar filtros e estados de UI de Transferência de Embriões
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import { useState, useCallback } from 'react';
import { RelatorioTransferenciaItem } from '@/lib/types/transferenciaEmbrioes';

export type OrigemEmbriao = 'PACOTE' | 'CONGELADO';

export interface TransferenciaFiltersState {
  origemEmbriao: OrigemEmbriao;
  filtroClienteId: string;
  filtroRaca: string;
  dataPasso2: string;
  incluirCioLivre: boolean;
  embrioesPage: number;
}

export interface TransferenciaRelatorioState {
  showRelatorioDialog: boolean;
  relatorioData: RelatorioTransferenciaItem[];
  isVisualizacaoApenas: boolean;
}

const INITIAL_FILTERS: TransferenciaFiltersState = {
  origemEmbriao: 'PACOTE',
  filtroClienteId: '',
  filtroRaca: '',
  dataPasso2: '',
  incluirCioLivre: false,
  embrioesPage: 1,
};

const INITIAL_RELATORIO: TransferenciaRelatorioState = {
  showRelatorioDialog: false,
  relatorioData: [],
  isVisualizacaoApenas: false,
};

export function useTransferenciaEmbrioesFilters() {
  // Estados de filtros
  const [origemEmbriao, setOrigemEmbriao] = useState<OrigemEmbriao>(INITIAL_FILTERS.origemEmbriao);
  const [filtroClienteId, setFiltroClienteId] = useState(INITIAL_FILTERS.filtroClienteId);
  const [filtroRaca, setFiltroRaca] = useState(INITIAL_FILTERS.filtroRaca);
  const [dataPasso2, setDataPasso2] = useState(INITIAL_FILTERS.dataPasso2);
  const [incluirCioLivre, setIncluirCioLivre] = useState(INITIAL_FILTERS.incluirCioLivre);
  const [embrioesPage, setEmbrioesPage] = useState(INITIAL_FILTERS.embrioesPage);

  // Estados de UI do relatório
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(INITIAL_RELATORIO.showRelatorioDialog);
  const [relatorioData, setRelatorioData] = useState<RelatorioTransferenciaItem[]>(INITIAL_RELATORIO.relatorioData);
  const [isVisualizacaoApenas, setIsVisualizacaoApenas] = useState(INITIAL_RELATORIO.isVisualizacaoApenas);

  // Resetar todos os filtros
  const resetFilters = useCallback(() => {
    setOrigemEmbriao(INITIAL_FILTERS.origemEmbriao);
    setFiltroClienteId(INITIAL_FILTERS.filtroClienteId);
    setFiltroRaca(INITIAL_FILTERS.filtroRaca);
    setDataPasso2(INITIAL_FILTERS.dataPasso2);
    setIncluirCioLivre(INITIAL_FILTERS.incluirCioLivre);
    setEmbrioesPage(INITIAL_FILTERS.embrioesPage);
  }, []);

  // Resetar estados do relatório
  const resetRelatorio = useCallback(() => {
    setShowRelatorioDialog(INITIAL_RELATORIO.showRelatorioDialog);
    setRelatorioData(INITIAL_RELATORIO.relatorioData);
    setIsVisualizacaoApenas(INITIAL_RELATORIO.isVisualizacaoApenas);
  }, []);

  // Resetar tudo (usado ao encerrar sessão)
  const resetAll = useCallback(() => {
    resetFilters();
    resetRelatorio();
  }, [resetFilters, resetRelatorio]);

  // Abrir dialog de relatório para visualização
  const abrirRelatorioVisualizacao = useCallback((data: RelatorioTransferenciaItem[]) => {
    setRelatorioData(data);
    setIsVisualizacaoApenas(true);
    setShowRelatorioDialog(true);
  }, []);

  // Abrir dialog de relatório para encerramento
  const abrirRelatorioEncerramento = useCallback((data: RelatorioTransferenciaItem[]) => {
    setRelatorioData(data);
    setIsVisualizacaoApenas(false);
    setShowRelatorioDialog(true);
  }, []);

  // Fechar dialog de relatório
  const fecharRelatorio = useCallback(() => {
    setShowRelatorioDialog(false);
    setIsVisualizacaoApenas(false);
  }, []);

  // Aplicar filtros de uma sessão restaurada
  const aplicarFiltrosSessao = useCallback((sessao: {
    origem_embriao?: string;
    filtro_cliente_id?: string;
    filtro_raca?: string;
    data_passo2?: string;
    incluir_cio_livre?: boolean;
    embrioes_page?: number;
  }) => {
    setOrigemEmbriao(sessao.origem_embriao === 'CONGELADO' ? 'CONGELADO' : 'PACOTE');
    setFiltroClienteId(sessao.filtro_cliente_id || '');
    setFiltroRaca(sessao.filtro_raca || '');
    setDataPasso2(sessao.data_passo2 || new Date().toISOString().split('T')[0]);
    setIncluirCioLivre(!!sessao.incluir_cio_livre);
    if (sessao.embrioes_page) {
      setEmbrioesPage(sessao.embrioes_page);
    }
  }, []);

  // Obter estado atual dos filtros (para salvar sessão)
  const getFiltersState = useCallback((): TransferenciaFiltersState => ({
    origemEmbriao,
    filtroClienteId,
    filtroRaca,
    dataPasso2,
    incluirCioLivre,
    embrioesPage,
  }), [origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, incluirCioLivre, embrioesPage]);

  return {
    // Estados de filtros
    origemEmbriao,
    setOrigemEmbriao,
    filtroClienteId,
    setFiltroClienteId,
    filtroRaca,
    setFiltroRaca,
    dataPasso2,
    setDataPasso2,
    incluirCioLivre,
    setIncluirCioLivre,
    embrioesPage,
    setEmbrioesPage,

    // Estados do relatório
    showRelatorioDialog,
    setShowRelatorioDialog,
    relatorioData,
    setRelatorioData,
    isVisualizacaoApenas,
    setIsVisualizacaoApenas,

    // Funções utilitárias
    resetFilters,
    resetRelatorio,
    resetAll,
    abrirRelatorioVisualizacao,
    abrirRelatorioEncerramento,
    fecharRelatorio,
    aplicarFiltrosSessao,
    getFiltersState,
  };
}

export type UseTransferenciaEmbrioesFiltersReturn = ReturnType<typeof useTransferenciaEmbrioesFilters>;
