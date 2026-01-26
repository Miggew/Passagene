/**
 * Hook para gerenciar filtros de Lotes FIV
 * Inclui persistência no localStorage e lógica de aplicação
 */

import { useState, useEffect, useMemo } from 'react';
import {
  carregarFiltrosLotesFiv,
  salvarFiltrosLotesFiv,
  HISTORICO_PAGE_SIZE,
} from '@/lib/lotesFivUtils';
import { LoteFIVComNomes, PacoteComNomes, LoteHistorico } from '@/lib/types/lotesFiv';

interface UseLotesFiltrosParams {
  lotes: LoteFIVComNomes[];
  pacotesParaFiltro: PacoteComNomes[];
  fazendasAspiracaoUnicas: { id: string; nome: string }[];
  lotesHistoricos: LoteHistorico[];
}

export function useLotesFiltros({
  lotes,
  pacotesParaFiltro,
  fazendasAspiracaoUnicas,
  lotesHistoricos,
}: UseLotesFiltrosParams) {
  // Carregar filtros persistidos uma única vez
  const [filtrosPersistidos] = useState(() => carregarFiltrosLotesFiv());

  // Estados de filtros para lotes ativos
  const [filtroFazendaAspiracao, setFiltroFazendaAspiracao] = useState<string>(
    filtrosPersistidos.filtroFazendaAspiracao ?? ''
  );
  const [filtroFazendaAspiracaoBusca, setFiltroFazendaAspiracaoBusca] = useState<string>(
    filtrosPersistidos.filtroFazendaAspiracaoBusca ?? ''
  );
  const [filtroDiaCultivo, setFiltroDiaCultivo] = useState<string>(
    filtrosPersistidos.filtroDiaCultivo ?? ''
  );
  const [showFazendaBusca, setShowFazendaBusca] = useState(false);

  // Estados de filtros para histórico
  const [filtroHistoricoDataInicio, setFiltroHistoricoDataInicio] = useState<string>(
    filtrosPersistidos.filtroHistoricoDataInicio ?? ''
  );
  const [filtroHistoricoDataFim, setFiltroHistoricoDataFim] = useState<string>(
    filtrosPersistidos.filtroHistoricoDataFim ?? ''
  );
  const [filtroHistoricoFazenda, setFiltroHistoricoFazenda] = useState<string>(
    filtrosPersistidos.filtroHistoricoFazenda ?? ''
  );
  const [filtroHistoricoFazendaBusca, setFiltroHistoricoFazendaBusca] = useState<string>(
    filtrosPersistidos.filtroHistoricoFazendaBusca ?? ''
  );
  const [showFazendaBuscaHistorico, setShowFazendaBuscaHistorico] = useState(false);

  // Estado da aba e paginação
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>(
    filtrosPersistidos.abaAtiva ?? 'ativos'
  );
  const [historicoPage, setHistoricoPage] = useState<number>(
    filtrosPersistidos.historicoPage ?? 1
  );

  // Persistir filtros no localStorage
  useEffect(() => {
    salvarFiltrosLotesFiv({
      abaAtiva,
      filtroFazendaAspiracao,
      filtroFazendaAspiracaoBusca,
      filtroDiaCultivo,
      filtroHistoricoDataInicio,
      filtroHistoricoDataFim,
      filtroHistoricoFazenda,
      filtroHistoricoFazendaBusca,
      historicoPage,
    });
  }, [
    abaAtiva,
    filtroFazendaAspiracao,
    filtroFazendaAspiracaoBusca,
    filtroDiaCultivo,
    filtroHistoricoDataInicio,
    filtroHistoricoDataFim,
    filtroHistoricoFazenda,
    filtroHistoricoFazendaBusca,
    historicoPage,
  ]);

  // Resetar página quando filtros do histórico mudarem
  useEffect(() => {
    setHistoricoPage(1);
  }, [filtroHistoricoDataInicio, filtroHistoricoDataFim, filtroHistoricoFazenda]);

  // Ajustar página se exceder o total
  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(lotesHistoricos.length / HISTORICO_PAGE_SIZE));
    if (historicoPage > totalPaginas) {
      setHistoricoPage(totalPaginas);
    }
  }, [lotesHistoricos.length, historicoPage]);

  // Fechar dropdown de fazenda ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.fazenda-busca-container')) {
        setShowFazendaBusca(false);
      }
      if (!target.closest('.fazenda-busca-historico-container')) {
        setShowFazendaBuscaHistorico(false);
      }
    };

    if (showFazendaBusca || showFazendaBuscaHistorico) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFazendaBusca, showFazendaBuscaHistorico]);

  // Aplicar filtros aos lotes ativos
  const lotesFiltrados = useMemo(() => {
    let filtrados = [...lotes];

    // Filtro base: excluir lotes fechados ou que passaram do D8
    filtrados = filtrados.filter((l) => {
      if (l.status === 'FECHADO') {
        return false;
      }
      if (l.dia_atual !== undefined && l.dia_atual > 9) {
        return false;
      }
      return l.dia_atual !== undefined && l.dia_atual <= 9;
    });

    // Filtrar por fazenda da aspiração
    if (filtroFazendaAspiracao) {
      filtrados = filtrados.filter((l) => {
        const pacote = pacotesParaFiltro.find((p) => p.id === l.pacote_aspiracao_id);
        return pacote?.fazenda_id === filtroFazendaAspiracao;
      });
    }

    // Filtrar por dia do cultivo
    if (filtroDiaCultivo !== '') {
      const diaFiltro = parseInt(filtroDiaCultivo);
      filtrados = filtrados.filter((l) => {
        if (l.dia_atual === undefined || l.dia_atual === null) {
          return false;
        }
        const diaCultivo = l.dia_atual === 0 ? -1 : l.dia_atual - 1;
        return diaCultivo === diaFiltro;
      });
    }

    return filtrados;
  }, [lotes, filtroFazendaAspiracao, filtroDiaCultivo, pacotesParaFiltro]);

  // Filtrar fazendas para busca (dropdown)
  const fazendasFiltradas = useMemo(
    () =>
      fazendasAspiracaoUnicas.filter((f) =>
        f.nome.toLowerCase().includes(filtroFazendaAspiracaoBusca.toLowerCase())
      ),
    [fazendasAspiracaoUnicas, filtroFazendaAspiracaoBusca]
  );

  // Limpar todos os filtros de lotes ativos
  const limparFiltrosAtivos = () => {
    setFiltroFazendaAspiracao('');
    setFiltroFazendaAspiracaoBusca('');
    setFiltroDiaCultivo('');
    setShowFazendaBusca(false);
  };

  // Limpar todos os filtros de histórico
  const limparFiltrosHistorico = () => {
    setFiltroHistoricoDataInicio('');
    setFiltroHistoricoDataFim('');
    setFiltroHistoricoFazenda('');
    setFiltroHistoricoFazendaBusca('');
    setShowFazendaBuscaHistorico(false);
    setHistoricoPage(1);
  };

  return {
    // Filtros de lotes ativos
    filtroFazendaAspiracao,
    setFiltroFazendaAspiracao,
    filtroFazendaAspiracaoBusca,
    setFiltroFazendaAspiracaoBusca,
    filtroDiaCultivo,
    setFiltroDiaCultivo,
    showFazendaBusca,
    setShowFazendaBusca,
    fazendasFiltradas,
    lotesFiltrados,
    limparFiltrosAtivos,

    // Filtros de histórico
    filtroHistoricoDataInicio,
    setFiltroHistoricoDataInicio,
    filtroHistoricoDataFim,
    setFiltroHistoricoDataFim,
    filtroHistoricoFazenda,
    setFiltroHistoricoFazenda,
    filtroHistoricoFazendaBusca,
    setFiltroHistoricoFazendaBusca,
    showFazendaBuscaHistorico,
    setShowFazendaBuscaHistorico,
    limparFiltrosHistorico,

    // Aba e paginação
    abaAtiva,
    setAbaAtiva,
    historicoPage,
    setHistoricoPage,
    HISTORICO_PAGE_SIZE,
  };
}
