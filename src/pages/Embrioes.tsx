import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Embriao, Fazenda, HistoricoEmbriao } from '@/lib/types';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Snowflake, ArrowRightLeft, Tag, MapPin, Trash2, History, ChevronDown, ChevronUp, Package, CheckSquare, Square } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { HistoricoEmbriao } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface EmbrioCompleto extends Embriao {
  doadora_registro?: string;
  touro_nome?: string;
  fazenda_destino_nome?: string;
  data_aspiracao?: string;
  pacote_aspiracao_id?: string;
}

interface PacoteAspiracaoInfo {
  id: string;
  data_aspiracao: string;
  fazenda_nome?: string;
  quantidade_doadoras: number;
  horario_inicio?: string;
  veterinario_responsavel?: string;
  total_oocitos?: number;
}

interface PacoteEmbrioes {
  id: string; // ID único do pacote (fazenda_destino_id + pacote_aspiracao_id)
  fazenda_destino_id: string;
  fazenda_destino_nome: string;
  pacote_aspiracao_id: string;
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
  sem_classificacao: number;
  classificados: {
    BE: number;
    BN: number;
    BX: number;
    BL: number;
    BI: number;
  };
}

export default function Embrioes() {
  const navigate = useNavigate();
  const [embrioes, setEmbrioes] = useState<EmbrioCompleto[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaDestinoId, setSelectedFazendaDestinoId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pacotesExpandidos, setPacotesExpandidos] = useState<Set<string>>(new Set());
  const [embrioesSelecionados, setEmbrioesSelecionados] = useState<Set<string>>(new Set());
  const [showAcoesEmMassa, setShowAcoesEmMassa] = useState(false);
  const [showCongelarDialog, setShowCongelarDialog] = useState(false);
  const [showClassificarDialog, setShowClassificarDialog] = useState(false);
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [classificarEmbriao, setClassificarEmbriao] = useState<Embriao | null>(null);
  const [descartarEmbriao, setDescartarEmbriao] = useState<Embriao | null>(null);
  const [historicoEmbriao, setHistoricoEmbriao] = useState<Embriao | null>(null);
  const [historico, setHistorico] = useState<HistoricoEmbriao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const { toast } = useToast();

  const [congelarData, setCongelarData] = useState({
    data_congelamento: new Date().toISOString().split('T')[0],
    localizacao_atual: '',
  });

  const [classificarData, setClassificarData] = useState({
    classificacao: '',
  });

  const [descartarData, setDescartarData] = useState({
    data_descarte: new Date().toISOString().split('T')[0],
    observacoes: '',
  });

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (selectedFazendaDestinoId) {
      loadData();
    } else {
      setEmbrioes([]);
      setPacotes([]);
      setLoading(false);
    }
  }, [selectedFazendaDestinoId]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
    }
  };

  // Função auxiliar para registrar histórico
  const registrarHistorico = async (
    embriaoId: string,
    statusAnterior: string | null,
    statusNovo: string,
    tipoOperacao: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA',
    fazendaId?: string | null,
    observacoes?: string | null
  ) => {
    try {
      const { error } = await supabase.from('historico_embrioes').insert([
        {
          embriao_id: embriaoId,
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          tipo_operacao: tipoOperacao,
          fazenda_id: fazendaId || null,
          observacoes: observacoes || null,
          data_mudanca: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error('Erro ao registrar histórico:', error);
      }
    } catch (error) {
      console.error('Erro ao registrar histórico:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar embriões disponíveis (FRESCO ou CONGELADO)
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .in('status_atual', ['FRESCO', 'CONGELADO'])
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

      if (!embrioesData || embrioesData.length === 0) {
        setEmbrioes([]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      // Buscar acasalamentos
      const acasalamentoIds = [
        ...new Set(embrioesData.filter((e) => e.lote_fiv_acasalamento_id).map((e) => e.lote_fiv_acasalamento_id)),
      ] as string[];

      if (acasalamentoIds.length === 0) {
        setEmbrioes(embrioesData as EmbrioCompleto[]);
        setPacotes([]);
        setLoading(false);
        return;
      }

      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIds);

      if (acasalamentosError) throw acasalamentosError;

      // Buscar aspirações
      const aspiracaoIds = [
        ...new Set(acasalamentosData?.map((a) => a.aspiracao_doadora_id) || []),
      ];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id')
        .in('id', aspiracaoIds);

      if (aspiracoesError) throw aspiracoesError;

      // Buscar doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, registro')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      // Buscar doses
      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .in('id', doseIds);

      if (dosesError) throw dosesError;

      // Buscar lotes FIV para obter pacotes de aspiração
      const loteFivIds = [
        ...new Set(embrioesData.filter((e) => e.lote_fiv_id).map((e) => e.lote_fiv_id)),
      ] as string[];

      let pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      let pacoteParaLoteMap = new Map<string, string>(); // lote_fiv_id -> pacote_aspiracao_id
      let fazendasDestinoPorPacoteMap = new Map<string, string[]>(); // pacote_id -> fazenda_destino_ids[]

      if (loteFivIds.length > 0) {
        const { data: lotesFivData, error: lotesFivError } = await supabase
          .from('lotes_fiv')
          .select('id, pacote_aspiracao_id')
          .in('id', loteFivIds);

        if (!lotesFivError && lotesFivData) {
          lotesFivData.forEach(lote => {
            if (lote.pacote_aspiracao_id) {
              pacoteParaLoteMap.set(lote.id, lote.pacote_aspiracao_id);
            }
          });

          const pacoteIds = [...new Set(lotesFivData.map((l) => l.pacote_aspiracao_id).filter(Boolean))] as string[];
          
          if (pacoteIds.length > 0) {
            // Buscar informações completas dos pacotes
            const { data: pacotesData, error: pacotesError } = await supabase
              .from('pacotes_aspiracao')
              .select('id, data_aspiracao, fazenda_id, horario_inicio, veterinario_responsavel, total_oocitos')
              .in('id', pacoteIds);

            if (!pacotesError && pacotesData) {
              // Buscar nomes das fazendas
              const fazendaIds = [...new Set(pacotesData.map((p) => p.fazenda_id))];
              const { data: fazendasData } = await supabase
                .from('fazendas')
                .select('id, nome')
                .in('id', fazendaIds);

              const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]) || []);

              // Contar doadoras por pacote
              const { data: aspiracoesData } = await supabase
                .from('aspiracoes_doadoras')
                .select('pacote_aspiracao_id')
                .in('pacote_aspiracao_id', pacoteIds);

              const quantidadePorPacote = new Map<string, number>();
              aspiracoesData?.forEach((a) => {
                if (a.pacote_aspiracao_id) {
                  quantidadePorPacote.set(
                    a.pacote_aspiracao_id,
                    (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
                  );
                }
              });

              pacotesData.forEach((pacote) => {
                pacotesAspiracaoMap.set(pacote.id, {
                  id: pacote.id,
                  data_aspiracao: pacote.data_aspiracao,
                  fazenda_nome: fazendasMap.get(pacote.fazenda_id),
                  quantidade_doadoras: quantidadePorPacote.get(pacote.id) || 0,
                  horario_inicio: pacote.horario_inicio,
                  veterinario_responsavel: pacote.veterinario_responsavel,
                  total_oocitos: pacote.total_oocitos,
                });
              });

              // Buscar fazendas destino dos pacotes
              const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
                .from('pacotes_aspiracao_fazendas_destino')
                .select('pacote_aspiracao_id, fazenda_destino_id')
                .in('pacote_aspiracao_id', pacoteIds);

              if (!fazendasDestinoError && fazendasDestinoData) {
                fazendasDestinoData.forEach(item => {
                  const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
                  if (!atual.includes(item.fazenda_destino_id)) {
                    atual.push(item.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
                });
              }

              // Fallback: buscar fazenda_destino_id legacy dos pacotes
              const { data: pacotesDataLegacy } = await supabase
                .from('pacotes_aspiracao')
                .select('id, fazenda_destino_id')
                .in('id', pacoteIds);

              pacotesDataLegacy?.forEach(pacote => {
                if (pacote.fazenda_destino_id) {
                  const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
                  if (!atual.includes(pacote.fazenda_destino_id)) {
                    atual.push(pacote.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(pacote.id, atual);
                }
              });
            }
          }
        }
      }

      // Buscar nomes das fazendas destino
      const todasFazendasDestinoIds = new Set<string>();
      fazendasDestinoPorPacoteMap.forEach(ids => {
        ids.forEach(id => todasFazendasDestinoIds.add(id));
      });
      embrioesData.forEach(e => {
        if (e.fazenda_destino_id) {
          todasFazendasDestinoIds.add(e.fazenda_destino_id);
        }
      });

      let fazendasDestinoMap = new Map<string, string>();
      if (todasFazendasDestinoIds.size > 0) {
        const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', Array.from(todasFazendasDestinoIds));

        if (!fazendasDestinoError && fazendasDestinoData) {
          fazendasDestinoMap = new Map(fazendasDestinoData.map((f) => [f.id, f.nome]));
        }
      }

      // Mapear dados
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]) || []);
      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d]) || []);
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d]) || []);
      const acasalamentosMap = new Map(acasalamentosData?.map((a) => [a.id, a]) || []);

      const embrioesCompletos: EmbrioCompleto[] = embrioesData.map((embriao) => {
        const acasalamento = embriao.lote_fiv_acasalamento_id
          ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
          : undefined;
        const aspiracao = acasalamento
          ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
          : undefined;
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;
        
        // Obter dados do pacote de aspiração
        const pacoteId = embriao.lote_fiv_id ? pacoteParaLoteMap.get(embriao.lote_fiv_id) : undefined;
        const pacoteInfo = pacoteId ? pacotesAspiracaoMap.get(pacoteId) : undefined;

        return {
          ...embriao,
          doadora_registro: doadora?.registro,
          touro_nome: dose?.nome,
          fazenda_destino_nome: embriao.fazenda_destino_id
            ? fazendasDestinoMap.get(embriao.fazenda_destino_id)
            : undefined,
          data_aspiracao: pacoteInfo?.data_aspiracao,
          pacote_aspiracao_id: pacoteId,
        };
      });

      setEmbrioes(embrioesCompletos);

      // Filtrar embriões pela fazenda destino selecionada
      // Um embrião está disponível para uma fazenda se:
      // 1. O embrião tem fazenda_destino_id igual à selecionada, OU
      // 2. O pacote de aspiração do embrião tem a fazenda selecionada em suas fazendas destino
      const embrioesFiltrados = selectedFazendaDestinoId
        ? embrioesCompletos.filter(embriao => {
            // Verificar se o embrião tem fazenda_destino_id direto
            if (embriao.fazenda_destino_id === selectedFazendaDestinoId) {
              return true;
            }
            
            // Verificar se o pacote de aspiração tem a fazenda como destino
            const pacoteId = embriao.pacote_aspiracao_id;
            if (pacoteId) {
              const fazendasDestinoPacote = fazendasDestinoPorPacoteMap.get(pacoteId) || [];
              return fazendasDestinoPacote.includes(selectedFazendaDestinoId);
            }
            
            return false;
          })
        : embrioesCompletos;

      // Agrupar embriões por pacote (fazenda_destino_id + pacote_aspiracao_id)
      // Um pacote = conjunto de embriões de uma aspiração destinados a uma fazenda específica
      const pacotesMap = new Map<string, PacoteEmbrioes>();
      
      embrioesFiltrados.forEach((embriao) => {
        // Determinar a fazenda destino do pacote
        // Prioridade: fazenda_destino_id do embrião, depois fazendas destino do pacote
        let fazendaDestinoId = embriao.fazenda_destino_id;
        if (!fazendaDestinoId && embriao.pacote_aspiracao_id) {
          const fazendasDestinoPacote = fazendasDestinoPorPacoteMap.get(embriao.pacote_aspiracao_id) || [];
          if (fazendasDestinoPacote.length > 0) {
            // Se há múltiplas fazendas, usar a selecionada ou a primeira
            fazendaDestinoId = selectedFazendaDestinoId && fazendasDestinoPacote.includes(selectedFazendaDestinoId)
              ? selectedFazendaDestinoId
              : fazendasDestinoPacote[0];
          }
        }
        
        const fazendaDestinoIdFinal = fazendaDestinoId || 'sem-destino';
        const pacoteAspiracaoId = embriao.pacote_aspiracao_id || 'sem-pacote';
        const chavePacote = `${fazendaDestinoIdFinal}-${pacoteAspiracaoId}`;
        
        let pacote = pacotesMap.get(chavePacote);
        if (!pacote) {
          const pacoteInfo = pacoteAspiracaoId !== 'sem-pacote' 
            ? pacotesAspiracaoMap.get(pacoteAspiracaoId)
            : undefined;
          
          pacote = {
            id: chavePacote,
            fazenda_destino_id: fazendaDestinoIdFinal,
            fazenda_destino_nome: fazendasDestinoMap.get(fazendaDestinoIdFinal) || 'Sem destino',
            pacote_aspiracao_id: pacoteAspiracaoId,
            pacote_info: pacoteInfo || {
              id: pacoteAspiracaoId,
              data_aspiracao: embriao.data_aspiracao || '',
              quantidade_doadoras: 0,
            },
            embrioes: [],
            total: 0,
            frescos: 0,
            congelados: 0,
            sem_classificacao: 0,
            classificados: {
              BE: 0,
              BN: 0,
              BX: 0,
              BL: 0,
              BI: 0,
            },
          };
          pacotesMap.set(chavePacote, pacote);
        }
        
        pacote.embrioes.push(embriao);
        pacote.total++;
        
        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
        
        if (!embriao.classificacao) {
          pacote.sem_classificacao++;
        } else {
          const classificacao = embriao.classificacao.toUpperCase();
          if (classificacao === 'BE') pacote.classificados.BE++;
          else if (classificacao === 'BN') pacote.classificados.BN++;
          else if (classificacao === 'BX') pacote.classificados.BX++;
          else if (classificacao === 'BL') pacote.classificados.BL++;
          else if (classificacao === 'BI') pacote.classificados.BI++;
        }
      });

      const pacotesArray = Array.from(pacotesMap.values())
        .sort((a, b) => {
          // Ordenar por data de aspiração (mais recente primeiro), depois por fazenda destino
          const dataA = a.pacote_info.data_aspiracao || '';
          const dataB = b.pacote_info.data_aspiracao || '';
          if (dataA !== dataB) {
            return dataB.localeCompare(dataA);
          }
          return a.fazenda_destino_nome.localeCompare(b.fazenda_destino_nome);
        });

      setPacotes(pacotesArray);
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

  const toggleExpandirPacote = (pacoteId: string) => {
    const novoSet = new Set(pacotesExpandidos);
    if (novoSet.has(pacoteId)) {
      novoSet.delete(pacoteId);
    } else {
      novoSet.add(pacoteId);
    }
    setPacotesExpandidos(novoSet);
  };

  const toggleSelecionarEmbriao = (embriaoId: string) => {
    const novoSet = new Set(embrioesSelecionados);
    if (novoSet.has(embriaoId)) {
      novoSet.delete(embriaoId);
    } else {
      novoSet.add(embriaoId);
    }
    setEmbrioesSelecionados(novoSet);
    setShowAcoesEmMassa(novoSet.size > 0);
  };

  const selecionarTodosDoPacote = (pacote: PacoteEmbrioes) => {
    const novoSet = new Set(embrioesSelecionados);
    const todosSelecionados = pacote.embrioes.every(e => novoSet.has(e.id));
    
    if (todosSelecionados) {
      // Desmarcar todos
      pacote.embrioes.forEach(e => novoSet.delete(e.id));
    } else {
      // Marcar todos
      pacote.embrioes.forEach(e => novoSet.add(e.id));
    }
    
    setEmbrioesSelecionados(novoSet);
    setShowAcoesEmMassa(novoSet.size > 0);
  };

  const handleClassificar = async (embriaoId?: string) => {
    const embriaoParaClassificar = embriaoId 
      ? embrioes.find(e => e.id === embriaoId)
      : classificarEmbriao;
    
    if (!embriaoParaClassificar || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Classificação é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const statusAnterior = embriaoParaClassificar.status_atual;
      const statusNovo = embriaoParaClassificar.status_atual;

      const { error } = await supabase
        .from('embrioes')
        .update({
          classificacao: classificarData.classificacao,
          data_classificacao: new Date().toISOString().split('T')[0],
        })
        .eq('id', embriaoParaClassificar.id);

      if (error) throw error;

      await registrarHistorico(
        embriaoParaClassificar.id,
        statusAnterior,
        statusNovo,
        'CLASSIFICACAO',
        null,
        `Classificação: ${classificarData.classificacao}`
      );

      toast({
        title: 'Embrião classificado',
        description: 'Classificação salva com sucesso',
      });

      setShowClassificarDialog(false);
      setClassificarEmbriao(null);
      setClassificarData({ classificacao: '' });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao classificar embrião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClassificarEmMassa = async () => {
    if (embrioesSelecionados.size === 0 || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião e uma classificação',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const embrioesParaClassificar = Array.from(embrioesSelecionados);
      
      const updates = embrioesParaClassificar.map(embriaoId => {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (!embriao) return null;

        return supabase
          .from('embrioes')
          .update({
            classificacao: classificarData.classificacao,
            data_classificacao: new Date().toISOString().split('T')[0],
          })
          .eq('id', embriaoId);
      }).filter(Boolean);

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      for (const embriaoId of embrioesParaClassificar) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            embriao.status_atual,
            'CLASSIFICACAO',
            null,
            `Classificação: ${classificarData.classificacao}`
          );
        }
      }

      toast({
        title: 'Embriões classificados',
        description: `${embrioesParaClassificar.length} embrião(ões) classificados com sucesso`,
      });

      setShowClassificarDialog(false);
      setClassificarData({ classificacao: '' });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao classificar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCongelarEmMassa = async () => {
    if (embrioesSelecionados.size === 0 || !congelarData.localizacao_atual.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião e informe a localização',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const embrioesParaCongelar = Array.from(embrioesSelecionados);
      
      const updates = embrioesParaCongelar.map(embriaoId => {
        return supabase
          .from('embrioes')
          .update({
            status_atual: 'CONGELADO',
            data_congelamento: congelarData.data_congelamento,
            localizacao_atual: congelarData.localizacao_atual,
          })
          .eq('id', embriaoId);
      });

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      for (const embriaoId of embrioesParaCongelar) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            'CONGELADO',
            'CONGELAMENTO',
            null,
            `Localização: ${congelarData.localizacao_atual}`
          );
        }
      }

      toast({
        title: 'Embriões congelados',
        description: `${embrioesParaCongelar.length} embrião(ões) congelados com sucesso`,
      });

      setShowCongelarDialog(false);
      setCongelarData({
        data_congelamento: new Date().toISOString().split('T')[0],
        localizacao_atual: '',
      });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao congelar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDescartarEmMassa = async () => {
    if (embrioesSelecionados.size === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione pelo menos um embrião',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const embrioesParaDescartar = Array.from(embrioesSelecionados);
      
      const updates = embrioesParaDescartar.map(embriaoId => {
        return supabase
          .from('embrioes')
          .update({
            status_atual: 'DESCARTADO',
            data_descarte: descartarData.data_descarte,
          })
          .eq('id', embriaoId);
      });

      await Promise.all(updates);

      // Registrar histórico para cada embrião
      for (const embriaoId of embrioesParaDescartar) {
        const embriao = embrioes.find(e => e.id === embriaoId);
        if (embriao) {
          await registrarHistorico(
            embriao.id,
            embriao.status_atual,
            'DESCARTADO',
            'DESCARTE',
            null,
            descartarData.observacoes || null
          );
        }
      }

      toast({
        title: 'Embriões descartados',
        description: `${embrioesParaDescartar.length} embrião(ões) descartados com sucesso`,
      });

      setShowDescartarDialog(false);
      setDescartarData({
        data_descarte: new Date().toISOString().split('T')[0],
        observacoes: '',
      });
      setEmbrioesSelecionados(new Set());
      setShowAcoesEmMassa(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao descartar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistorico = async (embriaoId: string) => {
    try {
      setLoadingHistorico(true);

      const { data, error } = await supabase
        .from('historico_embrioes')
        .select('*')
        .eq('embriao_id', embriaoId)
        .order('data_mudanca', { ascending: false });

      if (error) throw error;
      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistorico(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Estoque de Embriões</h1>
          <p className="text-slate-600 mt-1">Gerenciar pacotes de embriões para transferência, congelamento ou descarte</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pacotes de Embriões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 space-y-2">
            <Label htmlFor="fazenda_destino">Filtrar por Fazenda Destino</Label>
            <Select
              value={selectedFazendaDestinoId || 'all'}
              onValueChange={(value) => setSelectedFazendaDestinoId(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Todas as fazendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fazendas</SelectItem>
                {fazendas.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedFazendaDestinoId ? (
            <div className="text-center text-slate-500 py-12">
              <div className="flex flex-col items-center gap-2">
                <MapPin className="w-8 h-8 text-slate-400" />
                <p className="text-lg font-medium">Selecione uma fazenda destino</p>
                <p className="text-sm">Escolha uma fazenda para visualizar os pacotes de embriões disponíveis</p>
              </div>
            </div>
          ) : pacotes.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              Nenhum pacote de embriões encontrado para esta fazenda destino
            </div>
          ) : (
            <div className="space-y-4">
              {pacotes.map((pacote) => {
                const expandido = pacotesExpandidos.has(pacote.id);
                const todosSelecionados = pacote.embrioes.every(e => embrioesSelecionados.has(e.id));
                const algunsSelecionados = pacote.embrioes.some(e => embrioesSelecionados.has(e.id));

                return (
                  <Card key={pacote.id} className="border-l-4 border-l-green-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandirPacote(pacote.id)}
                              className="p-0 h-auto"
                            >
                              {expandido ? (
                                <ChevronUp className="w-5 h-5 text-slate-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-600" />
                              )}
                            </Button>
                            <CardTitle className="text-lg">
                              {pacote.pacote_info.fazenda_nome || 'Fazenda não identificada'} → {pacote.fazenda_destino_nome}
                            </CardTitle>
                          </div>
                          <div className="mt-2 ml-7 space-y-1 text-sm text-slate-600">
                            <p><strong>Data Aspiração:</strong> {pacote.pacote_info.data_aspiracao ? formatDate(pacote.pacote_info.data_aspiracao) : '-'}</p>
                            {pacote.pacote_info.horario_inicio && (
                              <p><strong>Horário:</strong> {pacote.pacote_info.horario_inicio}</p>
                            )}
                            {pacote.pacote_info.veterinario_responsavel && (
                              <p><strong>Veterinário:</strong> {pacote.pacote_info.veterinario_responsavel}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">{pacote.total}</div>
                            <div className="text-sm text-slate-600">embriões</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {pacote.frescos} frescos, {pacote.congelados} congelados
                            </div>
                            <div className="text-xs text-slate-500">
                              {pacote.sem_classificacao} sem classificação
                            </div>
                            {pacote.classificados.BE > 0 || pacote.classificados.BN > 0 || pacote.classificados.BX > 0 || pacote.classificados.BL > 0 || pacote.classificados.BI > 0 ? (
                              <div className="text-xs text-slate-500 mt-1">
                                BE: {pacote.classificados.BE} | BN: {pacote.classificados.BN} | BX: {pacote.classificados.BX} | BL: {pacote.classificados.BL} | BI: {pacote.classificados.BI}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    {expandido && (
                      <CardContent>
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selecionarTodosDoPacote(pacote)}
                            >
                              {todosSelecionados ? (
                                <CheckSquare className="w-4 h-4 mr-2" />
                              ) : (
                                <Square className="w-4 h-4 mr-2" />
                              )}
                              {todosSelecionados ? 'Desmarcar Todos' : 'Selecionar Todos'}
                            </Button>
                            <span className="text-sm text-slate-600">
                              {algunsSelecionados && `${pacote.embrioes.filter(e => embrioesSelecionados.has(e.id)).length} selecionado(s)`}
                            </span>
                          </div>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Identificação</TableHead>
                              <TableHead>Doadora</TableHead>
                              <TableHead>Touro</TableHead>
                              <TableHead>Classificação</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Localização</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pacote.embrioes.map((embriao) => {
                              const selecionado = embrioesSelecionados.has(embriao.id);
                              return (
                                <TableRow key={embriao.id}>
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="p-0 h-auto"
                                      onClick={() => toggleSelecionarEmbriao(embriao.id)}
                                    >
                                      {selecionado ? (
                                        <CheckSquare className="w-4 h-4 text-green-600" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {embriao.identificacao || embriao.id.slice(0, 8)}
                                  </TableCell>
                                  <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                                  <TableCell>{embriao.touro_nome || '-'}</TableCell>
                                  <TableCell>
                                    {embriao.classificacao ? (
                                      <Badge variant="outline">{embriao.classificacao}</Badge>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={embriao.status_atual} />
                                  </TableCell>
                                  <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex gap-1 justify-end">
                                      {!embriao.classificacao && embriao.status_atual === 'FRESCO' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setClassificarEmbriao(embriao);
                                            setClassificarData({ classificacao: '' });
                                            setShowClassificarDialog(true);
                                          }}
                                          title="Classificar"
                                        >
                                          <Tag className="w-4 h-4 text-purple-600" />
                                        </Button>
                                      )}
                                      {embriao.classificacao && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setClassificarEmbriao(embriao);
                                            setClassificarData({ classificacao: embriao.classificacao || '' });
                                            setShowClassificarDialog(true);
                                          }}
                                          title="Editar Classificação"
                                        >
                                          <Tag className="w-4 h-4 text-purple-600" />
                                        </Button>
                                      )}
                                      {embriao.status_atual === 'FRESCO' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setShowCongelarDialog(true);
                                            setEmbrioesSelecionados(new Set([embriao.id]));
                                          }}
                                          title="Congelar"
                                        >
                                          <Snowflake className="w-4 h-4 text-blue-600" />
                                        </Button>
                                      )}
                                      {(embriao.status_atual === 'FRESCO' || embriao.status_atual === 'CONGELADO') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => navigate('/transferencia')}
                                          title="Transferir"
                                        >
                                          <ArrowRightLeft className="w-4 h-4 text-green-600" />
                                        </Button>
                                      )}
                                      {(embriao.status_atual === 'FRESCO' || embriao.status_atual === 'CONGELADO') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setDescartarEmbriao(embriao);
                                            setDescartarData({
                                              data_descarte: new Date().toISOString().split('T')[0],
                                              observacoes: '',
                                            });
                                            setShowDescartarDialog(true);
                                          }}
                                          title="Descartar"
                                        >
                                          <Trash2 className="w-4 h-4 text-red-600" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                          setHistoricoEmbriao(embriao);
                                          setShowHistoricoDialog(true);
                                          await loadHistorico(embriao.id);
                                        }}
                                        title="Ver Histórico"
                                      >
                                        <History className="w-4 h-4 text-slate-600" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Barra de ações em massa */}
          {showAcoesEmMassa && (
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-600" />
                <span className="font-medium text-slate-900">
                  {embrioesSelecionados.size} embrião(ões) selecionado(s)
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClassificarData({ classificacao: '' });
                    setShowClassificarDialog(true);
                  }}
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Classificar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCongelarData({
                      data_congelamento: new Date().toISOString().split('T')[0],
                      localizacao_atual: '',
                    });
                    setShowCongelarDialog(true);
                  }}
                >
                  <Snowflake className="w-4 h-4 mr-2" />
                  Congelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescartarData({
                      data_descarte: new Date().toISOString().split('T')[0],
                      observacoes: '',
                    });
                    setShowDescartarDialog(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Descartar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEmbrioesSelecionados(new Set());
                    setShowAcoesEmMassa(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Classificação Individual */}
      <Dialog open={showClassificarDialog && !!classificarEmbriao} onOpenChange={(open) => {
        if (!open) {
          setShowClassificarDialog(false);
          setClassificarEmbriao(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar Embrião</DialogTitle>
            <DialogDescription>
              Classificar embrião {classificarEmbriao?.identificacao || 'selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação *</Label>
              <Select
                value={classificarData.classificacao}
                onValueChange={(value) => setClassificarData({ classificacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
                  <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
                  <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
                  <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
                  <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleClassificar()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Classificação'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowClassificarDialog(false);
                  setClassificarEmbriao(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Classificação em Massa */}
      <Dialog open={showClassificarDialog && !classificarEmbriao && embrioesSelecionados.size > 0} onOpenChange={(open) => {
        if (!open) {
          setShowClassificarDialog(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Classificar todos os embriões selecionados com a mesma classificação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação *</Label>
              <Select
                value={classificarData.classificacao}
                onValueChange={(value) => setClassificarData({ classificacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
                  <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
                  <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
                  <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
                  <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleClassificarEmMassa}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : `Classificar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowClassificarDialog(false);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Congelamento em Massa */}
      <Dialog open={showCongelarDialog} onOpenChange={setShowCongelarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Congelar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Registrar congelamento dos embriões selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_congelamento">Data de Congelamento *</Label>
              <Input
                id="data_congelamento"
                type="date"
                value={congelarData.data_congelamento}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, data_congelamento: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao_atual">Localização (Botijão) *</Label>
              <Input
                id="localizacao_atual"
                value={congelarData.localizacao_atual}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, localizacao_atual: e.target.value })
                }
                placeholder="Ex: Botijão 1, Canister A"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCongelarEmMassa}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Congelando...' : `Congelar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCongelarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Descarte em Massa */}
      <Dialog open={showDescartarDialog} onOpenChange={setShowDescartarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>
              Descartar os embriões selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_descarte">Data de Descarte *</Label>
              <Input
                id="data_descarte"
                type="date"
                value={descartarData.data_descarte}
                onChange={(e) =>
                  setDescartarData({ ...descartarData, data_descarte: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações / Motivo</Label>
              <Textarea
                id="observacoes"
                value={descartarData.observacoes}
                onChange={(e) =>
                  setDescartarData({ ...descartarData, observacoes: e.target.value })
                }
                placeholder="Informe o motivo do descarte (opcional)"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDescartarEmMassa}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? 'Descartando...' : `Descartar ${embrioesSelecionados.size} Embrião(ões)`}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDescartarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico Dialog */}
      <Sheet open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Histórico do Embrião</SheetTitle>
            <SheetDescription>
              Histórico completo de eventos do embrião{' '}
              {historicoEmbriao?.identificacao || historicoEmbriao?.id.slice(0, 8)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {loadingHistorico ? (
              <LoadingSpinner />
            ) : historico.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum histórico encontrado</p>
            ) : (
              <div className="space-y-4">
                {historico.map((item) => {
                  const tipoOperacaoMap: Record<string, string> = {
                    CLASSIFICACAO: 'Classificação',
                    DESTINACAO: 'Destinação',
                    CONGELAMENTO: 'Congelamento',
                    DESCARTE: 'Descarte',
                    TRANSFERENCIA: 'Transferência',
                  };

                  return (
                    <Card key={item.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{tipoOperacaoMap[item.tipo_operacao] || item.tipo_operacao}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              {item.data_mudanca ? formatDate(item.data_mudanca) : '-'}
                            </p>
                            {item.observacoes && (
                              <p className="text-sm text-slate-500 mt-1">{item.observacoes}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <StatusBadge status={item.status_novo || ''} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
