/**
 * Hook principal para gerenciar dados dos Lotes FIV
 * Compõe os hooks menores para lista, detalhes e histórico
 */

import { useEffect } from 'react';
import { useLotesFIVListData } from './lotesFiv/useLotesFIVListData';
import { useLotesFIVDetailData } from './lotesFiv/useLotesFIVDetailData';
import { useLotesFIVHistoricoData } from './lotesFiv/useLotesFIVHistoricoData';

interface UseLotesFIVDataProps {
  id?: string;
  filtroHistoricoDataInicio: string;
  filtroHistoricoDataFim: string;
  filtroHistoricoFazenda: string;
  setHistoricoPage: (page: number) => void;
}

export function useLotesFIVData({
  id,
  filtroHistoricoDataInicio,
  filtroHistoricoDataFim,
  filtroHistoricoFazenda,
  setHistoricoPage,
}: UseLotesFIVDataProps) {
  // Hook para dados da lista principal
  const listData = useLotesFIVListData();

  // Hook para detalhes de um lote específico
  const detailData = useLotesFIVDetailData({
    setFazendas: listData.setFazendas,
    setDoadoras: listData.setDoadoras,
    setClientes: listData.setClientes,
    setLoading: listData.setLoading,
  });

  // Hook para histórico de lotes fechados
  const historicoData = useLotesFIVHistoricoData({
    filtroHistoricoDataInicio,
    filtroHistoricoDataFim,
    filtroHistoricoFazenda,
    setHistoricoPage,
  });

  // Effect para carregar dados iniciais
  useEffect(() => {
    if (id) {
      detailData.loadLoteDetail(id);
    } else {
      listData.loadData();
    }
  }, [id, listData.loadData, detailData.loadLoteDetail]);

  return {
    // Estados principais (da lista)
    lotes: listData.lotes,
    pacotes: listData.pacotes,
    fazendas: listData.fazendas,
    setFazendas: listData.setFazendas,
    doadoras: listData.doadoras,
    clientes: listData.clientes,
    loading: listData.loading,

    // Estados do detalhe do lote
    selectedLote: detailData.selectedLote,
    setSelectedLote: detailData.setSelectedLote,
    showLoteDetail: detailData.showLoteDetail,
    setShowLoteDetail: detailData.setShowLoteDetail,
    acasalamentos: detailData.acasalamentos,
    setAcasalamentos: detailData.setAcasalamentos,
    fazendasDestinoIds: detailData.fazendasDestinoIds,
    historicoDespachos: detailData.historicoDespachos,
    setHistoricoDespachos: detailData.setHistoricoDespachos,
    aspiracoesDisponiveis: detailData.aspiracoesDisponiveis,
    dosesDisponiveis: detailData.dosesDisponiveis,
    fazendaOrigemNome: detailData.fazendaOrigemNome,
    fazendasDestinoNomes: detailData.fazendasDestinoNomes,
    dosesDisponiveisNoLote: detailData.dosesDisponiveisNoLote,
    dataAspiracao: detailData.dataAspiracao,

    // Estados para filtros (da lista)
    pacotesParaFiltro: listData.pacotesParaFiltro,
    fazendasAspiracaoUnicas: listData.fazendasAspiracaoUnicas,

    // Estados do histórico
    lotesHistoricos: historicoData.lotesHistoricos,
    loadingHistorico: historicoData.loadingHistorico,
    loteExpandido: historicoData.loteExpandido,
    detalhesLoteExpandido: historicoData.detalhesLoteExpandido,
    loadingDetalhes: historicoData.loadingDetalhes,

    // Funções
    loadData: listData.loadData,
    loadLoteDetail: detailData.loadLoteDetail,
    loadLotesHistoricos: historicoData.loadLotesHistoricos,
    handleExpandirLote: historicoData.handleExpandirLote,
  };
}
