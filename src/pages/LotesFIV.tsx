import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Fazenda, Doadora, Cliente, AspiracaoDoadora } from '@/lib/types';
import {
  LoteFIVComNomes,
  PacoteComNomes,
  AcasalamentoComNomes,
  AspiracaoComOocitosDisponiveis,
  LoteHistorico,
  DetalhesLoteHistorico,
  HistoricoDespacho,
} from '@/lib/types/lotesFiv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';
import { useLotesFiltros } from '@/hooks/useLotesFiltros';
import { Plus, ArrowLeft, Eye, Lock, X, Users, FileText, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate, extractDateOnly, addDays, diffDays, formatDateString, getDayOfWeekName, getTodayDateString } from '@/lib/utils';
import { getNomeDia, getCorDia, getDiaCultivo } from '@/lib/lotesFivUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { NovoLoteDialog } from '@/components/lotes/NovoLoteDialog';
import { LoteDetailView, AcasalamentoForm } from '@/components/lotes/LoteDetailView';
import { LotesHistoricoTab } from '@/components/lotes/LotesHistoricoTab';

// Tipos movidos para @/lib/types/lotesFiv.ts
// Constantes e funções de filtros movidas para @/lib/lotesFivUtils

export default function LotesFIV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lotes, setLotes] = useState<LoteFIVComNomes[]>([]);
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [aspiracoesDoadoras, setAspiracoesDoadoras] = useState<AspiracaoDoadora[]>([]);
  const [doses, setDoses] = useState<DoseSemen[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoteDetail, setShowLoteDetail] = useState(false);
  const [selectedLote, setSelectedLote] = useState<LoteFIVComNomes | null>(null);
  const [acasalamentos, setAcasalamentos] = useState<AcasalamentoComNomes[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [editQuantidadeEmbrioes, setEditQuantidadeEmbrioes] = useState<{ [key: string]: string }>({});
  const [fazendasDestinoIds, setFazendasDestinoIds] = useState<string[]>([]);
  const [historicoDespachos, setHistoricoDespachos] = useState<HistoricoDespacho[]>([]);
  const [aspiracoesDisponiveis, setAspiracoesDisponiveis] = useState<AspiracaoComOocitosDisponiveis[]>([]);
  const [dosesDisponiveis, setDosesDisponiveis] = useState<DoseSemen[]>([]);
  const [fazendaOrigemNome, setFazendaOrigemNome] = useState<string>('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [dosesDisponiveisNoLote, setDosesDisponiveisNoLote] = useState<DoseSemen[]>([]);
  const [dataAspiracao, setDataAspiracao] = useState<string>('');

  // Estados para dados que o hook de filtros precisa
  const [pacotesParaFiltro, setPacotesParaFiltro] = useState<PacoteComNomes[]>([]);
  const [datasAspiracaoUnicas, setDatasAspiracaoUnicas] = useState<string[]>([]);
  const [fazendasAspiracaoUnicas, setFazendasAspiracaoUnicas] = useState<{ id: string; nome: string }[]>([]);
  const [lotesHistoricos, setLotesHistoricos] = useState<LoteHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);
  const [detalhesLoteExpandido, setDetalhesLoteExpandido] = useState<DetalhesLoteHistorico | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Hook de filtros (gerencia estados de filtros, persistência e lógica de filtragem)
  const {
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
    abaAtiva,
    setAbaAtiva,
    historicoPage,
    setHistoricoPage,
    HISTORICO_PAGE_SIZE,
  } = useLotesFiltros({
    lotes,
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,
    lotesHistoricos,
  });

  // Funções getNomeDia e getCorDia movidas para @/lib/lotesFivUtils
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Estados formData, selectedPacote, acasalamentoForm movidos para seus componentes

  useEffect(() => {
    if (id) {
      loadLoteDetail(id);
    } else {
      loadData();
    }
  }, [id]);

  // useEffects de filtros movidos para useLotesFiltros hook

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacotes FINALIZADOS (apenas pacotes finalizados podem ser usados para criar lotes)
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('status', 'FINALIZADO')
        .order('data_aspiracao', { ascending: false });

      if (pacotesError) {
        throw pacotesError;
      }

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (!clientesError) {
        setClientes(clientesData || []);
      }

      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]));
      const fazendasDestinoPorPacote = new Map<string, string[]>();
      const quantidadePorPacote = new Map<string, number>();

      // Load fazendas destino dos pacotes
      const pacoteIds = pacotesData?.map((p) => p.id) || [];
      
      if (pacoteIds.length > 0) {
        const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .select('pacote_aspiracao_id, fazenda_destino_id')
          .in('pacote_aspiracao_id', pacoteIds);

        // Continuar mesmo com erro - pode ser que a tabela não exista ainda
        if (!fazendasDestinoError && fazendasDestinoData) {
          fazendasDestinoData.forEach((fd) => {
            const nome = fazendasMap.get(fd.fazenda_destino_id);
            if (nome) {
              const atual = fazendasDestinoPorPacote.get(fd.pacote_aspiracao_id) || [];
              atual.push(nome);
              fazendasDestinoPorPacote.set(fd.pacote_aspiracao_id, atual);
            }
          });
        }

        // Load quantidade de doadoras por pacote
        const { data: aspiracoesData, error: aspiracoesError } = await supabase
          .from('aspiracoes_doadoras')
          .select('pacote_aspiracao_id')
          .in('pacote_aspiracao_id', pacoteIds);

        if (!aspiracoesError && aspiracoesData) {
          const pacoteIdNulos = aspiracoesData.filter(a => !a.pacote_aspiracao_id).length;
          const contagemPorPacote = aspiracoesData.reduce<Record<string, number>>((acc, a) => {
            if (!a.pacote_aspiracao_id) return acc;
            acc[a.pacote_aspiracao_id] = (acc[a.pacote_aspiracao_id] || 0) + 1;
            return acc;
          }, {});
          const pacoteIdsSet = new Set(pacoteIds);
          const pacoteIdsComAspiracao = Object.keys(contagemPorPacote);
          const aspiracoesForaDosPacotes = pacoteIdsComAspiracao.filter(id => !pacoteIdsSet.has(id));
          const aspiracoesDentroDosPacotes = pacoteIdsComAspiracao.filter(id => pacoteIdsSet.has(id));
          const { data: pacotesComAspiracaoData, error: pacotesComAspiracaoError } = await supabase
            .from('pacotes_aspiracao')
            .select('id, status')
            .in('id', pacoteIdsComAspiracao);
          const statusPacotesComAspiracao = (pacotesComAspiracaoData || []).reduce<Record<string, number>>((acc, p) => {
            const status = p.status || 'NULL';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          aspiracoesData.forEach((a) => {
            if (a.pacote_aspiracao_id) {
              quantidadePorPacote.set(a.pacote_aspiracao_id, (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1);
            }
          });
        }
      }

      // Load lotes para verificar quais pacotes já foram usados e para exibir
      const { data: lotesData, error: lotesError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .order('data_abertura', { ascending: false });

      if (lotesError) throw lotesError;

      // Filtrar pacotes que não foram usados (verificar campo usado_em_lote_fiv)
      // Se o campo não existir, verificar na tabela lotes_fiv como fallback
      const pacotesUsadosEmLotes = new Set(lotesData?.map((l) => l.pacote_aspiracao_id).filter((id): id is string => !!id) || []);
      
      const pacotesDisponiveis = (pacotesData || []).filter((p) => {
        // Priorizar o campo usado_em_lote_fiv se existir
        if (p.usado_em_lote_fiv !== undefined) {
          return !p.usado_em_lote_fiv;
        }
        // Fallback: verificar se está na tabela lotes_fiv
        return !pacotesUsadosEmLotes.has(p.id);
      });
      const quantidadeIds = new Set(quantidadePorPacote.keys());
      const pacotesDisponiveisIds = pacotesDisponiveis.map(p => p.id);
      const pacotesDisponiveisComAspiracoes = pacotesDisponiveisIds.filter(id => quantidadeIds.has(id));
      const pacotesDisponiveisSemAspiracoes = pacotesDisponiveisIds.filter(id => !quantidadeIds.has(id));
      const pacotesDisponiveisSemAspiracoesInfo = pacotesDisponiveisSemAspiracoes
        .slice(0, 5)
        .map((id) => {
          const pacote = (pacotesData || []).find(p => p.id === id);
          return {
            id,
            status: pacote?.status,
            data_aspiracao: pacote?.data_aspiracao,
            fazenda_id: pacote?.fazenda_id,
            usado_em_lote_fiv: pacote?.usado_em_lote_fiv,
            observacoes: pacote?.observacoes,
          };
        });
      const pacotesSemAspiracoesComObservacoes = await supabase
        .from('pacotes_aspiracao')
        .select('id, observacoes')
        .in('id', pacotesDisponiveisSemAspiracoes.slice(0, 20));
      const semAspiracoesDespachados = (pacotesSemAspiracoesComObservacoes.data || []).filter(p =>
        (p.observacoes || '').includes('Despachado do Lote FIV')
      ).length;
      const aspiracoesMesmoDiaFazenda = await Promise.all(
        pacotesDisponiveisSemAspiracoesInfo.map(async (pacote) => {
          if (!pacote.data_aspiracao || !pacote.fazenda_id) {
            return { pacote_id: pacote.id, total: 0, pacoteIdsEncontrados: [] as string[] };
          }
          const { data, error } = await supabase
            .from('aspiracoes_doadoras')
            .select('id, pacote_aspiracao_id')
            .eq('fazenda_id', pacote.fazenda_id)
            .eq('data_aspiracao', pacote.data_aspiracao);
          const pacoteIdsEncontrados = Array.from(
            new Set((data || []).map(a => a.pacote_aspiracao_id).filter(Boolean))
          ) as string[];
          return {
            pacote_id: pacote.id,
            total: (data || []).length,
            pacoteIdsEncontrados,
            error: error ? { code: error.code, message: error.message } : null,
          };
        })
      );
      const amostraPacotesDisponiveisComContagem = pacotesDisponiveisIds.slice(0, 5).map(id => ({
        id,
        quantidade_doadoras: quantidadePorPacote.get(id) || 0,
      }));

      const pacotesComNomes: PacoteComNomes[] = pacotesDisponiveis.map((p) => ({
        ...p,
        fazenda_nome: fazendasMap.get(p.fazenda_id),
        fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
        quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
      }));

      // Atualizar estado de pacotes
      setPacotes(pacotesComNomes);

      // Reutilizar lotesData carregado acima
      const lotesDataCompleta = lotesData || [];

      // Load acasalamentos para contar
      const loteIds = lotesDataCompleta?.map((l) => l.id) || [];
      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('lote_fiv_id')
        .in('lote_fiv_id', loteIds);

      if (acasalamentosError) throw acasalamentosError;

      const quantidadeAcasalamentosPorLote = new Map<string, number>();
      acasalamentosData?.forEach((a) => {
        quantidadeAcasalamentosPorLote.set(a.lote_fiv_id, (quantidadeAcasalamentosPorLote.get(a.lote_fiv_id) || 0) + 1);
      });

      // Load fazendas destino dos lotes
      const { data: fazendasDestinoLotesData, error: fazendasDestinoLotesError } = await supabase
        .from('lote_fiv_fazendas_destino')
        .select('lote_fiv_id, fazenda_id')
        .in('lote_fiv_id', loteIds);

      if (fazendasDestinoLotesError) throw fazendasDestinoLotesError;

      const fazendasDestinoPorLote = new Map<string, string[]>();
      fazendasDestinoLotesData?.forEach((fd) => {
        const nome = fazendasMap.get(fd.fazenda_id);
        if (nome) {
          const atual = fazendasDestinoPorLote.get(fd.lote_fiv_id) || [];
          atual.push(nome);
          fazendasDestinoPorLote.set(fd.lote_fiv_id, atual);
        }
      });

      const pacotesMap = new Map(pacotesComNomes.map((p) => [p.id, p]));
      // Também incluir pacotes usados no mapa para exibir nos lotes
      const todosPacotesData = pacotesData || [];
      todosPacotesData.forEach((p) => {
        if (!pacotesMap.has(p.id)) {
          pacotesMap.set(p.id, {
            ...p,
            fazenda_nome: fazendasMap.get(p.fazenda_id),
            fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
            quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
          });
        }
      });

      const lotesComNomes: LoteFIVComNomes[] = (lotesDataCompleta || []).map((l) => {
        const pacote = pacotesMap.get(l.pacote_aspiracao_id);
        // Calcular dia atual baseado na data da aspiração (D-1)
        // Sempre usar a data da aspiração do pacote, nunca a data_abertura diretamente
        // Usar funções utilitárias que trabalham apenas com strings YYYY-MM-DD para evitar problemas de timezone
        let dataAspiracaoStr = extractDateOnly(pacote?.data_aspiracao || null);
        
        if (!dataAspiracaoStr) {
          // Se não tiver data da aspiração, calcular baseado na data_abertura (que é fecundação = aspiração + 1)
          const dataAberturaStr = extractDateOnly(l.data_abertura);
          if (dataAberturaStr) {
            // Voltar 1 dia para obter data da aspiração
            const [year, month, day] = dataAberturaStr.split('-').map(Number);
            const dataAberturaDate = new Date(year, month - 1, day);
            dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
            const yearStr = dataAberturaDate.getFullYear();
            const monthStr = String(dataAberturaDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dataAberturaDate.getDate()).padStart(2, '0');
            dataAspiracaoStr = `${yearStr}-${monthStr}-${dayStr}`;
          }
        }
        
        // Calcular diferença em dias: hoje - data da aspiração (D-1)
        // Lógica correta: D-1 = dia da aspiração, D0 = D-1 + 1 dia (fecundação), D7 = D-1 + 8 dias (transferência)
        // Exemplo: aspiração 05/01 (segunda) → D-1=05/01, D0=06/01 (terça, fecundação), D7=13/01 (terça, transferência)
        const hojeStr = getTodayDateString();
        const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(hojeStr, dataAspiracaoStr)) : 0;
        // diaAtual = 0 → D-1 (dia da aspiração)
        // diaAtual = 1 → D0 (dia da fecundação)
        // diaAtual = 8 → D7 (dia da transferência, pois D7 = D-1 + 8 dias)
        // diaAtual = 9 → D8 (emergência, último dia, pois D8 = D-1 + 9 dias)
        // diaAtual > 9 → Passou do D8 (lote não existe mais, será fechado e sumirá)

        return {
          ...l,
          pacote_nome: pacote?.fazenda_nome,
          pacote_data: pacote?.data_aspiracao,
          fazendas_destino_nomes: fazendasDestinoPorLote.get(l.id) || [],
          quantidade_acasalamentos: quantidadeAcasalamentosPorLote.get(l.id) || 0,
          dia_atual: diaAtual,
        };
      });

      // Fechar automaticamente lotes que passaram do D8 (dia_atual > 9)
      // Lógica ABSOLUTA: D7 = D-1 + 8 dias (transferência), D8 = D-1 + 9 dias (emergência)
      // D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV (não existe D9, D10, D11, etc.)
      // Se dia_atual = 8, estamos no D7. Se dia_atual = 9, estamos no D8. Se dia_atual > 9, passou do D8 (fechar e sumir)
      const lotesParaFechar = lotesComNomes.filter(l => 
        l.status === 'ABERTO' && l.dia_atual !== undefined && l.dia_atual > 9
      );

      if (lotesParaFechar.length > 0) {
        const lotesIdsParaFechar = lotesParaFechar.map(l => l.id);
        // Fechar lotes em background (não bloquear a UI)
        supabase
          .from('lotes_fiv')
          .update({ status: 'FECHADO' })
          .in('id', lotesIdsParaFechar)
          .then(({ error }) => {
            if (error) {
              // Fechamento automático falhou - lotes serão filtrados visualmente até próximo reload
              toast({
                title: 'Aviso',
                description: 'Não foi possível fechar automaticamente alguns lotes expirados. Recarregue a página.',
                variant: 'destructive',
              });
            }
          });
      }


      // Filtrar lotes: mostrar apenas os que estão até D8 (dia_atual <= 9)
      // D8 é o ÚLTIMO DIA. Lotes com dia_atual > 9 não existem mais (viram histórico e somem da lista)
      const lotesVisiveis = lotesComNomes.filter(l => {
        // Se o lote está FECHADO, não mostrar (vira histórico e some)
        if (l.status === 'FECHADO') {
          return false;
        }
        // Se o lote passou do D8 (dia_atual > 9), não mostrar (vira histórico e some)
        // Isso garante que mesmo se o fechamento automático falhar, o lote não aparecerá
        if (l.dia_atual !== undefined && l.dia_atual > 9) {
          return false;
        }
        // Se o lote está ABERTO, mostrar apenas se dia_atual <= 9 (até D8, que é o último dia)
        return l.dia_atual !== undefined && l.dia_atual <= 9;
      });
      const hojeStr = getTodayDateString();
      const hojeStrUtc = new Date().toISOString().slice(0, 10);
      const agoraLocalIso = new Date().toISOString();
      const agoraLocalString = new Date().toString();
      const tzOffsetMin = new Date().getTimezoneOffset();
      const amostraDias = lotesVisiveis.slice(0, 5).map(l => {
        const dataAberturaStr = extractDateOnly(l.data_abertura);
        const dataAspiracaoStr = extractDateOnly(l.pacote_data || null);
        const diaAbertura = dataAberturaStr ? Math.max(0, diffDays(hojeStr, dataAberturaStr)) : null;
        const diaAspiracao = dataAspiracaoStr ? Math.max(0, diffDays(hojeStr, dataAspiracaoStr)) : null;
        return {
          lote_id: l.id,
          data_abertura: dataAberturaStr,
          data_aspiracao: dataAspiracaoStr,
          dia_atual_aspiracao: diaAspiracao,
          dia_atual_abertura: diaAbertura,
        };
      });

      setLotes(lotesComNomes);
      // lotesFiltrados é computado automaticamente pelo hook useLotesFiltros
      
      // Armazenar pacotes únicos para o filtro (usar todos os pacotes, não apenas os disponíveis)
      // Pegar apenas os pacotes que têm lotes associados
      const pacotesComLotes = new Set(lotesComNomes.map(l => l.pacote_aspiracao_id).filter((id): id is string => !!id));
      const pacotesParaFiltroArray: PacoteComNomes[] = [];
      
      (pacotesData || []).forEach((p) => {
        if (pacotesComLotes.has(p.id)) {
          pacotesParaFiltroArray.push({
            ...p,
            fazenda_nome: fazendasMap.get(p.fazenda_id),
            fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
            quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
          });
        }
      });
      
      setPacotesParaFiltro(pacotesParaFiltroArray);
      
      // Extrair datas únicas de aspiração para o filtro
      const datasUnicas = new Set<string>();
      const fazendasUnicas = new Map<string, string>();
      
      pacotesParaFiltroArray.forEach((pacote) => {
        if (pacote.data_aspiracao) {
          const dataStr = pacote.data_aspiracao.split('T')[0];
          datasUnicas.add(dataStr);
        }
        if (pacote.fazenda_id && pacote.fazenda_nome) {
          fazendasUnicas.set(pacote.fazenda_id, pacote.fazenda_nome);
        }
      });
      
      setDatasAspiracaoUnicas(Array.from(datasUnicas).sort().reverse());
      setFazendasAspiracaoUnicas(
        Array.from(fazendasUnicas.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
      );
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadLotesHistoricos = async () => {
    try {
      setLoadingHistorico(true);
      setHistoricoPage(1);

      // Construir query com filtros
      let query = supabase
        .from('lotes_fiv')
        .select('*')
        .eq('status', 'FECHADO');

      // Aplicar filtro de data se fornecido
      if (filtroHistoricoDataInicio) {
        query = query.gte('data_abertura', filtroHistoricoDataInicio);
      }
      if (filtroHistoricoDataFim) {
        query = query.lte('data_abertura', filtroHistoricoDataFim);
      }

      const { data: lotesData, error: lotesError } = await query.order('data_abertura', { ascending: false });

      if (lotesError) throw lotesError;

      if (!lotesData || lotesData.length === 0) {
        setLotesHistoricos([]);
        setLoadingHistorico(false);
        return;
      }

      const loteIds = lotesData.map(l => l.id);
      
      const pacoteIds = [...new Set(lotesData.map(l => l.pacote_aspiracao_id).filter(Boolean))];

      // Buscar pacotes de aspiração
      const { data: pacotesData } = await supabase
        .from('pacotes_aspiracao')
        .select('id, data_aspiracao, fazenda_id, total_oocitos')
        .in('id', pacoteIds);

      // Buscar fazendas
      const { data: fazendasData } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      const fazendasMap = new Map(fazendasData?.map(f => [f.id, f.nome]) || []);
      
      // Criar lista de fazendas únicas para o filtro (se não existir)
      const fazendasUnicasParaFiltro = fazendasData?.map(f => ({ id: f.id, nome: f.nome })) || [];

      // Buscar acasalamentos
      const { data: acasalamentosData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, lote_fiv_id, quantidade_embrioes, aspiracao_doadora_id')
        .in('lote_fiv_id', loteIds);

      // Buscar embriões (incluindo status_atual para calcular transferidos, congelados, descartados)
      // IMPORTANTE: Buscar TODOS os embriões, não filtrar por status, para contar corretamente
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_id, lote_fiv_acasalamento_id, classificacao, status_atual')
        .in('lote_fiv_id', loteIds);

      if (embrioesError) {
        toast({
          title: 'Erro ao buscar embriões',
          description: embrioesError.message,
          variant: 'destructive',
        });
      }

      // Buscar fazendas destino dos lotes
      const { data: fazendasDestinoData } = await supabase
        .from('lote_fiv_fazendas_destino')
        .select('lote_fiv_id, fazenda_id')
        .in('lote_fiv_id', loteIds);

      // Buscar aspirações para calcular oocitos viáveis
      const aspiracaoIds = [...new Set(acasalamentosData?.map(a => a.aspiracao_doadora_id).filter(Boolean) || [])];
      const { data: aspiracoesData } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, viaveis')
        .in('id', aspiracaoIds);

      // Criar mapas auxiliares
      const pacotesMap = new Map(pacotesData?.map(p => [p.id, p]) || []);
      const acasalamentosPorLote = new Map<string, typeof acasalamentosData>();
      const embrioesPorLote = new Map<string, typeof embrioesData>();
      const fazendasDestinoPorLote = new Map<string, string[]>();
      const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);

      acasalamentosData?.forEach(a => {
        if (!acasalamentosPorLote.has(a.lote_fiv_id)) {
          acasalamentosPorLote.set(a.lote_fiv_id, []);
        }
        acasalamentosPorLote.get(a.lote_fiv_id)!.push(a);
      });

      if (embrioesData && embrioesData.length > 0) {
        embrioesData.forEach(e => {
          if (!e.lote_fiv_id) {
            return;
          }
          if (!embrioesPorLote.has(e.lote_fiv_id)) {
            embrioesPorLote.set(e.lote_fiv_id, []);
          }
          embrioesPorLote.get(e.lote_fiv_id)!.push(e);
        });
      }

      fazendasDestinoData?.forEach(fd => {
        if (!fazendasDestinoPorLote.has(fd.lote_fiv_id)) {
          fazendasDestinoPorLote.set(fd.lote_fiv_id, []);
        }
        const nome = fazendasMap.get(fd.fazenda_id);
        if (nome) {
          fazendasDestinoPorLote.get(fd.lote_fiv_id)!.push(nome);
        }
      });

      // Montar resumo dos lotes históricos
      let historicos: LoteHistorico[] = lotesData.map(lote => {
        const pacote = pacotesMap.get(lote.pacote_aspiracao_id);
        const acasalamentos = acasalamentosPorLote.get(lote.id) || [];
        const embrioes = embrioesPorLote.get(lote.id) || [];
        const fazendasDestino = fazendasDestinoPorLote.get(lote.id) || [];

        // Calcular total de embriões (contagem real dos embriões, não da quantidade dos acasalamentos)
        const totalEmbrioes = embrioes.length;

        // Calcular embriões por status
        const totalTransferidos = embrioes.filter(e => e.status_atual === 'TRANSFERIDO').length;
        const totalCongelados = embrioes.filter(e => e.status_atual === 'CONGELADO').length;
        const totalDescartados = embrioes.filter(e => e.status_atual === 'DESCARTADO').length;

        // Calcular embriões por classificação
        const embrioesPorClassificacao: Record<string, number> = {};
        embrioes.forEach(e => {
          if (e.classificacao) {
            embrioesPorClassificacao[e.classificacao] = (embrioesPorClassificacao[e.classificacao] || 0) + 1;
          } else {
            embrioesPorClassificacao['sem_classificacao'] = (embrioesPorClassificacao['sem_classificacao'] || 0) + 1;
          }
        });

        // Calcular total de oócitos viáveis
        let totalViaveis = 0;
        acasalamentos.forEach(a => {
          if (a.aspiracao_doadora_id) {
            const aspiracao = aspiracoesMap.get(a.aspiracao_doadora_id);
            if (aspiracao?.viaveis) {
              totalViaveis += aspiracao.viaveis;
            }
          }
        });

        return {
          id: lote.id,
          data_abertura: lote.data_abertura,
          status: lote.status,
          observacoes: lote.observacoes,
          pacote_aspiracao_id: lote.pacote_aspiracao_id,
          pacote_data: pacote?.data_aspiracao,
          pacote_nome: fazendasMap.get(pacote?.fazenda_id || ''),
          fazenda_origem_nome: fazendasMap.get(pacote?.fazenda_id || ''),
          fazendas_destino_nomes: fazendasDestino,
          quantidade_acasalamentos: acasalamentos.length,
          total_embrioes_produzidos: totalEmbrioes,
          total_embrioes_transferidos: totalTransferidos,
          total_embrioes_congelados: totalCongelados,
          total_embrioes_descartados: totalDescartados,
          embrioes_por_classificacao: {
            BE: embrioesPorClassificacao['BE'],
            BN: embrioesPorClassificacao['BN'],
            BX: embrioesPorClassificacao['BX'],
            BL: embrioesPorClassificacao['BL'],
            BI: embrioesPorClassificacao['BI'],
            sem_classificacao: embrioesPorClassificacao['sem_classificacao'],
          },
          total_oocitos: pacote?.total_oocitos,
          total_viaveis: totalViaveis > 0 ? totalViaveis : undefined,
        };
      });

      // Aplicar filtro de fazenda de origem se fornecido
      if (filtroHistoricoFazenda) {
        // Buscar o nome da fazenda selecionada
        const fazendaSelecionada = fazendasUnicasParaFiltro.find(f => f.id === filtroHistoricoFazenda);
        if (fazendaSelecionada) {
          historicos = historicos.filter(lote => 
            lote.fazenda_origem_nome === fazendaSelecionada.nome
          );
        }
      }

      setLotesHistoricos(historicos);
    } catch (error) {
      handleError(error, 'Erro ao carregar histórico');
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadDetalhesLoteHistorico = async (loteId: string) => {
    try {
      setLoadingDetalhes(true);

      // Buscar o lote histórico
      const lote = lotesHistoricos.find(l => l.id === loteId);
      if (!lote) {
        toast({
          title: 'Erro',
          description: 'Lote não encontrado',
          variant: 'destructive',
        });
        return;
      }

      // Buscar pacote de aspiração completo
      const { data: pacoteData } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', lote.pacote_aspiracao_id)
        .single();

      // Buscar acasalamentos completos
      const { data: acasalamentosData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      // Buscar embriões completos
      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      // Buscar informações das doadoras e aspirações
      const aspiracaoIds = [...new Set(acasalamentosData?.map(a => a.aspiracao_doadora_id).filter(Boolean) || [])];
      const { data: aspiracoesData } = await supabase
        .from('aspiracoes_doadoras')
        .select('*, doadora:doadoras(id, registro, nome)')
        .in('id', aspiracaoIds);

      // Buscar informações das doses de sêmen (com informações do touro)
      const doseIds = [...new Set(acasalamentosData?.map(a => a.dose_semen_id).filter(Boolean) || [])];
      const { data: dosesData } = await supabase
        .from('doses_semen')
        .select(`
          *,
          cliente:clientes(nome),
          touro:touros(id, nome, registro, raca)
        `)
        .in('id', doseIds);

      // Criar mapas auxiliares
      const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);
      const dosesMap = new Map(dosesData?.map(d => [d.id, d]) || []);

      // Agrupar embriões por acasalamento e calcular estatísticas
      const embrioesPorAcasalamento = new Map<string, {
        total: number;
        porStatus: { [status: string]: number };
        porClassificacao: { [classificacao: string]: number };
      }>();

      (embrioesData || []).forEach(embriao => {
        const acasalamentoId = embriao.lote_fiv_acasalamento_id || 'sem_acasalamento';
        if (!embrioesPorAcasalamento.has(acasalamentoId)) {
          embrioesPorAcasalamento.set(acasalamentoId, {
            total: 0,
            porStatus: {},
            porClassificacao: {},
          });
        }
        const stats = embrioesPorAcasalamento.get(acasalamentoId)!;
        stats.total++;
        
        // Contar por status
        const status = embriao.status_atual || 'sem_status';
        stats.porStatus[status] = (stats.porStatus[status] || 0) + 1;
        
        // Contar por classificação
        const classificacao = embriao.classificacao || 'sem_classificacao';
        stats.porClassificacao[classificacao] = (stats.porClassificacao[classificacao] || 0) + 1;
      });

      // Montar detalhes completos
      const detalhes: DetalhesLoteHistorico = {
        lote,
        pacote: pacoteData ? {
          id: pacoteData.id,
          data_aspiracao: pacoteData.data_aspiracao,
          horario_inicio: pacoteData.horario_inicio,
          horario_final: pacoteData.horario_final,
          veterinario_responsavel: pacoteData.veterinario_responsavel,
          tecnico_responsavel: pacoteData.tecnico_responsavel,
          total_oocitos: pacoteData.total_oocitos,
          observacoes: pacoteData.observacoes,
        } : undefined,
        acasalamentos: (acasalamentosData || []).map(acasalamento => {
          const aspiracao = acasalamento.aspiracao_doadora_id ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id) : null;
          const dose = acasalamento.dose_semen_id ? dosesMap.get(acasalamento.dose_semen_id) : null;
          const doadora = aspiracao?.doadora;
          const statsEmbrioes = embrioesPorAcasalamento.get(acasalamento.id) || {
            total: 0,
            porStatus: {},
            porClassificacao: {},
          };

          return {
            id: acasalamento.id,
            aspiracao_id: acasalamento.aspiracao_doadora_id, // Adicionar ID da aspiração para comparação
            doadora: doadora ? {
              registro: doadora.registro,
              nome: doadora.nome,
            } : undefined,
            aspiracao: aspiracao ? {
              data_aspiracao: aspiracao.data_aspiracao,
              horario_aspiracao: aspiracao.horario_aspiracao,
              viaveis: aspiracao.viaveis,
              expandidos: aspiracao.expandidos,
              total_oocitos: aspiracao.total_oocitos,
              atresicos: aspiracao.atresicos,
              degenerados: aspiracao.degenerados,
              desnudos: aspiracao.desnudos,
              veterinario_responsavel: aspiracao.veterinario_responsavel,
            } : undefined,
            dose_semen: dose ? {
              nome: dose.touro?.nome || 'Touro desconhecido',
              registro: dose.touro?.registro,
              raca: dose.touro?.raca || dose.raca,
              tipo_semen: dose.tipo_semen,
              cliente: dose.cliente?.nome,
            } : undefined,
            quantidade_fracionada: acasalamento.quantidade_fracionada,
            quantidade_oocitos: acasalamento.quantidade_oocitos,
            quantidade_embrioes: acasalamento.quantidade_embrioes,
            observacoes: acasalamento.observacoes,
            resumo_embrioes: statsEmbrioes,
          };
        }),
        embrioes: (embrioesData || []).map(embriao => ({
          id: embriao.id,
          identificacao: embriao.identificacao,
          classificacao: embriao.classificacao,
          tipo_embriao: embriao.tipo_embriao,
          status_atual: embriao.status_atual,
          acasalamento_id: embriao.lote_fiv_acasalamento_id,
        })),
      };

      setDetalhesLoteExpandido(detalhes);
    } catch (error) {
      handleError(error, 'Erro ao carregar detalhes');
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const handleExpandirLote = async (loteId: string) => {
    if (loteExpandido === loteId) {
      // Recolher
      setLoteExpandido(null);
      setDetalhesLoteExpandido(null);
    } else {
      // Expandir
      setLoteExpandido(loteId);
      await loadDetalhesLoteHistorico(loteId);
    }
  };

  const loadLoteDetail = async (loteId: string) => {
    try {
      setLoading(true);

      // Load lote
      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .eq('id', loteId)
        .single();

      if (loteError) {
        throw loteError;
      }

      // Load pacote
      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', loteData.pacote_aspiracao_id)
        .single();

      if (pacoteError) {
        if (pacoteError.code === 'PGRST116') {
          toast({
            title: 'Pacote não encontrado',
            description: 'O lote referencia um pacote de aspiração inexistente. Verifique o vínculo do lote.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        throw pacoteError;
      }

      // Armazenar data da aspiração para cálculo de dias (D-1)
      setDataAspiracao(pacoteData.data_aspiracao);

      // Load fazenda origem
      const { data: fazendaOrigemData, error: fazendaOrigemError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', pacoteData.fazenda_id)
        .single();

      if (fazendaOrigemError) {
        setFazendaOrigemNome('');
      } else {
        setFazendaOrigemNome(fazendaOrigemData?.nome || '');
      }

      // Load fazendas destino
      const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('fazenda_destino_id')
        .eq('pacote_aspiracao_id', pacoteData.id);

      // Continua mesmo com erro

      // Se não houver na tabela de relacionamento, usar a fazenda_destino_id legacy
      let fazendaDestinoIdsArray: string[] = [];
      if (!fazendasDestinoData || fazendasDestinoData.length === 0) {
        if (pacoteData.fazenda_destino_id) {
          fazendaDestinoIdsArray = [pacoteData.fazenda_destino_id];
        }
      } else {
        fazendaDestinoIdsArray = fazendasDestinoData.map((item) => item.fazenda_destino_id);
      }
      setFazendasDestinoIds(fazendaDestinoIdsArray);

      if (fazendaDestinoIdsArray.length > 0) {
        const { data: fazendasDestinoNomesData, error: fazendasDestinoNomesError } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaDestinoIdsArray);

        if (fazendasDestinoNomesError) {
          setFazendasDestinoNomes([]);
        } else {
          setFazendasDestinoNomes(fazendasDestinoNomesData?.map((f) => f.nome) || []);
          // Garantir que as fazendas destino estejam na lista de fazendas disponíveis
          if (fazendasDestinoNomesData) {
            const fazendasAtualizadas = [...fazendas];
            fazendasDestinoNomesData.forEach(f => {
              if (!fazendasAtualizadas.find(fa => fa.id === f.id)) {
                fazendasAtualizadas.push(f);
              }
            });
            setFazendas(fazendasAtualizadas);
          }
        }
      } else {
        setFazendasDestinoNomes([]);
      }

      // Load acasalamentos
      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      if (acasalamentosError) throw acasalamentosError;

      // Load aspirações doadoras
      const aspiracaoIds = acasalamentosData?.map((a) => a.aspiracao_doadora_id) || [];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .in('id', aspiracaoIds);

      if (aspiracoesError) throw aspiracoesError;

      // Load doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, nome, registro')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      // Load doses (com informações do touro)
      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select(`
          id,
          touro_id,
          touro:touros(id, nome, registro, raca)
        `)
        .in('id', doseIds);

      if (dosesError) throw dosesError;

      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d]));
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d]));
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]));

      // Buscar embriões do lote para calcular a soma total por acasalamento
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('lote_fiv_acasalamento_id')
        .eq('lote_fiv_id', loteId);

      // Contar embriões por acasalamento
      const quantidadeEmbrioesPorAcasalamento = new Map<string, number>();
      if (!embrioesError && embrioesData) {
        embrioesData.forEach(embriao => {
          if (embriao.lote_fiv_acasalamento_id) {
            quantidadeEmbrioesPorAcasalamento.set(
              embriao.lote_fiv_acasalamento_id,
              (quantidadeEmbrioesPorAcasalamento.get(embriao.lote_fiv_acasalamento_id) || 0) + 1
            );
          }
        });
      }

      const acasalamentosComNomes: AcasalamentoComNomes[] = (acasalamentosData || []).map((a) => {
        const aspiracao = aspiracoesMap.get(a.aspiracao_doadora_id);
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = dosesMap.get(a.dose_semen_id);
        const touro = dose?.touro ?? null;

        return {
          ...a,
          doadora_nome: doadora?.nome || doadora?.registro,
          doadora_registro: doadora?.registro,
          dose_nome: touro?.nome || 'Touro desconhecido',
          viaveis: aspiracao?.viaveis,
          total_embrioes_produzidos: quantidadeEmbrioesPorAcasalamento.get(a.id) || 0,
        };
      });

      setAcasalamentos(acasalamentosComNomes);
      setSelectedLote({
        ...loteData,
        pacote_nome: pacoteData.fazenda_id,
        pacote_data: pacoteData.data_aspiracao,
      } as LoteFIVComNomes);
      setShowLoteDetail(true);

      // Carregar todas as aspirações do pacote (para usar no dialog de adicionar acasalamento)
      const { data: todasAspiracoesData, error: todasAspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', loteData.pacote_aspiracao_id);

      if (!todasAspiracoesError) {
        // Calcular oócitos já usados por aspiração
        const oocitosUsadosPorAspiracao = new Map<string, number>();
        acasalamentosData?.forEach((acasalamento) => {
          const aspiracaoId = acasalamento.aspiracao_doadora_id;
          const oocitosUsados = acasalamento.quantidade_oocitos || 0;
          oocitosUsadosPorAspiracao.set(
            aspiracaoId,
            (oocitosUsadosPorAspiracao.get(aspiracaoId) || 0) + oocitosUsados
          );
        });

        // Filtrar aspirações que têm oócitos viáveis > 0 E ainda têm oócitos disponíveis
        const aspiracoesDisponiveis = (todasAspiracoesData || []).filter((a) => {
          const oocitosTotal = a.viaveis ?? 0;
          const oocitosUsados = oocitosUsadosPorAspiracao.get(a.id) || 0;
          const oocitosDisponiveis = oocitosTotal - oocitosUsados;
          return oocitosTotal > 0 && oocitosDisponiveis > 0;
        });

        // Adicionar informação de oócitos disponíveis a cada aspiração
        const aspiracoesComOocitosDisponiveis = aspiracoesDisponiveis.map((a) => ({
          ...a,
          oocitos_disponiveis: (a.viaveis ?? 0) - (oocitosUsadosPorAspiracao.get(a.id) || 0),
        }));

        setAspiracoesDisponiveis(aspiracoesComOocitosDisponiveis);

        // Carregar todas as doadoras do pacote para exibir no select
        const todasDoadoraIds = [...new Set(todasAspiracoesData?.map((a) => a.doadora_id) || [])];
        if (todasDoadoraIds.length > 0) {
          const { data: todasDoadorasData, error: todasDoadorasError } = await supabase
            .from('doadoras')
            .select('id, nome, registro')
            .in('id', todasDoadoraIds);

          if (!todasDoadorasError && todasDoadorasData) {
            setDoadoras(todasDoadorasData);
          }
        }
      }

      // Load doses disponíveis do lote (agora com informações do touro)
      const { data: dosesDisponiveisData, error: dosesDisponiveisError } = await supabase
        .from('doses_semen')
        .select(`
          id,
          touro_id,
          cliente_id,
          tipo_semen,
          quantidade,
          touro:touros(id, nome, registro, raca)
        `)
        .order('created_at', { ascending: false });

      if (dosesDisponiveisError) {
        setDosesDisponiveis([]);
      } else {
        // Se o lote tem doses selecionadas, filtrar por elas, senão mostrar todas
        // Tratar caso o campo não exista no banco ainda
        try {
        const dosesSelecionadas = loteData?.doses_selecionadas as string[] | undefined;
          if (dosesSelecionadas && Array.isArray(dosesSelecionadas) && dosesSelecionadas.length > 0) {
            setDosesDisponiveis(
              (dosesDisponiveisData || []).filter((d) => dosesSelecionadas.includes(d.id))
            );
          } else {
            setDosesDisponiveis(dosesDisponiveisData || []);
          }
        } catch {
          // Se o campo não existir, mostrar todas as doses
          setDosesDisponiveis(dosesDisponiveisData || []);
        }
      }

      // Load clientes para exibir nos selects
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (!clientesError) {
        setClientes(clientesData || []);
      }

      // Carregar histórico de despachos
      await loadHistoricoDespachos(loteId);

    } catch (error) {
      handleError(error, 'Erro ao carregar detalhes do lote');
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico de despachos do lote
  const loadHistoricoDespachos = async (loteId: string) => {
    try {
      // Os embriões estão no mesmo lote FIV, então vamos buscar todos os embriões do lote
      // e agrupar por data de criação (assumindo que embriões criados na mesma data foram despachados juntos)
      const { data: todosEmbrioes, error: embrioesError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id, created_at')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: false });

      if (embrioesError) {
        setHistoricoDespachos([]);
        return;
      }

      // Agrupar embriões por data de criação (data do despacho)
      const embrioesPorData = new Map<string, typeof todosEmbrioes>();
      
      todosEmbrioes?.forEach(embriao => {
        if (embriao.created_at) {
          const dataDespacho = embriao.created_at.split('T')[0];
          const lista = embrioesPorData.get(dataDespacho) || [];
          lista.push(embriao);
          embrioesPorData.set(dataDespacho, lista);
        }
      });

      // Buscar todos os acasalamentos do lote com dados de doadora e dose
      const acasalamentoIdsUnicos = [...new Set(todosEmbrioes?.map(e => e.lote_fiv_acasalamento_id).filter(Boolean) || [])] as string[];
      
      if (acasalamentoIdsUnicos.length > 0) {
        // Buscar acasalamentos
        const { data: acasalamentosData, error: acasalamentosError } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIdsUnicos);

        if (!acasalamentosError && acasalamentosData) {
          // Buscar aspirações e doadoras
          const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))] as string[];
          const { data: aspiracoesData } = await supabase
            .from('aspiracoes_doadoras')
            .select('id, doadora_id')
            .in('id', aspiracaoIds);

          const doadoraIds = [...new Set(aspiracoesData?.map(a => a.doadora_id).filter(Boolean) || [])] as string[];
          const { data: doadorasData } = await supabase
            .from('doadoras')
            .select('id, registro, nome')
            .in('id', doadoraIds);

          // Buscar doses (com informações do touro)
          const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))] as string[];
          const { data: dosesData } = await supabase
            .from('doses_semen')
            .select(`
              id,
              touro_id,
              touro:touros(id, nome, registro, raca)
            `)
            .in('id', doseIds);

          // Criar maps para busca rápida
          const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);
          const doadorasMap = new Map(doadorasData?.map(d => [d.id, d]) || []);
          const dosesMap = new Map(dosesData?.map(d => [d.id, d]) || []);
          const acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));

      // Criar histórico baseado apenas nos embriões do lote (sem pacote de despacho)
      const datasDespacho = Array.from(embrioesPorData.keys()).sort((a, b) => b.localeCompare(a));
      const historico = datasDespacho.map((dataDespacho) => {
        const embrioesDesteDespacho = embrioesPorData.get(dataDespacho) || [];

        // Agrupar por acasalamento
        const quantidadePorAcasalamento = new Map<string, number>();

        embrioesDesteDespacho.forEach(e => {
          if (e.lote_fiv_acasalamento_id) {
            quantidadePorAcasalamento.set(
              e.lote_fiv_acasalamento_id,
              (quantidadePorAcasalamento.get(e.lote_fiv_acasalamento_id) || 0) + 1
            );
          }
        });

        const acasalamentosDespacho = Array.from(quantidadePorAcasalamento.entries()).map(([acasalamentoId, quantidade]) => {
          const acasalamento = acasalamentosMap.get(acasalamentoId);
          const aspiracao = acasalamento ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id) : undefined;
          const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
          const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;

          return {
            acasalamento_id: acasalamentoId,
            quantidade,
            doadora: doadora?.registro || doadora?.nome || '-',
            dose: dose ? (dose.touro?.nome || 'Touro desconhecido') : '-',
          };
        });

        return {
          id: `${loteId}-${dataDespacho}`,
          data_despacho: dataDespacho,
          acasalamentos: acasalamentosDespacho,
        };
      });

          setHistoricoDespachos(historico);
          return;
        }
      }

      // Se não houver acasalamentos, criar histórico vazio baseado nas datas encontradas
      const historico = Array.from(embrioesPorData.keys()).map((dataDespacho) => ({
        id: `${loteId}-${dataDespacho}`,
        data_despacho: dataDespacho,
        acasalamentos: [],
      }));

      setHistoricoDespachos(historico);
    } catch {
      setHistoricoDespachos([]);
    }
  };

  // Despachar embriões no D7
  const despacharEmbrioes = async () => {
    if (!selectedLote) return;

    try {
      setSubmitting(true);

      // Calcular dia atual para validar se ainda está no período permitido (até D8)
      // Lógica ABSOLUTA: D7 = D-1 + 8 dias (transferência), D8 = D-1 + 9 dias (emergência)
      // D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV
      // Se dia_atual = 8, estamos no D7. Se dia_atual = 9, estamos no D8. Se dia_atual > 9, passou do D8 (não existe mais)
      // Usar funções utilitárias que trabalham apenas com strings YYYY-MM-DD para evitar problemas de timezone
      const pacote = pacotes.find(p => p.id === selectedLote.pacote_aspiracao_id);
      let dataAspiracaoStr = extractDateOnly(pacote?.data_aspiracao || null);
      
      if (!dataAspiracaoStr) {
        const dataAberturaStr = extractDateOnly(selectedLote.data_abertura);
        if (dataAberturaStr) {
          // Voltar 1 dia para obter data da aspiração
          const [year, month, day] = dataAberturaStr.split('-').map(Number);
          const dataAberturaDate = new Date(year, month - 1, day);
          dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
          const yearStr = dataAberturaDate.getFullYear();
          const monthStr = String(dataAberturaDate.getMonth() + 1).padStart(2, '0');
          const dayStr = String(dataAberturaDate.getDate()).padStart(2, '0');
          dataAspiracaoStr = `${yearStr}-${monthStr}-${dayStr}`;
        }
      }
      
      const hojeStr = getTodayDateString();
      const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(hojeStr, dataAspiracaoStr)) : 0;

      // Validar que não passou do D8 (dia_atual > 9 significa que passou do D8, não existe mais lote FIV)
      if (diaAtual > 9) {
        toast({
          title: 'Prazo expirado',
          description: 'D8 é o último dia. Não é possível criar embriões após o D8. O lote será fechado e não aparecerá mais na lista.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      // Validar que há quantidades preenchidas e que não excedam os oócitos disponíveis
      const acasalamentosComQuantidade = acasalamentos.filter(ac => {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || ac.quantidade_embrioes?.toString() || '0');
        return quantidade > 0;
      });

      if (acasalamentosComQuantidade.length === 0) {
        toast({
          title: 'Nenhum embrião para despachar',
          description: 'Preencha a quantidade de embriões em pelo menos um acasalamento antes de despachar.',
          variant: 'destructive',
        });
        return;
      }

      // Validar que nenhum acasalamento tenha mais embriões do que oócitos disponíveis
      for (const ac of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || ac.quantidade_embrioes?.toString() || '0');
        const quantidadeOocitos = ac.quantidade_oocitos ?? 0;
        
        if (quantidade > quantidadeOocitos) {
          const doadoraNome = ac.doadora_nome || ac.doadora_registro || 'Doadora desconhecida';
          toast({
            title: 'Validação de quantidade',
            description: `O acasalamento da doadora "${doadoraNome}" possui ${quantidade} embriões, mas apenas ${quantidadeOocitos} oócitos foram usados. A quantidade de embriões não pode exceder a quantidade de oócitos disponíveis.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Criar nome do pacote: "Fazenda Origem - Fazendas Destino"
      const nomePacote = `${fazendaOrigemNome} - ${fazendasDestinoNomes.join(', ')}`;
      
      // Registrar data do despacho para o histórico (sem criar pacote novo)
      const dataDespacho = new Date().toISOString().split('T')[0];
      const despachoStartedAt = new Date().toISOString();

      // Validar fazendas destino configuradas
      if (!fazendasDestinoIds.length) {
        toast({
          title: 'Erro ao despachar',
          description: 'É necessário ter pelo menos uma fazenda destino configurada no lote.',
          variant: 'destructive',
        });
        return;
      }

      // Buscar sigla da fazenda de origem para gerar código de identificação
      let siglaFazenda = '';
      let prefixoIdentificacao = '';

      if (pacote?.fazenda_id) {
        const { data: fazendaOrigem, error: fazendaError } = await supabase
          .from('fazendas')
          .select('sigla')
          .eq('id', pacote.fazenda_id)
          .single();

        if (!fazendaError && fazendaOrigem?.sigla) {
          siglaFazenda = fazendaOrigem.sigla;
          // Formatar data como DDMM
          const dataAsp = dataAspiracaoStr || '';
          const ddmm = dataAsp.slice(8, 10) + dataAsp.slice(5, 7); // "2025-01-24" -> "2401"
          prefixoIdentificacao = `${siglaFazenda}-${ddmm}`;
        }
      }

      // Se não tem sigla, continuar sem código de identificação

      // Buscar próximo número sequencial se temos prefixo
      let proximoNumero = 1;
      if (prefixoIdentificacao) {
        const { count, error: countError } = await supabase
          .from('embrioes')
          .select('*', { count: 'exact', head: true })
          .like('identificacao', `${prefixoIdentificacao}-%`);

        if (!countError && count !== null) {
          proximoNumero = count + 1;
        }
      }

      // Criar embriões no pacote
      const embrioesParaCriar: Array<{
        lote_fiv_id: string;
        lote_fiv_acasalamento_id: string;
        status_atual: string;
        identificacao?: string;
      }> = [];
      const acasalamentosDespachados: Array<{ acasalamento_id: string; quantidade: number; doadora?: string; dose?: string }> = [];

      let contadorEmbriao = 0;
      for (const acasalamento of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || acasalamento.quantidade_embrioes?.toString() || '0');

        if (quantidade > 0) {
          // Criar embriões com código de identificação
          for (let i = 0; i < quantidade; i++) {
            const embriao: {
              lote_fiv_id: string;
              lote_fiv_acasalamento_id: string;
              status_atual: string;
              identificacao?: string;
            } = {
              lote_fiv_id: selectedLote.id,
              lote_fiv_acasalamento_id: acasalamento.id,
              status_atual: 'FRESCO',
            };

            // Adicionar identificação se temos prefixo
            if (prefixoIdentificacao) {
              const numeroStr = String(proximoNumero + contadorEmbriao).padStart(3, '0');
              embriao.identificacao = `${prefixoIdentificacao}-${numeroStr}`;
            }

            embrioesParaCriar.push(embriao);
            contadorEmbriao++;
          }

          acasalamentosDespachados.push({
            acasalamento_id: acasalamento.id,
            quantidade,
            doadora: acasalamento.doadora_registro || acasalamento.doadora_nome,
            dose: acasalamento.dose_nome,
          });
        }
      }

      if (embrioesParaCriar.length > 0) {
        const { error: embrioesError } = await supabase
          .from('embrioes')
          .insert(embrioesParaCriar);

        if (embrioesError) {
          throw embrioesError;
        }
      }

      // Registrar histórico de despacho (sem pacote de despacho)
      const historicoDespacho = {
        id: `${selectedLote.id}-${dataDespacho}`,
        data_despacho: dataDespacho,
        acasalamentos: acasalamentosDespachados,
      };

      setHistoricoDespachos([historicoDespacho, ...historicoDespachos]);

      // Zerar quantidade_embrioes nos acasalamentos
      const updates = acasalamentosComQuantidade.map(ac => 
        supabase
          .from('lote_fiv_acasalamentos')
          .update({ quantidade_embrioes: null })
          .eq('id', ac.id)
      );

      await Promise.all(updates);

      const { data: pacotesDespachoCheck, error: pacotesDespachoCheckError } = await supabase
        .from('pacotes_aspiracao')
        .select('id, data_aspiracao, created_at')
        .like('observacoes', `%Lote FIV ${selectedLote.id.slice(0, 8)}%`)
        .eq('data_aspiracao', dataDespacho)
        .gte('created_at', despachoStartedAt);

      // Limpar campos de edição
      setEditQuantidadeEmbrioes({});

      toast({
        title: 'Embriões despachados',
        description: `${embrioesParaCriar.length} embrião(ões) foram despachados para ${nomePacote}.`,
      });

      loadLoteDetail(selectedLote.id);
    } catch (error) {
      toast({
        title: 'Erro ao despachar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // handlePacoteChange movido para NovoLoteDialog

  const handleAddAcasalamento = async (formData: AcasalamentoForm) => {
    if (!selectedLote) return;

    const quantidadeFracionada = parseFloat(formData.quantidade_fracionada) || 0;

    try {
      setSubmitting(true);

      // Buscar aspiração selecionada para obter oócitos disponíveis
      const aspiracaoSelecionada = aspiracoesDisponiveis.find(
        (a) => a.id === formData.aspiracao_doadora_id
      );
      const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;

      // Validar quantidade de oócitos
      const quantidadeOocitos = parseInt(formData.quantidade_oocitos) || 0;

      if (quantidadeOocitos > oocitosDisponiveis) {
        toast({
          title: 'Erro de validação',
          description: `A quantidade de oócitos (${quantidadeOocitos}) não pode ser maior que os oócitos disponíveis (${oocitosDisponiveis})`,
          variant: 'destructive',
        });
        throw new Error('Validação falhou');
      }

      const { data: doseAtual, error: doseAtualError } = await supabase
        .from('doses_semen')
        .select('id, quantidade')
        .eq('id', formData.dose_semen_id)
        .single();
      if (doseAtualError) throw doseAtualError;

      const quantidadeDisponivel = doseAtual?.quantidade ?? 0;
      if (quantidadeDisponivel < quantidadeFracionada) {
        toast({
          title: 'Estoque insuficiente',
          description: `Quantidade disponível (${quantidadeDisponivel}) é menor que a quantidade fracionada (${quantidadeFracionada}).`,
          variant: 'destructive',
        });
        throw new Error('Estoque insuficiente');
      }

      // Criar acasalamento
      const acasalamentoParaInserir = {
        lote_fiv_id: selectedLote.id,
        aspiracao_doadora_id: formData.aspiracao_doadora_id,
        dose_semen_id: formData.dose_semen_id,
        quantidade_fracionada: quantidadeFracionada,
        quantidade_oocitos: quantidadeOocitos > 0 ? quantidadeOocitos : null,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase.from('lote_fiv_acasalamentos').insert([acasalamentoParaInserir]);

      if (error) throw error;

      const novaQuantidade = quantidadeDisponivel - quantidadeFracionada;
      const { error: doseUpdateError } = await supabase
        .from('doses_semen')
        .update({ quantidade: novaQuantidade })
        .eq('id', doseAtual?.id || '');
      if (doseUpdateError) throw doseUpdateError;

      toast({
        title: 'Acasalamento adicionado',
        description: 'Acasalamento adicionado com sucesso',
      });

      // Recarregar detalhes do lote
      await loadLoteDetail(selectedLote.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (!errorMessage.includes('Validação') && !errorMessage.includes('Estoque')) {
        toast({
          title: 'Erro ao adicionar acasalamento',
          description: errorMessage.includes('RLS') || errorMessage.includes('policy')
            ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
            : errorMessage,
          variant: 'destructive',
        });
      }
      throw error; // Re-throw para o componente filho saber que falhou
    } finally {
      setSubmitting(false);
    }
  };

  // handleSubmit movido para NovoLoteDialog

  if (loading && !selectedLote) {
    return <LoadingSpinner />;
  }

  // Se estiver visualizando um lote específico
  if (selectedLote && showLoteDetail) {
    return (
      <LoteDetailView
        lote={selectedLote}
        acasalamentos={acasalamentos}
        aspiracoesDisponiveis={aspiracoesDisponiveis}
        dosesDisponiveis={dosesDisponiveis}
        dosesDisponiveisNoLote={dosesDisponiveisNoLote}
        doadoras={doadoras}
        clientes={clientes}
        historicoDespachos={historicoDespachos}
        dataAspiracao={dataAspiracao}
        fazendaOrigemNome={fazendaOrigemNome}
        fazendasDestinoNomes={fazendasDestinoNomes}
        submitting={submitting}
        onBack={() => {
          setShowLoteDetail(false);
          setSelectedLote(null);
        }}
        onAddAcasalamento={handleAddAcasalamento}
        onDespacharEmbrioes={despacharEmbrioes}
        onUpdateQuantidadeEmbrioes={(acasalamentoId, quantidade) => {
          setEditQuantidadeEmbrioes({
            ...editQuantidadeEmbrioes,
            [acasalamentoId]: quantidade,
          });
        }}
        editQuantidadeEmbrioes={editQuantidadeEmbrioes}
      />
    );
  }

  // Lista de lotes
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes FIV"
        description="Gerenciar lotes de fecundação in vitro"
        actions={
          <NovoLoteDialog
            pacotes={pacotes}
            clientes={clientes}
            fazendas={fazendas}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={abaAtiva} onValueChange={(value) => setAbaAtiva(value as 'ativos' | 'historico')}>
            <TabsList className="mb-6">
              <TabsTrigger value="ativos">Lotes Ativos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="ativos" className="mt-0">
          {/* Filtros */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[250px] relative fazenda-busca-container">
              <Label htmlFor="filtro-fazenda-aspiração">Filtrar por Fazenda da Aspiração</Label>
              <div className="relative">
                <Input
                  id="filtro-fazenda-aspiração"
                  placeholder="Digite para buscar fazenda..."
                  value={filtroFazendaAspiracaoBusca}
                  onChange={(e) => {
                    setFiltroFazendaAspiracaoBusca(e.target.value);
                    setShowFazendaBusca(true);
                    if (!e.target.value) {
                      setFiltroFazendaAspiracao('');
                    }
                  }}
                  onFocus={() => setShowFazendaBusca(true)}
                />
                {filtroFazendaAspiracao && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => {
                      setFiltroFazendaAspiracao('');
                      setFiltroFazendaAspiracaoBusca('');
                      setShowFazendaBusca(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {showFazendaBusca && fazendasFiltradas.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {fazendasFiltradas.map((fazenda) => (
                      <div
                        key={fazenda.id}
                        className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                        onClick={() => {
                          setFiltroFazendaAspiracao(fazenda.id);
                          setFiltroFazendaAspiracaoBusca(fazenda.nome);
                          setShowFazendaBusca(false);
                        }}
                      >
                        {fazenda.nome}
                      </div>
                    ))}
                  </div>
                )}
                {showFazendaBusca && filtroFazendaAspiracaoBusca && fazendasFiltradas.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-sm text-slate-500">
                    Nenhuma fazenda encontrada
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="filtro-dia-cultivo">Filtrar por Dia do Cultivo</Label>
              <Select 
                value={filtroDiaCultivo || undefined} 
                onValueChange={(value) => setFiltroDiaCultivo(value || '')}
              >
                <SelectTrigger id="filtro-dia-cultivo">
                  <SelectValue placeholder="Todos os dias" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((dia) => (
                    <SelectItem key={dia} value={dia.toString()}>
                      D{dia} - {getNomeDia(dia)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filtroFazendaAspiracao || filtroDiaCultivo) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={limparFiltrosAtivos}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>

          {lotesFiltrados.length === 0 ? (
            <EmptyState
              title={lotes.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote encontrado'}
              description={
                lotes.length === 0
                  ? 'Crie um novo lote para começar.'
                  : 'Ajuste os filtros para encontrar outros lotes.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aspiração</TableHead>
                  <TableHead>Fazendas Destino</TableHead>
                  <TableHead>Dia do Cultivo</TableHead>
                  <TableHead>Acasalamentos</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotesFiltrados.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell>
                      {lote.pacote_data && formatDate(lote.pacote_data)} - {lote.pacote_nome}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0 ? (
                          lote.fazendas_destino_nomes.map((nome, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nome}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lote.dia_atual !== undefined ? (
                        <Badge 
                          variant="outline" 
                          className={`font-semibold ${getCorDia(lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1))}`}
                        >
                          {(() => {
                            const diaCultivo = lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1);
                            return diaCultivo === -1 
                              ? `D-1 - ${getNomeDia(diaCultivo)}`
                              : `D${diaCultivo} - ${getNomeDia(diaCultivo)}`;
                          })()}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{lote.quantidade_acasalamentos ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/lotes-fiv/${lote.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            <LotesHistoricoTab
              lotesHistoricos={lotesHistoricos}
              fazendas={fazendas}
              detalhesLoteExpandido={detalhesLoteExpandido}
              loteExpandido={loteExpandido}
              loadingHistorico={loadingHistorico}
              loadingDetalhes={loadingDetalhes}
              filtroHistoricoDataInicio={filtroHistoricoDataInicio}
              setFiltroHistoricoDataInicio={setFiltroHistoricoDataInicio}
              filtroHistoricoDataFim={filtroHistoricoDataFim}
              setFiltroHistoricoDataFim={setFiltroHistoricoDataFim}
              filtroHistoricoFazenda={filtroHistoricoFazenda}
              setFiltroHistoricoFazenda={setFiltroHistoricoFazenda}
              filtroHistoricoFazendaBusca={filtroHistoricoFazendaBusca}
              setFiltroHistoricoFazendaBusca={setFiltroHistoricoFazendaBusca}
              showFazendaBuscaHistorico={showFazendaBuscaHistorico}
              setShowFazendaBuscaHistorico={setShowFazendaBuscaHistorico}
              historicoPage={historicoPage}
              setHistoricoPage={setHistoricoPage}
              HISTORICO_PAGE_SIZE={HISTORICO_PAGE_SIZE}
              onLoadHistorico={loadLotesHistoricos}
              onExpandirLote={handleExpandirLote}
            />
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
