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
import { Plus, ArrowLeft, Eye, Lock, Calendar, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

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
  const [aspiracoesDisponiveis, setAspiracoesDisponiveis] = useState<AspiracaoComOocitosDisponiveis[]>([]);
  const [dosesDisponiveis, setDosesDisponiveis] = useState<DoseSemen[]>([]);
  const [fazendaOrigemNome, setFazendaOrigemNome] = useState<string>('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [recomendacaoAspiracaoSelecionada, setRecomendacaoAspiracaoSelecionada] = useState<string>('');
  const [dosesDisponiveisNoLote, setDosesDisponiveisNoLote] = useState<DoseSemen[]>([]);
  const [dataAspiracao, setDataAspiracao] = useState<string>('');
  const [filtroDataAspiracaoRange, setFiltroDataAspiracaoRange] = useState<DateRange | undefined>(undefined);
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
      0: 'Recepção + Maturação',
      1: 'Fecundação',
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
    if (dia === 0) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (dia === 1) return 'bg-green-100 text-green-800 border-green-300';
    if (dia >= 2 && dia <= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (dia >= 5 && dia <= 6) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (dia === 7) return 'bg-purple-100 text-purple-800 border-purple-300';
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

    // Filtrar por intervalo de data de aspiração
    if (filtroDataAspiracaoRange?.from && filtroDataAspiracaoRange?.to) {
      const dataInicio = filtroDataAspiracaoRange.from.toISOString().split('T')[0];
      const dataFim = filtroDataAspiracaoRange.to.toISOString().split('T')[0];
      filtrados = filtrados.filter((l) => {
        const dataAspiracaoLote = l.pacote_data?.split('T')[0] || '';
        return dataAspiracaoLote >= dataInicio && dataAspiracaoLote <= dataFim;
      });
    } else if (filtroDataAspiracaoRange?.from) {
      // Se só tem data inicial
      const dataInicio = filtroDataAspiracaoRange.from.toISOString().split('T')[0];
      filtrados = filtrados.filter((l) => {
        const dataAspiracaoLote = l.pacote_data?.split('T')[0] || '';
        return dataAspiracaoLote >= dataInicio;
      });
    }

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
  }, [lotes, filtroDataAspiracaoRange, filtroFazendaAspiracao, filtroDiaCultivo, pacotesParaFiltro]);

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
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        // Calcular dia atual baseado na data da aspiração (D0)
        // Sempre usar a data da aspiração do pacote, nunca a data_abertura diretamente
        let dataAspiracaoLote: Date;
        if (pacote?.data_aspiracao) {
          // Garantir que estamos usando apenas a data (YYYY-MM-DD) sem hora
          const dataAspiracaoStr = pacote.data_aspiracao.split('T')[0] + 'T00:00:00';
          dataAspiracaoLote = new Date(dataAspiracaoStr);
        } else {
          // Se não tiver data da aspiração, calcular baseado na data_abertura (que é aspiração + 1)
          const dataAberturaDate = new Date(l.data_abertura);
          dataAberturaDate.setDate(dataAberturaDate.getDate() - 1); // Voltar 1 dia para obter data da aspiração
          dataAspiracaoLote = dataAberturaDate;
        }
        dataAspiracaoLote.setHours(0, 0, 0, 0);
        
        // Calcular diferença em dias: hoje - data da aspiração
        const diffTime = hoje.getTime() - dataAspiracaoLote.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diaAtual = Math.max(0, diffDays);

        return {
          ...l,
          pacote_nome: pacote?.fazenda_nome,
          pacote_data: pacote?.data_aspiracao,
          fazendas_destino_nomes: fazendasDestinoPorLote.get(l.id) || [],
          quantidade_acasalamentos: quantidadeAcasalamentosPorLote.get(l.id) || 0,
          dia_atual: diaAtual,
        };
      });

      setLotes(lotesComNomes);
      setLotesFiltrados(lotesComNomes);
      
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

      // Armazenar data da aspiração para cálculo de dias (D0)
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
      let fazendaDestinoIds: string[] = [];
      if (!fazendasDestinoData || fazendasDestinoData.length === 0) {
        if (pacoteData.fazenda_destino_id) {
          fazendaDestinoIds = [pacoteData.fazenda_destino_id];
        }
      } else {
        fazendaDestinoIds = fazendasDestinoData.map((item) => item.fazenda_destino_id);
      }

      if (fazendaDestinoIds.length > 0) {
        const { data: fazendasDestinoNomesData, error: fazendasDestinoNomesError } = await supabase
          .from('fazendas')
          .select('nome')
          .in('id', fazendaDestinoIds);

        if (fazendasDestinoNomesError) {
          console.error('Erro ao carregar nomes das fazendas destino:', fazendasDestinoNomesError);
          setFazendasDestinoNomes([]);
        } else {
          setFazendasDestinoNomes(fazendasDestinoNomesData?.map((f) => f.nome) || []);
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
    // Calcular dia atual baseado na data da aspiração (D0)
    // D0 = dia da aspiração, D1 = aspiração + 1 dia, etc.
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Sempre usar a data da aspiração como referência (D0)
    // Se não tiver dataAspiracao carregada, buscar do pacote
    let dataAspiracaoParaCalculo = dataAspiracao;
    if (!dataAspiracaoParaCalculo && selectedLote.pacote_data) {
      dataAspiracaoParaCalculo = selectedLote.pacote_data;
    }
    
    // Se ainda não tiver, calcular baseado na data_abertura (que é aspiração + 1)
    if (!dataAspiracaoParaCalculo) {
      const dataAberturaDate = new Date(selectedLote.data_abertura);
      dataAberturaDate.setDate(dataAberturaDate.getDate() - 1); // Voltar 1 dia para obter data da aspiração
      dataAspiracaoParaCalculo = dataAberturaDate.toISOString().split('T')[0];
    }
    
    // Garantir que estamos usando apenas a data (YYYY-MM-DD) sem hora
    const dataAspiracaoDate = new Date(dataAspiracaoParaCalculo.split('T')[0] + 'T00:00:00');
    dataAspiracaoDate.setHours(0, 0, 0, 0);
    
    // Calcular diferença em dias: hoje - data da aspiração
    // Se hoje = 13/01 e aspiração = 13/01, então diaAtual = 0 (D0)
    // Se hoje = 14/01 e aspiração = 13/01, então diaAtual = 1 (D1)
    const diffTime = hoje.getTime() - dataAspiracaoDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diaAtual = Math.max(0, diffDays);
    // Dias restantes até D7: calcular corretamente
    // Se estamos em D0, faltam 7 dias para D7 (D0 -> D1 -> D2 -> D3 -> D4 -> D5 -> D6 -> D7)
    // Se estamos em D1, faltam 6 dias para D7
    // Se estamos em D7 ou depois, mostrar 0 ou mensagem apropriada
    const diasRestantes = diaAtual < 7 ? (7 - diaAtual) : 0;

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
                Data de fecundação (D1): {formatDate(selectedLote.data_abertura)} | 
                {dataAspiracao && ` Data aspiração (D0): ${formatDate(dataAspiracao)} |`}
                {diaAtual <= 8 && ` D${diaAtual} - ${getNomeDia(diaAtual)} |`}
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
                  D{diaAtual} {diaAtual <= 8 && <span className="text-lg font-normal text-slate-600">- {getNomeDia(diaAtual)}</span>}
                </p>
              </div>
              <div>
                <Label>Dias Restantes até D7</Label>
                {diaAtual < 7 ? (
                  <p className="text-2xl font-bold text-orange-600">{diasRestantes}</p>
                ) : diaAtual === 7 || diaAtual === 8 ? (
                  <p className="text-2xl font-bold text-green-600">Período de classificação</p>
                ) : (
                  <p className="text-2xl font-bold text-red-600">Prazo encerrado</p>
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

            {selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-800 font-medium">
                  ⚠️ Este lote está no D{diaAtual} ({getNomeDia(diaAtual)}). Informe a quantidade de embriões para cada acasalamento.
                </p>
              </div>
            )}
            {selectedLote.status === 'ABERTO' && diaAtual > 8 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  ⚠️ Este lote está no D{diaAtual}. O prazo para informar embriões (D7-D8) já passou.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Dose de Sêmen</TableHead>
                  <TableHead>Quantidade Fracionada</TableHead>
                  <TableHead>Oócitos Viáveis (Total)</TableHead>
                  <TableHead>Oócitos Usados</TableHead>
                  {selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8 && (
                    <TableHead>Quantidade de Embriões</TableHead>
                  )}
                  {selectedLote.status === 'FECHADO' && <TableHead>Quantidade de Embriões</TableHead>}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acasalamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedLote.status === 'FECHADO' || (selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8) ? 7 : 6} className="text-center text-slate-500">
                      Nenhum acasalamento cadastrado
                    </TableCell>
                  </TableRow>
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

                  const rows: React.ReactElement[] = [];
                  acasalamentosPorDoadora.forEach((acasalamentosGrupo) => {
                    const primeiroAcasalamento = acasalamentosGrupo[0];
                    const oocitosTotal = primeiroAcasalamento.viaveis ?? 0;

                    // Renderizar cada acasalamento do grupo
                    acasalamentosGrupo.forEach((acasalamento, index) => {
                      rows.push(
                        <TableRow key={acasalamento.id} className={index > 0 ? 'bg-slate-50/50' : ''}>
                          <TableCell className="font-medium">
                            {index === 0 && (
                              <>
                                {acasalamento.doadora_nome || acasalamento.doadora_registro || 'Doadora desconhecida'}
                                {acasalamento.doadora_registro && acasalamento.doadora_nome && (
                                  <span className="text-slate-500 text-sm ml-2">
                                    ({acasalamento.doadora_registro})
                                  </span>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell>{acasalamento.dose_nome}</TableCell>
                          <TableCell>{acasalamento.quantidade_fracionada}</TableCell>
                          <TableCell>
                            {index === 0 ? oocitosTotal : ''}
                          </TableCell>
                          <TableCell>{acasalamento.quantidade_oocitos ?? '-'}</TableCell>
                          {(selectedLote.status === 'FECHADO' || (selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8)) && (
                            <TableCell>
                              {selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8 ? (
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
                                  className="w-24"
                                  placeholder="0"
                                />
                              ) : (
                                acasalamento.quantidade_embrioes ?? '-'
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            {selectedLote.status === 'ABERTO' && diaAtual >= 7 && diaAtual <= 8 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || '0');
                                  if (isNaN(quantidade) || quantidade < 0) {
                                    toast({
                                      title: 'Erro',
                                      description: 'Quantidade inválida',
                                      variant: 'destructive',
                                    });
                                    return;
                                  }

                                  try {
                                    const { error } = await supabase
                                      .from('lote_fiv_acasalamentos')
                                      .update({ quantidade_embrioes: quantidade })
                                      .eq('id', acasalamento.id);

                                    if (error) throw error;

                                    toast({
                                      title: 'Quantidade atualizada',
                                      description: 'Quantidade de embriões atualizada com sucesso',
                                    });

                                    setEditQuantidadeEmbrioes({
                                      ...editQuantidadeEmbrioes,
                                      [acasalamento.id]: quantidade.toString(),
                                    });

                                    loadLoteDetail(selectedLote.id);
                                  } catch (error) {
                                    toast({
                                      title: 'Erro ao atualizar',
                                      description: error instanceof Error ? error.message : 'Erro desconhecido',
                                      variant: 'destructive',
                                    });
                                  }
                                }}
                              >
                                Salvar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  });

                  return rows;
                })()}
              </TableBody>
            </Table>
            {selectedLote.status === 'ABERTO' && diaAtual < 7 && (
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
          </CardContent>
        </Card>
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
            <div className="flex-1 min-w-[250px]">
              <Label htmlFor="filtro-data-aspiração">Filtrar por Dia de Aspiração</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="filtro-data-aspiração"
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !filtroDataAspiracaoRange && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filtroDataAspiracaoRange?.from ? (
                      filtroDataAspiracaoRange.to ? (
                        <>
                          {formatDate(filtroDataAspiracaoRange.from.toISOString())} -{' '}
                          {formatDate(filtroDataAspiracaoRange.to.toISOString())}
                        </>
                      ) : (
                        formatDate(filtroDataAspiracaoRange.from.toISOString())
                      )
                    ) : (
                      <span>Selecione um intervalo</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    defaultMonth={filtroDataAspiracaoRange?.from}
                    selected={filtroDataAspiracaoRange}
                    onSelect={setFiltroDataAspiracaoRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
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
            {(filtroDataAspiracaoRange || filtroFazendaAspiracao || filtroDiaCultivo) && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltroDataAspiracaoRange(undefined);
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
                          className={`font-semibold ${getCorDia(lote.dia_atual)}`}
                        >
                          D{lote.dia_atual} - {getNomeDia(lote.dia_atual)}
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
