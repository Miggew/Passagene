import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoteFIV, LoteFIVAcasalamento, PacoteAspiracao, AspiracaoDoadora, DoseSemen, Fazenda, Doadora, Cliente } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, Eye, Lock, X, Users, FileText, Package } from 'lucide-react';
import { formatDate, extractDateOnly, addDays, diffDays, getTodayDateString, formatDateString, getDayOfWeekName } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface LoteFIVComNomes extends LoteFIV {
  pacote_nome?: string;
  pacote_data?: string;
  fazendas_destino_nomes?: string[];
  quantidade_acasalamentos?: number;
  dia_atual?: number;
}

interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

interface AcasalamentoComNomes extends LoteFIVAcasalamento {
  doadora_nome?: string;
  doadora_registro?: string;
  dose_nome?: string;
  viaveis?: number;
  total_embrioes_produzidos?: number;
}

interface AspiracaoComOocitosDisponiveis extends AspiracaoDoadora {
  oocitos_disponiveis?: number;
}

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
  const [showDialog, setShowDialog] = useState(false);
  const [showLoteDetail, setShowLoteDetail] = useState(false);
  const [selectedLote, setSelectedLote] = useState<LoteFIVComNomes | null>(null);
  const [acasalamentos, setAcasalamentos] = useState<AcasalamentoComNomes[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editQuantidadeEmbrioes, setEditQuantidadeEmbrioes] = useState<{ [key: string]: string }>({});
  const [showAddAcasalamento, setShowAddAcasalamento] = useState(false);
  const [fazendasDestinoIds, setFazendasDestinoIds] = useState<string[]>([]);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [historicoDespachos, setHistoricoDespachos] = useState<Array<{
    id: string;
    data_despacho: string;
    acasalamentos: Array<{ acasalamento_id: string; quantidade: number; doadora?: string; dose?: string }>;
    pacote_id?: string;
  }>>([]);
  const [aspiracoesDisponiveis, setAspiracoesDisponiveis] = useState<AspiracaoComOocitosDisponiveis[]>([]);
  const [dosesDisponiveis, setDosesDisponiveis] = useState<DoseSemen[]>([]);
  const [fazendaOrigemNome, setFazendaOrigemNome] = useState<string>('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [recomendacaoAspiracaoSelecionada, setRecomendacaoAspiracaoSelecionada] = useState<string>('');
  const [dosesDisponiveisNoLote, setDosesDisponiveisNoLote] = useState<DoseSemen[]>([]);
  const [dataAspiracao, setDataAspiracao] = useState<string>('');
  const [filtroFazendaAspiracao, setFiltroFazendaAspiracao] = useState<string>('');
  const [filtroFazendaAspiracaoBusca, setFiltroFazendaAspiracaoBusca] = useState<string>('');
  const [filtroDiaCultivo, setFiltroDiaCultivo] = useState<string>('');
  const [lotesFiltrados, setLotesFiltrados] = useState<LoteFIVComNomes[]>([]);
  const [pacotesParaFiltro, setPacotesParaFiltro] = useState<PacoteComNomes[]>([]);
  const [datasAspiracaoUnicas, setDatasAspiracaoUnicas] = useState<string[]>([]);
  const [fazendasAspiracaoUnicas, setFazendasAspiracaoUnicas] = useState<{ id: string; nome: string }[]>([]);
  const [showFazendaBusca, setShowFazendaBusca] = useState(false);

  // Função para obter o nome resumido do dia
  const getNomeDia = (dia: number): string => {
    const nomesDias: { [key: number]: string } = {
      [-1]: 'Aspiração',
      0: 'Fecundação',
      1: 'Zigoto',
      2: 'Clivagem',
      3: 'Clivagem Avançada',
      4: 'Compactação',
      5: 'Mórula / Blastocisto Inicial',
      6: 'Blastocisto',
      7: 'Blastocisto Expandido',
      8: 'Resgate / Saída Tardia',
    };
    return nomesDias[dia] || `Dia ${dia}`;
  };

  // Função para obter a cor do dia
  const getCorDia = (dia: number): string => {
    if (dia === -1) return 'bg-blue-100 text-blue-800 border-blue-300'; // D-1 (Aspiração)
    if (dia === 0) return 'bg-green-100 text-green-800 border-green-300'; // D0 (Fecundação)
    if (dia >= 1 && dia <= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (dia >= 4 && dia <= 5) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (dia === 6) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (dia === 7) return 'bg-purple-100 text-purple-800 border-purple-300'; // D7 (Transferência)
    if (dia === 8) return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [acasalamentoForm, setAcasalamentoForm] = useState({
    aspiracao_doadora_id: '',
    dose_semen_id: '',
    quantidade_fracionada: '1.0',
    quantidade_oocitos: '',
    observacoes: '',
  });

  const [formData, setFormData] = useState({
    pacote_aspiracao_id: '',
    observacoes: '',
    doses_selecionadas: [] as string[],
  });

  const [selectedPacote, setSelectedPacote] = useState<PacoteComNomes | null>(null);

  useEffect(() => {
    if (id) {
      loadLoteDetail(id);
    } else {
      loadData();
    }
  }, [id]);

  // Aplicar filtros quando lotes ou filtros mudarem
  useEffect(() => {
    let filtrados = [...lotes];

    // Filtrar por fazenda da aspiração
    if (filtroFazendaAspiracao) {
      filtrados = filtrados.filter((l) => {
        // Buscar a fazenda do pacote de aspiração
        const pacote = pacotesParaFiltro.find((p) => p.id === l.pacote_aspiracao_id);
        return pacote?.fazenda_id === filtroFazendaAspiracao;
      });
    }

    // Filtrar por dia do cultivo
    if (filtroDiaCultivo !== '') {
      const diaFiltro = parseInt(filtroDiaCultivo);
      filtrados = filtrados.filter((l) => l.dia_atual === diaFiltro);
    }

    setLotesFiltrados(filtrados);
  }, [lotes, filtroFazendaAspiracao, filtroDiaCultivo, pacotesParaFiltro]);

  // Filtrar fazendas para busca
  const fazendasFiltradas = fazendasAspiracaoUnicas.filter((f) =>
    f.nome.toLowerCase().includes(filtroFazendaAspiracaoBusca.toLowerCase())
  );

  // Fechar lista de busca quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.fazenda-busca-container')) {
        setShowFazendaBusca(false);
      }
    };

    if (showFazendaBusca) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFazendaBusca]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacotes FINALIZADOS
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('status', 'FINALIZADO')
        .order('data_aspiracao', { ascending: false });

      if (pacotesError) throw pacotesError;

      console.log('Pacotes FINALIZADOS encontrados:', pacotesData?.length || 0);
      if (pacotesData && pacotesData.length > 0) {
        console.log('IDs dos pacotes FINALIZADOS:', pacotesData.map(p => p.id));
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

      if (clientesError) {
        console.error('Erro ao carregar clientes:', clientesError);
      } else {
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

        if (fazendasDestinoError) {
          console.error('Erro ao carregar fazendas destino:', fazendasDestinoError);
          // Continuar mesmo com erro - pode ser que a tabela não exista ainda
        } else if (fazendasDestinoData) {
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

        if (aspiracoesError) {
          console.error('Erro ao carregar aspirações:', aspiracoesError);
        } else if (aspiracoesData) {
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
      
      console.log('Pacotes já usados em lotes:', Array.from(pacotesUsadosEmLotes));
      console.log('Total de lotes encontrados:', lotesData?.length || 0);
      console.log('Pacotes disponíveis após filtrar usados:', pacotesDisponiveis.length);

      const pacotesComNomes: PacoteComNomes[] = pacotesDisponiveis.map((p) => ({
        ...p,
        fazenda_nome: fazendasMap.get(p.fazenda_id),
        fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
        quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
      }));

      console.log('Pacotes finais para exibir:', pacotesComNomes.length);

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
              console.error('Erro ao fechar lotes automaticamente:', error);
            } else {
              console.log(`${lotesIdsParaFechar.length} lote(s) fechado(s) automaticamente após D8`);
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
        // Se o lote está ABERTO, mostrar apenas se dia_atual <= 9 (até D8, que é o último dia)
        return l.dia_atual !== undefined && l.dia_atual <= 9;
      });

      setLotes(lotesComNomes);
      setLotesFiltrados(lotesVisiveis);
      
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
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

      if (loteError) throw loteError;

      // Load pacote
      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', loteData.pacote_aspiracao_id)
        .single();

      if (pacoteError) throw pacoteError;

      // Armazenar data da aspiração para cálculo de dias (D-1)
      setDataAspiracao(pacoteData.data_aspiracao);

      // Load fazenda origem
      const { data: fazendaOrigemData, error: fazendaOrigemError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', pacoteData.fazenda_id)
        .single();

      if (fazendaOrigemError) {
        console.error('Erro ao carregar fazenda origem:', fazendaOrigemError);
        setFazendaOrigemNome('');
      } else {
        setFazendaOrigemNome(fazendaOrigemData?.nome || '');
      }

      // Load fazendas destino
      const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('fazenda_destino_id')
        .eq('pacote_aspiracao_id', pacoteData.id);

      if (fazendasDestinoError) {
        console.error('Erro ao carregar fazendas destino:', fazendasDestinoError);
      }

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
          console.error('Erro ao carregar nomes das fazendas destino:', fazendasDestinoNomesError);
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

      // Load doses
      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
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

        return {
          ...a,
          doadora_nome: doadora?.nome || doadora?.registro,
          doadora_registro: doadora?.registro,
          dose_nome: dose?.nome,
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

      if (todasAspiracoesError) {
        console.error('Erro ao carregar todas as aspirações:', todasAspiracoesError);
      } else {
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

      // Load doses disponíveis do lote (se houver doses selecionadas no lote)
      const { data: dosesDisponiveisData, error: dosesDisponiveisError } = await supabase
        .from('doses_semen')
        .select('id, nome, cliente_id')
        .order('nome', { ascending: true });

      if (dosesDisponiveisError) {
        console.error('Erro ao carregar doses disponíveis:', dosesDisponiveisError);
        setDosesDisponiveis([]);
      } else {
        // Se o lote tem doses selecionadas, filtrar por elas, senão mostrar todas
        // Tratar caso o campo não exista no banco ainda
        try {
          const dosesSelecionadas = (loteData as any).doses_selecionadas;
          if (dosesSelecionadas && Array.isArray(dosesSelecionadas) && dosesSelecionadas.length > 0) {
            setDosesDisponiveis(
              (dosesDisponiveisData || []).filter((d) => dosesSelecionadas.includes(d.id))
            );
          } else {
            setDosesDisponiveis(dosesDisponiveisData || []);
          }
        } catch (error) {
          // Se o campo não existir, mostrar todas as doses
          console.warn('Campo doses_selecionadas não encontrado, mostrando todas as doses:', error);
          setDosesDisponiveis(dosesDisponiveisData || []);
        }
      }

      // Load clientes para exibir nos selects
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (clientesError) {
        console.error('Erro ao carregar clientes:', clientesError);
      } else {
        setClientes(clientesData || []);
      }

      // Carregar histórico de despachos
      await loadHistoricoDespachos(loteId);

    } catch (error) {
      toast({
        title: 'Erro ao carregar detalhes do lote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico de despachos do lote
  const loadHistoricoDespachos = async (loteId: string) => {
    try {
      // Buscar pacotes fechados que foram criados a partir deste lote
      // Identificamos pelo campo observacoes que contém o ID do lote
      const { data: pacotesDespachados, error } = await supabase
        .from('pacotes_aspiracao')
        .select('id, data_aspiracao, observacoes')
        .eq('status', 'FINALIZADO')
        .like('observacoes', `%Lote FIV ${loteId.slice(0, 8)}%`)
        .order('data_aspiracao', { ascending: false });

      if (error) {
        console.error('Erro ao carregar histórico de despachos:', error);
        setHistoricoDespachos([]);
        return;
      }

      if (!pacotesDespachados || pacotesDespachados.length === 0) {
        setHistoricoDespachos([]);
        return;
      }

      // Os embriões estão no mesmo lote FIV, então vamos buscar todos os embriões do lote
      // e agrupar por data de criação (assumindo que embriões criados na mesma data foram despachados juntos)
      const { data: todosEmbrioes, error: embrioesError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id, created_at')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: false });

      if (embrioesError) {
        console.error('Erro ao carregar embriões:', embrioesError);
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

        if (acasalamentosError) {
          console.error('Erro ao carregar acasalamentos:', acasalamentosError);
        } else if (acasalamentosData) {
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

          // Buscar doses
          const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))] as string[];
          const { data: dosesData } = await supabase
            .from('doses_semen')
            .select('id, nome')
            .in('id', doseIds);

          // Criar maps para busca rápida
          const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);
          const doadorasMap = new Map(doadorasData?.map(d => [d.id, d]) || []);
          const dosesMap = new Map(dosesData?.map(d => [d.id, d]) || []);
          const acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));

          // Criar histórico baseado nos pacotes despachados
          const historico = pacotesDespachados.map((pacote) => {
            const dataDespacho = pacote.data_aspiracao.split('T')[0];
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
                dose: dose?.nome || '-',
              };
            });

            return {
              id: pacote.id,
              data_despacho: dataDespacho,
              acasalamentos: acasalamentosDespacho,
              pacote_id: pacote.id,
            };
          });

          setHistoricoDespachos(historico);
          return;
        }
      }

      // Se não houver acasalamentos, criar histórico vazio
      const historico = pacotesDespachados.map((pacote) => {
        const dataDespacho = pacote.data_aspiracao.split('T')[0];
        return {
          id: pacote.id,
          data_despacho: dataDespacho,
          acasalamentos: [],
          pacote_id: pacote.id,
        };
      });

      setHistoricoDespachos(historico);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      setHistoricoDespachos([]);
    }
  };

  // Gerar relatório de prévia no D6
  const gerarRelatorioPrevia = () => {
    setShowRelatorioDialog(true);
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

      // Validar que há quantidades preenchidas
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

      // Buscar fazenda origem do pacote original
      const { data: pacoteOriginal } = await supabase
        .from('pacotes_aspiracao')
        .select('fazenda_id')
        .eq('id', selectedLote.pacote_aspiracao_id)
        .single();

      // Criar nome do pacote: "Fazenda Origem - Fazendas Destino"
      const nomePacote = `${fazendaOrigemNome} - ${fazendasDestinoNomes.join(', ')}`;
      
      // Criar pacote fechado para os embriões despachados
      const dataDespacho = new Date().toISOString().split('T')[0];
      
      // Usar a primeira fazenda destino como fazenda_destino_id (campo obrigatório)
      // As outras fazendas destino serão associadas na tabela de relacionamento
      const primeiraFazendaDestinoId = fazendasDestinoIds.length > 0 ? fazendasDestinoIds[0] : null;
      
      if (!primeiraFazendaDestinoId) {
        toast({
          title: 'Erro ao despachar',
          description: 'É necessário ter pelo menos uma fazenda destino configurada no lote.',
          variant: 'destructive',
        });
        return;
      }

      const { data: novoPacote, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .insert([{
          data_aspiracao: dataDespacho,
          fazenda_id: pacoteOriginal?.fazenda_id || null,
          fazenda_destino_id: primeiraFazendaDestinoId,
          status: 'FINALIZADO', // Usar FINALIZADO em vez de FECHADO
          observacoes: `Despachado do Lote FIV ${selectedLote.id.slice(0, 8)}... em ${formatDate(dataDespacho)}. Pacote: ${nomePacote}`,
        }])
        .select()
        .single();

      if (pacoteError) {
        console.error('Erro ao criar pacote:', pacoteError);
        throw pacoteError;
      }

      // Associar fazendas destino ao novo pacote
      if (fazendasDestinoIds.length > 0) {
        const { error: fazendasDestinoError } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .insert(
            fazendasDestinoIds.map(fazendaId => ({
              pacote_aspiracao_id: novoPacote.id,
              fazenda_destino_id: fazendaId,
            }))
          );

        if (fazendasDestinoError) {
          console.error('Erro ao associar fazendas destino:', fazendasDestinoError);
          // Continuar mesmo com erro - pode ser que a tabela não exista
        }
      }

      // Criar embriões no pacote
      const embrioesParaCriar: any[] = [];
      const acasalamentosDespachados: Array<{ acasalamento_id: string; quantidade: number; doadora?: string; dose?: string }> = [];

      for (const acasalamento of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || acasalamento.quantidade_embrioes?.toString() || '0');
        
        if (quantidade > 0) {
          // Criar embriões
          // Nota: pacote_aspiracao_id não existe diretamente na tabela embrioes
          // O pacote é obtido através do lote_fiv_id -> pacote_aspiracao_id
          for (let i = 0; i < quantidade; i++) {
            embrioesParaCriar.push({
              lote_fiv_id: selectedLote.id,
              lote_fiv_acasalamento_id: acasalamento.id,
              status_atual: 'FRESCO',
            });
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
          console.error('Erro detalhado ao criar embriões:', embrioesError);
          throw embrioesError;
        }
      }

      // Registrar histórico de despacho (usar tabela ou campo JSON)
      // Por enquanto, vamos criar um registro simples
      const historicoDespacho = {
        id: novoPacote.id,
        data_despacho: dataDespacho,
        acasalamentos: acasalamentosDespachados,
        pacote_id: novoPacote.id,
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

      // Limpar campos de edição
      setEditQuantidadeEmbrioes({});

      toast({
        title: 'Embriões despachados',
        description: `${embrioesParaCriar.length} embrião(ões) foram despachados para o pacote "${nomePacote}".`,
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

  const handlePacoteChange = async (pacoteId: string) => {
    setFormData({ ...formData, pacote_aspiracao_id: pacoteId });
    const pacote = pacotes.find((p) => p.id === pacoteId);
    setSelectedPacote(pacote || null);

    if (pacote) {
      // Load aspirações doadoras do pacote
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', pacoteId);

      if (aspiracoesError) {
        console.error('Erro ao carregar aspirações:', aspiracoesError);
        return;
      }

      setAspiracoesDoadoras(aspiracoesData || []);

      // Load doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      if (doadoraIds.length > 0) {
        const { data: doadorasData, error: doadorasError } = await supabase
          .from('doadoras')
          .select('id, nome, registro')
          .in('id', doadoraIds);

        if (doadorasError) {
          console.error('Erro ao carregar doadoras:', doadorasError);
          return;
        }

        setDoadoras(doadorasData || []);
      }

      // Load doses
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome, cliente_id')
        .order('nome', { ascending: true });

      if (dosesError) {
        console.error('Erro ao carregar doses:', dosesError);
        return;
      }

      setDoses(dosesData || []);
    }
  };


  const handleAddAcasalamento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLote) return;

    if (!acasalamentoForm.aspiracao_doadora_id) {
      toast({
        title: 'Erro de validação',
        description: 'Doadora é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    // Validar que um sêmen foi selecionado
    if (!acasalamentoForm.dose_semen_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma dose de sêmen',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeFracionada = parseFloat(acasalamentoForm.quantidade_fracionada) || 0;
    if (quantidadeFracionada <= 0) {
      toast({
        title: 'Erro de validação',
        description: 'Quantidade fracionada deve ser maior que zero',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Buscar aspiração selecionada para obter oócitos disponíveis
      const aspiracaoSelecionada = aspiracoesDisponiveis.find(
        (a) => a.id === acasalamentoForm.aspiracao_doadora_id
      );
      const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;

      // Validar quantidade de oócitos
      const quantidadeOocitos = parseInt(acasalamentoForm.quantidade_oocitos) || 0;

      if (quantidadeOocitos > oocitosDisponiveis) {
        toast({
          title: 'Erro de validação',
          description: `A quantidade de oócitos (${quantidadeOocitos}) não pode ser maior que os oócitos disponíveis (${oocitosDisponiveis})`,
          variant: 'destructive',
        });
        return;
      }

      // Criar acasalamento
      const acasalamentoParaInserir = {
        lote_fiv_id: selectedLote.id,
        aspiracao_doadora_id: acasalamentoForm.aspiracao_doadora_id,
        dose_semen_id: acasalamentoForm.dose_semen_id,
        quantidade_fracionada: quantidadeFracionada,
        quantidade_oocitos: quantidadeOocitos > 0 ? quantidadeOocitos : null,
        observacoes: acasalamentoForm.observacoes || null,
      };

      const { error } = await supabase.from('lote_fiv_acasalamentos').insert([acasalamentoParaInserir]);

      if (error) throw error;

      toast({
        title: 'Acasalamento adicionado',
        description: 'Acasalamento adicionado com sucesso',
      });

      setShowAddAcasalamento(false);
      setAcasalamentoForm({
        aspiracao_doadora_id: '',
        dose_semen_id: '',
        quantidade_fracionada: '1.0',
        quantidade_oocitos: '',
        observacoes: '',
      });

      // Recarregar detalhes do lote
      await loadLoteDetail(selectedLote.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao adicionar acasalamento',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pacote_aspiracao_id) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote de aspiração é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPacote) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote selecionado não encontrado',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Verificar se o pacote existe antes de criar o lote
      const { data: pacoteVerificado, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('id, status')
        .eq('id', formData.pacote_aspiracao_id)
        .single();

      if (pacoteError || !pacoteVerificado) {
        toast({
          title: 'Erro de validação',
          description: 'Pacote de aspiração não encontrado ou inválido',
          variant: 'destructive',
        });
        return;
      }

      if (pacoteVerificado.status !== 'FINALIZADO') {
        toast({
          title: 'Erro de validação',
          description: 'Apenas pacotes FINALIZADOS podem ser usados para criar lotes FIV',
          variant: 'destructive',
        });
        return;
      }

      // Calcular data_abertura = data do pacote + 1 dia
      const dataPacote = new Date(selectedPacote.data_aspiracao);
      dataPacote.setDate(dataPacote.getDate() + 1);
      const dataAbertura = dataPacote.toISOString().split('T')[0];

      console.log('Dados que serão enviados:', {
        pacote_aspiracao_id: formData.pacote_aspiracao_id,
        data_abertura: dataAbertura,
        data_fecundacao: dataAbertura,
        status: 'ABERTO',
      });

      // Criar lote
      // Preparar dados do lote
      const loteDataToInsert: any = {
        pacote_aspiracao_id: formData.pacote_aspiracao_id,
        data_abertura: dataAbertura,
        data_fecundacao: dataAbertura, // data_fecundacao = data_abertura (mesma data)
        status: 'ABERTO',
        observacoes: formData.observacoes || null,
      };

      // Tentar adicionar doses_selecionadas apenas se houver doses selecionadas
      // Nota: O campo pode não existir no banco ainda, então vamos tentar inserir
      // mas não vamos falhar se der erro
      if (formData.doses_selecionadas && formData.doses_selecionadas.length > 0) {
        try {
          loteDataToInsert.doses_selecionadas = formData.doses_selecionadas;
        } catch (error) {
          console.warn('Campo doses_selecionadas não disponível no banco:', error);
        }
      }

      let loteData: any;
      const { data: loteDataInsert, error: loteError } = await supabase
        .from('lotes_fiv')
        .insert([loteDataToInsert])
        .select()
        .single();

      if (loteError) {
        // Se o erro for relacionado ao campo doses_selecionadas, tentar novamente sem ele
        if (loteError.message?.includes('doses_selecionadas') || loteError.code === '42703') {
          console.warn('Campo doses_selecionadas não existe no banco, criando lote sem ele');
          delete loteDataToInsert.doses_selecionadas;
          
          const { data: loteDataRetry, error: loteErrorRetry } = await supabase
            .from('lotes_fiv')
            .insert([loteDataToInsert])
            .select()
            .single();

          if (loteErrorRetry) {
            console.error('Erro detalhado ao criar lote:', {
              message: loteErrorRetry.message,
              details: loteErrorRetry.details,
              hint: loteErrorRetry.hint,
              code: loteErrorRetry.code,
            });
            throw loteErrorRetry;
          }
          
          // Usar o lote criado sem doses_selecionadas
          loteData = loteDataRetry;
        } else {
          console.error('Erro detalhado ao criar lote:', {
            message: loteError.message,
            details: loteError.details,
            hint: loteError.hint,
            code: loteError.code,
          });
          throw loteError;
        }
      } else {
        loteData = loteDataInsert;
      }

      // Inserir fazendas destino do pacote no lote
      const fazendasDestinoIds = selectedPacote.fazendas_destino_nomes
        ?.map((nome) => {
          const fazenda = fazendas.find((f) => f.nome === nome);
          return fazenda?.id;
        })
        .filter((id): id is string => !!id);

      if (fazendasDestinoIds && fazendasDestinoIds.length > 0) {
        const { error: fazendasError } = await supabase.from('lote_fiv_fazendas_destino').insert(
          fazendasDestinoIds.map((fazendaId) => ({
            lote_fiv_id: loteData.id,
            fazenda_id: fazendaId,
          }))
        );

        if (fazendasError) throw fazendasError;
      }

      // Marcar pacote como usado em lote FIV
      try {
        await supabase
          .from('pacotes_aspiracao')
          .update({ usado_em_lote_fiv: true })
          .eq('id', formData.pacote_aspiracao_id);
      } catch (error) {
        // Se o campo não existir, apenas logar o erro mas não falhar
        console.warn('Campo usado_em_lote_fiv não existe no banco:', error);
      }

      toast({
        title: 'Lote FIV criado',
        description: 'Lote FIV criado com sucesso. Agora você pode adicionar acasalamentos.',
      });

      setShowDialog(false);
      setFormData({
        pacote_aspiracao_id: '',
        observacoes: '',
        doses_selecionadas: [],
      });
      setSelectedPacote(null);
      setAspiracoesDoadoras([]);
      setDoadoras([]);

      // Navegar para o detalhe do lote
      navigate(`/lotes-fiv/${loteData.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar lote',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !selectedLote) {
    return <LoadingSpinner />;
  }

  // Se estiver visualizando um lote específico
  if (selectedLote && showLoteDetail) {
    // Calcular dia atual baseado na data da aspiração (D-1)
    // Lógica correta: D-1 = dia da aspiração, D0 = D-1 + 1 dia (fecundação), D7 = D-1 + 8 dias (transferência)
    // Exemplo: aspiração 05/01 (segunda) → D-1=05/01, D0=06/01 (terça, fecundação), D7=13/01 (terça, transferência)
    // Contagem: 05/01(D-1) → 06/01(D0) → 07/01(D1) → 08/01(D2) → 09/01(D3) → 10/01(D4) → 11/01(D5) → 12/01(D6) → 13/01(D7)
    // diaAtual = diferença em dias desde D-1 (aspiração)
    // Quando diaAtual = 0, estamos no D-1 (aspiração)
    // Quando diaAtual = 1, estamos no D0 (fecundação)
    // Quando diaAtual = 8, estamos no D7 (transferência, pois D7 = D-1 + 8 dias)
    // Usar funções utilitárias que trabalham apenas com strings YYYY-MM-DD para evitar problemas de timezone
    
    // Função auxiliar para mapear diaAtual para o dia do cultivo
    // Lógica ABSOLUTA: D-1 = aspiração, D0 = fecundação (D-1 + 1), D7 = transferência (D-1 + 8), D8 = emergência (D-1 + 9)
    // D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV (não existe D9, D10, D11, etc.)
    // diaAtual = diferença em dias desde D-1 (aspiração)
    // diaAtual = 0 → D-1 (aspiração)
    // diaAtual = 1 → D0 (fecundação)
    // diaAtual = 2 → D1
    // diaAtual = 8 → D7 (transferência)
    // diaAtual = 9 → D8 (emergência, último dia)
    // diaAtual > 9 → Passou do D8 (lote não existe mais, será fechado e sumirá)
    const getDiaCultivo = (diaAtual: number): number => {
      if (diaAtual === 0) {
        return -1; // D-1 (aspiração)
      }
      if (diaAtual > 9) {
        return 8; // D8 (acima de D8 não existe, mas mostrar D8 até ser fechado)
      }
      return diaAtual - 1; // Converte: 1→0 (D0), 2→1 (D1), ..., 8→7 (D7), 9→8 (D8)
    };
    
    // Função auxiliar para obter nome do dia
    // Lógica ABSOLUTA: D-1 = Aspiração, D0 = Fecundação, D7 = Transferência, D8 = Emergência
    // D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV
    const getNomeDia = (dia: number): string => {
      const nomes: { [key: number]: string } = {
        [-1]: 'Aspiração',
        0: 'Fecundação',
        1: 'Zigoto',
        2: '2 Células',
        3: '4 Células',
        4: '8 Células',
        5: 'Mórula',
        6: 'Blastocisto',
        7: 'Blastocisto Expandido', // D7 = Transferência
        8: 'Blastocisto Expandido', // D8 = Emergência
      };
      return nomes[dia] || `D${dia}`;
    };
    
    // Sempre usar a data da aspiração como referência (D-1)
    // Se não tiver dataAspiracao carregada, buscar do pacote
    let dataAspiracaoStr = extractDateOnly(dataAspiracao || selectedLote.pacote_data || null);
    
    // Se ainda não tiver, calcular baseado na data_abertura (que é aspiração + 1)
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
    
    if (!dataAspiracaoStr) {
      // Se ainda não tiver data, não podemos calcular
      return <div>Erro: Data de aspiração não encontrada</div>;
    }
    
    // Obter data de hoje no formato YYYY-MM-DD
    const hojeStr = getTodayDateString();
    
    // Calcular diferença em dias: hoje - data da aspiração (D-1)
    // Lógica ABSOLUTA: D-1 = aspiração, D0 = fecundação (D-1 + 1), D7 = transferência (D-1 + 8), D8 = emergência (D-1 + 9)
    // D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV (não existe D9, D10, D11, etc.)
    // Exemplo: aspiração 05/01 (segunda) → D-1=05/01, D0=06/01 (terça, fecundação), D7=13/01 (terça, transferência), D8=14/01 (quarta, emergência)
    // Se hoje = 05/01 e aspiração = 05/01, então diaAtual = 0 (D-1)
    // Se hoje = 06/01 e aspiração = 05/01, então diaAtual = 1 (D0)
    // Se hoje = 13/01 e aspiração = 05/01, então diaAtual = 8 (D7)
    // Se hoje = 14/01 e aspiração = 05/01, então diaAtual = 9 (D8 - último dia)
    // Se hoje > 14/01 e aspiração = 05/01, então diaAtual > 9 (passou do D8, lote não existe mais)
    const diaAtual = Math.max(0, diffDays(hojeStr, dataAspiracaoStr));
    
    // Calcular data do D7: D-1 + 8 dias (transferência)
    // D-1 = aspiração (05/01), D0 = fecundação (06/01), D7 = 13/01 (D-1 + 8), D8 = 14/01 (D-1 + 9)
    const dataD7Str = addDays(dataAspiracaoStr, 8);
    
    // Formatar data do D7 e obter dia da semana
    const dataD7Formatada = formatDateString(dataD7Str);
    const diaSemanaD7 = getDayOfWeekName(dataD7Str);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowLoteDetail(false);
              setSelectedLote(null);
              navigate('/lotes-fiv');
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Detalhes do Lote FIV</h1>
            <div className="text-slate-600 mt-1 flex items-center gap-2">
              <span>
                Data de fecundação (D0): {formatDate(selectedLote.data_abertura)} | 
                {dataAspiracaoStr && ` Data aspiração (D-1): ${formatDateString(dataAspiracaoStr)} |`}
                {(() => {
                  const diaCultivo = getDiaCultivo(diaAtual);
                  return diaCultivo === -1 
                    ? ` D-1 - ${getNomeDia(diaCultivo)} |`
                    : ` D${diaCultivo} - ${getNomeDia(diaCultivo)} |`;
                })()}
                {' '}Status:
              </span>
              <Badge variant={selectedLote.status === 'FECHADO' ? 'default' : 'secondary'}>
                {selectedLote.status}
              </Badge>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dia Atual</Label>
                <p className="text-2xl font-bold">
                  {(() => {
                    const diaCultivo = getDiaCultivo(diaAtual);
                    return diaCultivo === -1 
                      ? <>D-1 <span className="text-lg font-normal text-slate-600">- {getNomeDia(diaCultivo)}</span></>
                      : <>D{diaCultivo} <span className="text-lg font-normal text-slate-600">- {getNomeDia(diaCultivo)}</span></>;
                  })()}
                </p>
              </div>
              <div>
                <Label>Data da TE</Label>
                {diaAtual < 7 ? (
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{dataD7Formatada}</p>
                    <p className="text-sm text-slate-600 mt-1">{diaSemanaD7}</p>
                  </div>
                ) : diaAtual === 7 ? (
                  <div>
                    <p className="text-2xl font-bold text-green-600">{dataD7Formatada}</p>
                    <p className="text-sm text-slate-600 mt-1">{diaSemanaD7} - Período de classificação (hoje)</p>
                  </div>
                ) : diaAtual === 8 ? (
                  <div>
                    {/* Quando estamos em D8, mostrar a data correta do D7 (calculada) */}
                    <p className="text-2xl font-bold text-green-600">{dataD7Formatada}</p>
                    <p className="text-sm text-slate-600 mt-1">{diaSemanaD7} - Período de classificação (D7 foi ontem, hoje é D8)</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-red-600">{dataD7Formatada}</p>
                    <p className="text-sm text-slate-600 mt-1">{diaSemanaD7} - Prazo encerrado</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <Label className="text-slate-500">Fazenda Origem da Aspiração</Label>
                <p className="font-medium">{fazendaOrigemNome || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-500">Fazendas Destino</Label>
                {fazendasDestinoNomes.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {fazendasDestinoNomes.map((nome, index) => (
                      <Badge key={index} variant="outline" className="font-medium">
                        {nome}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-slate-400">-</p>
                )}
              </div>
            </div>

            {selectedLote.status === 'ABERTO' && diaAtual === 7 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-blue-800 font-medium">
                    📊 Este lote está no D6 ({getNomeDia(6)}). Você pode preencher a quantidade de embriões (prévia) e gerar um relatório.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={gerarRelatorioPrevia}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Relatório de Prévia
                  </Button>
                </div>
              </div>
            )}
            {((selectedLote.status === 'ABERTO' && (diaAtual === 8 || diaAtual === 9)) || (selectedLote.status === 'FECHADO' && diaAtual === 9)) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="text-orange-800 font-medium">
                    ⚠️ Este lote está no {diaAtual === 8 ? 'D7' : 'D8'} ({getNomeDia(diaAtual === 8 ? 7 : 8)}). {diaAtual === 8 ? 'Informe a quantidade de embriões para cada acasalamento e despache os embriões.' : 'Período de emergência (D8). Você pode adicionar novos acasalamentos e despachar os embriões imediatamente.'}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={despacharEmbrioes}
                    disabled={submitting}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {submitting ? 'Despachando...' : 'Despachar Todos os Embriões'}
                  </Button>
                </div>
              </div>
            )}
            {selectedLote.status === 'ABERTO' && diaAtual > 9 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  ⚠️ Este lote passou do D8. D8 é o último dia. Acima de D8 não existe mais lote FIV. O lote será fechado automaticamente e não aparecerá mais na lista.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acasalamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {acasalamentos.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                Nenhum acasalamento cadastrado
              </div>
            ) : (() => {
              // Agrupar acasalamentos por doadora
              const acasalamentosPorDoadora = new Map<string, AcasalamentoComNomes[]>();
              acasalamentos.forEach((acasalamento) => {
                const key = acasalamento.doadora_nome || acasalamento.doadora_registro || 'Desconhecida';
                if (!acasalamentosPorDoadora.has(key)) {
                  acasalamentosPorDoadora.set(key, []);
                }
                acasalamentosPorDoadora.get(key)!.push(acasalamento);
              });

              const doadoras = Array.from(acasalamentosPorDoadora.entries());

              return (
                <div className="space-y-6">
                  {doadoras.map(([doadoraKey, acasalamentosGrupo]) => {
                    const primeiroAcasalamento = acasalamentosGrupo[0];
                    const oocitosTotal = primeiroAcasalamento.viaveis ?? 0;
                    const doadoraNome = primeiroAcasalamento.doadora_nome || primeiroAcasalamento.doadora_registro || 'Doadora desconhecida';

                    return (
                      <div key={doadoraKey} className="space-y-2">
                        {/* Cabeçalho da Doadora */}
                        <div className="bg-green-100 border border-green-200 rounded-md px-4 py-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{doadoraNome}</span>
                            <span className="text-sm text-slate-700">Total de Óocitos: {oocitosTotal}</span>
                          </div>
                        </div>
                        
                        {/* Tabela de Acasalamentos da Doadora */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>DOSE DE SÊMEN (TOURO)</TableHead>
                              <TableHead className="text-center">QTD. FRACIONADA (DOSES)</TableHead>
                              <TableHead className="text-center">ÓOCITOS USADOS</TableHead>
                              {((selectedLote.status === 'ABERTO' && (diaAtual === 7 || diaAtual === 8 || diaAtual === 9)) || selectedLote.status === 'FECHADO') && (
                                <>
                                  <TableHead className="text-center">QTD. EMBRIÕES</TableHead>
                                  <TableHead className="text-center">TOTAL PRODUZIDOS</TableHead>
                                </>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {acasalamentosGrupo.map((acasalamento) => (
                              <TableRow key={acasalamento.id}>
                                <TableCell>{acasalamento.dose_nome || '-'}</TableCell>
                                <TableCell className="text-center">{acasalamento.quantidade_fracionada ?? '-'}</TableCell>
                                <TableCell className="text-center">
                                  {acasalamento.quantidade_oocitos !== undefined && acasalamento.quantidade_oocitos !== null
                                    ? `${acasalamento.quantidade_oocitos} de ${oocitosTotal}`
                                    : '-'}
                                </TableCell>
                                {((selectedLote.status === 'ABERTO' && (diaAtual === 7 || diaAtual === 8 || diaAtual === 9)) || selectedLote.status === 'FECHADO') && (
                                  <>
                                    <TableCell className="text-center">
                                      {((selectedLote.status === 'ABERTO' && (diaAtual === 7 || diaAtual === 8 || diaAtual === 9)) || (selectedLote.status === 'FECHADO' && diaAtual === 9)) ? (
                                        <div className="flex justify-center">
                                          <Input
                                            type="number"
                                            min="0"
                                            value={editQuantidadeEmbrioes[acasalamento.id] ?? acasalamento.quantidade_embrioes ?? ''}
                                            onChange={(e) =>
                                              setEditQuantidadeEmbrioes({
                                                ...editQuantidadeEmbrioes,
                                                [acasalamento.id]: e.target.value,
                                              })
                                            }
                                            className="w-20 text-center"
                                            placeholder="0"
                                          />
                                        </div>
                                      ) : (
                                        <span className="font-medium">{acasalamento.quantidade_embrioes ?? '-'}</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center font-semibold text-green-600">
                                      {acasalamento.total_embrioes_produzidos ?? 0}
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            
            
            {((selectedLote.status === 'ABERTO' && diaAtual <= 9) || (selectedLote.status === 'FECHADO' && diaAtual === 9)) && aspiracoesDisponiveis.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Dialog
                  open={showAddAcasalamento}
                  onOpenChange={(open) => {
                    setShowAddAcasalamento(open);
                    if (!open) {
                      // Resetar formulário quando fechar
                      setAcasalamentoForm({
                        aspiracao_doadora_id: '',
                        dose_semen_id: '',
                        quantidade_fracionada: '1.0',
                        quantidade_oocitos: '',
                        observacoes: '',
                      });
                      setRecomendacaoAspiracaoSelecionada('');
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Acasalamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Acasalamento</DialogTitle>
                      <DialogDescription>
                        Selecione uma doadora do pacote e uma dose de sêmen. Você pode adicionar múltiplos acasalamentos para a mesma doadora.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddAcasalamento} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="aspiracao_doadora_id">Doadora *</Label>
                        <Select
                          value={acasalamentoForm.aspiracao_doadora_id}
                          onValueChange={async (value) => {
                            const aspiracao = aspiracoesDisponiveis.find((a) => a.id === value);
                            setAcasalamentoForm({ ...acasalamentoForm, aspiracao_doadora_id: value });
                            
                            // Carregar recomendação da aspiração selecionada
                            if (value) {
                              try {
                                const { data: aspiracaoData, error: aspiracaoError } = await supabase
                                  .from('aspiracoes_doadoras')
                                  .select('recomendacao_touro')
                                  .eq('id', value)
                                  .single();

                                if (aspiracaoError) {
                                  console.error('Erro ao carregar recomendação:', aspiracaoError);
                                  setRecomendacaoAspiracaoSelecionada('');
                                } else {
                                  setRecomendacaoAspiracaoSelecionada(aspiracaoData?.recomendacao_touro || '');
                                }
                              } catch (error) {
                                console.error('Erro ao carregar recomendação:', error);
                                setRecomendacaoAspiracaoSelecionada('');
                              }
                            } else {
                              setRecomendacaoAspiracaoSelecionada('');
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma doadora" />
                          </SelectTrigger>
                          <SelectContent>
                            {aspiracoesDisponiveis.map((aspiracao) => {
                              const doadora = doadoras.find((d) => d.id === aspiracao.doadora_id);
                              const oocitosDisponiveis = aspiracao.oocitos_disponiveis ?? 0;
                              const oocitosTotal = aspiracao.viaveis ?? 0;
                              const oocitosUsados = oocitosTotal - oocitosDisponiveis;
                              const doadoraNome = doadora 
                                ? (doadora.nome && doadora.registro 
                                    ? `${doadora.nome} (${doadora.registro})`
                                    : doadora.nome || doadora.registro || `Doadora ${aspiracao.doadora_id}`)
                                : `Doadora ${aspiracao.doadora_id}`;
                              
                              return (
                                <SelectItem key={aspiracao.id} value={aspiracao.id}>
                                  {`${doadoraNome} - ${oocitosDisponiveis} oócitos disponíveis (${oocitosTotal} total, ${oocitosUsados} usados)`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {acasalamentoForm.aspiracao_doadora_id && (() => {
                          const aspiracaoSelecionada = aspiracoesDisponiveis.find((a) => a.id === acasalamentoForm.aspiracao_doadora_id);
                          const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;
                          const oocitosTotal = aspiracaoSelecionada?.viaveis ?? 0;
                          const oocitosUsados = oocitosTotal - oocitosDisponiveis;
                          return (
                            <>
                              <p className="text-sm text-slate-600">
                                <strong>Oócitos disponíveis:</strong> {oocitosDisponiveis} (Total: {oocitosTotal}, Já usados: {oocitosUsados})
                              </p>
                              {recomendacaoAspiracaoSelecionada && (
                                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <p className="text-sm font-medium text-amber-800 mb-1">
                                    💡 Recomendação de Acasalamento:
                                  </p>
                                  <p className="text-sm text-amber-700">
                                    {recomendacaoAspiracaoSelecionada}
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dose_semen_id">Dose de Sêmen *</Label>
                        <Select
                          value={acasalamentoForm.dose_semen_id}
                          onValueChange={(value) => {
                            setAcasalamentoForm({ ...acasalamentoForm, dose_semen_id: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma dose de sêmen" />
                          </SelectTrigger>
                          <SelectContent>
                            {dosesDisponiveis.map((dose) => {
                              const cliente = clientes.find((c) => c.id === dose.cliente_id);
                              return (
                                <SelectItem key={dose.id} value={dose.id}>
                                  {dose.nome} {cliente ? `(${cliente.nome})` : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="quantidade_fracionada">Quantidade Fracionada *</Label>
                          <Input
                            id="quantidade_fracionada"
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={acasalamentoForm.quantidade_fracionada}
                            onChange={(e) => {
                              setAcasalamentoForm({ ...acasalamentoForm, quantidade_fracionada: e.target.value });
                            }}
                            placeholder="1.0"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quantidade_oocitos">Oócitos</Label>
                          <Input
                            id="quantidade_oocitos"
                            type="number"
                            min="0"
                            value={acasalamentoForm.quantidade_oocitos}
                            onChange={(e) => {
                              setAcasalamentoForm({ ...acasalamentoForm, quantidade_oocitos: e.target.value });
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      {acasalamentoForm.aspiracao_doadora_id && (() => {
                        const aspiracaoSelecionada = aspiracoesDisponiveis.find((a) => a.id === acasalamentoForm.aspiracao_doadora_id);
                        const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;
                        const oocitosTotal = aspiracaoSelecionada?.viaveis ?? 0;
                        const oocitosUsadosAnteriormente = oocitosTotal - oocitosDisponiveis;
                        const oocitosDistribuidosNesteForm = parseInt(acasalamentoForm.quantidade_oocitos) || 0;
                        const oocitosRestantes = oocitosDisponiveis - oocitosDistribuidosNesteForm;
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                              <strong>Total de oócitos viáveis:</strong> {oocitosTotal}
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Oócitos já usados em acasalamentos anteriores:</strong> {oocitosUsadosAnteriormente}
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Oócitos disponíveis:</strong> {oocitosDisponiveis}
                            </p>
                            <p className="text-sm text-blue-800">
                              <strong>Oócitos sendo distribuídos agora:</strong> {oocitosDistribuidosNesteForm}
                            </p>
                            <p className={`text-sm font-medium ${oocitosRestantes < 0 ? 'text-red-600' : oocitosRestantes === 0 ? 'text-green-600' : 'text-blue-800'}`}>
                              <strong>Oócitos restantes após esta distribuição:</strong> {oocitosRestantes}
                            </p>
                          </div>
                        );
                      })()}
                      <div className="space-y-2">
                        <Label htmlFor="observacoes">Observações</Label>
                        <Textarea
                          id="observacoes"
                          value={acasalamentoForm.observacoes}
                          onChange={(e) =>
                            setAcasalamentoForm({ ...acasalamentoForm, observacoes: e.target.value })
                          }
                          placeholder="Observações sobre este(s) acasalamento(s)"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddAcasalamento(false);
                            setAcasalamentoForm({
                              aspiracao_doadora_id: '',
                              dose_semen_id: '',
                              quantidade_fracionada: '1.0',
                              quantidade_oocitos: '',
                              observacoes: '',
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Histórico de Despachos */}
            {historicoDespachos.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Histórico de Despachos</h3>
                <div className="space-y-4">
                  {historicoDespachos.map((despacho) => (
                    <Card key={despacho.id} className="border-l-4 border-green-500">
                      <CardHeader>
                        <CardTitle className="text-base">
                          Despacho em {formatDate(despacho.data_despacho)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Doadora</TableHead>
                              <TableHead>Dose</TableHead>
                              <TableHead className="text-center">Quantidade de Embriões</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {despacho.acasalamentos.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-slate-500">
                                  Nenhum acasalamento registrado
                                </TableCell>
                              </TableRow>
                            ) : (
                              despacho.acasalamentos.map((ac, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{ac.doadora || '-'}</TableCell>
                                  <TableCell>{ac.dose || '-'}</TableCell>
                                  <TableCell className="text-center font-semibold">{ac.quantidade}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Dialog de Relatório de Prévia */}
        <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Relatório de Prévia de Produção - D6</DialogTitle>
              <DialogDescription>
                Relatório somente leitura com as quantidades de embriões preenchidas (prévia)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Lote FIV:</strong> {selectedLote.id.slice(0, 8)}...
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Data da Aspiração:</strong> {formatDate(dataAspiracao)}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Fazenda Origem:</strong> {fazendaOrigemNome}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  <strong>Fazendas Destino:</strong> {fazendasDestinoNomes.join(', ')}
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Dose de Sêmen</TableHead>
                    <TableHead>Quantidade Fracionada</TableHead>
                    <TableHead>Oócitos Viáveis</TableHead>
                    <TableHead>Oócitos Usados</TableHead>
                    <TableHead>Quantidade de Embriões (Prévia)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acasalamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Nenhum acasalamento cadastrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    acasalamentos.map((acasalamento) => {
                      const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || acasalamento.quantidade_embrioes?.toString() || '0');
                      return (
                        <TableRow key={acasalamento.id}>
                          <TableCell className="font-medium">
                            {acasalamento.doadora_nome || acasalamento.doadora_registro || 'Doadora desconhecida'}
                          </TableCell>
                          <TableCell>{acasalamento.dose_nome}</TableCell>
                          <TableCell>{acasalamento.quantidade_fracionada}</TableCell>
                          <TableCell>{acasalamento.viaveis ?? '-'}</TableCell>
                          <TableCell>{acasalamento.quantidade_oocitos ?? '-'}</TableCell>
                          <TableCell className="font-semibold">{quantidade}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowRelatorioDialog(false)}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    window.print();
                  }}
                >
                  Imprimir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Lista de lotes
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lotes FIV</h1>
          <p className="text-slate-600 mt-1">Gerenciar lotes de fecundação in vitro</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Lote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Lote FIV</DialogTitle>
              <DialogDescription>
                Selecione um pacote de aspiração FINALIZADO para criar o lote
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pacote_aspiracao_id">Pacote de Aspiração *</Label>
                {pacotes.length === 0 ? (
                  <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                    <p className="text-sm text-yellow-800 font-medium mb-2">
                      Nenhum pacote disponível
                    </p>
                    <p className="text-sm text-yellow-700">
                      Verifique se o pacote de aspiração está com status <strong>FINALIZADO</strong> e ainda não foi usado para criar um lote FIV.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={formData.pacote_aspiracao_id}
                    onValueChange={handlePacoteChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      {pacotes.map((pacote) => (
                        <SelectItem key={pacote.id} value={pacote.id}>
                          {formatDate(pacote.data_aspiracao)} - {pacote.fazenda_nome} ({pacote.quantidade_doadoras} doadoras)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedPacote && (
                  <div className="text-sm text-slate-600 space-y-1 mt-2 p-3 bg-slate-50 rounded-lg">
                    <p>
                      <strong>Data do Pacote:</strong> {formatDate(selectedPacote.data_aspiracao)}
                    </p>
                    <p>
                      <strong>Data de Fecundação do Lote:</strong>{' '}
                      {(() => {
                        const dataPacote = new Date(selectedPacote.data_aspiracao);
                        dataPacote.setDate(dataPacote.getDate() + 1);
                        return formatDate(dataPacote.toISOString().split('T')[0]);
                      })()}
                    </p>
                    <p>
                      <strong>Fazendas Destino:</strong>{' '}
                      {selectedPacote.fazendas_destino_nomes?.join(', ') || 'Nenhuma'}
                    </p>
                    <p>
                      <strong>Quantidade de Doadoras:</strong> {selectedPacote.quantidade_doadoras || 0}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Doses de Sêmen Disponíveis no Lote *</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {doses.length === 0 ? (
                    <p className="text-sm text-slate-500">Carregando doses...</p>
                  ) : (
                    <div className="space-y-2">
                      {doses.map((dose) => {
                        const cliente = clientes.find((c) => c.id === dose.cliente_id);
                        const isSelected = formData.doses_selecionadas.includes(dose.id);
                        return (
                          <div key={dose.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`dose-${dose.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    doses_selecionadas: [...formData.doses_selecionadas, dose.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    doses_selecionadas: formData.doses_selecionadas.filter((id) => id !== dose.id),
                                  });
                                }
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`dose-${dose.id}`} className="text-sm cursor-pointer flex-1">
                              <span className="font-medium">{dose.nome}</span>
                              {cliente && <span className="text-slate-500 ml-2">({cliente.nome})</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Selecione as doses de sêmen que estarão disponíveis para uso neste lote
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o lote"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Criando...' : 'Criar Lote'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setFormData({
                      pacote_aspiracao_id: '',
                      observacoes: '',
                      doses_selecionadas: [],
                    });
                    setSelectedPacote(null);
                    setAspiracoesDoadoras([]);
                    setDoadoras([]);
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>
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
                  onClick={() => {
                    setFiltroFazendaAspiracao('');
                    setFiltroFazendaAspiracaoBusca('');
                    setFiltroDiaCultivo('');
                    setShowFazendaBusca(false);
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>

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
              {lotesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {lotes.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote encontrado com os filtros selecionados'}
                  </TableCell>
                </TableRow>
              ) : (
                lotesFiltrados.map((lote) => (
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
