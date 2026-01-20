import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { atualizarStatusReceptora, validarTransicaoStatus, calcularStatusReceptora } from '@/lib/receptoraStatus';
import { ArrowRightLeft, Package, AlertTriangle, FileText, X, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { formatDate } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import DatePickerBR from '@/components/shared/DatePickerBR';
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
  DialogFooter,
} from '@/components/ui/dialog';

interface Fazenda {
  id: string;
  nome: string;
}

interface ReceptoraSincronizada {
  receptora_id: string;
  brinco: string;
  protocolo_id: string;
  protocolo_receptora_id: string;
  data_te_prevista?: string;
  data_limite_te?: string;
  quantidade_embrioes?: number; // Quantidade de embriões já transferidos nesta receptora
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
}

interface EmbrioCompleto {
  id: string;
  identificacao?: string;
  classificacao?: string;
  status_atual: string;
  localizacao_atual?: string;
  doadora_registro?: string;
  touro_nome?: string;
  created_at?: string;
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
  id: string;
  lote_fiv_id: string;
  data_despacho: string;
  fazendas_destino_ids: string[];
  fazendas_destino_nomes: string[];
  pacote_info: PacoteAspiracaoInfo;
  embrioes: EmbrioCompleto[];
  total: number;
  frescos: number;
  congelados: number;
}

export default function TransferenciaEmbrioes() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [pacotesFiltrados, setPacotesFiltrados] = useState<PacoteEmbrioes[]>([]);
  const [receptoras, setReceptoras] = useState<ReceptoraSincronizada[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [permitirDuplas, setPermitirDuplas] = useState(false);
  const [transferenciasSessao, setTransferenciasSessao] = useState<string[]>([]); // IDs dos protocolos_receptoras da sessão atual
  const [transferenciasIdsSessao, setTransferenciasIdsSessao] = useState<string[]>([]); // IDs das transferências_embrioes da sessão atual
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [relatorioData, setRelatorioData] = useState<any[]>([]);
  const [isVisualizacaoApenas, setIsVisualizacaoApenas] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fazenda_id: '',
    pacote_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  // Estado para manter os campos do pacote após registrar transferência
  const [camposPacote, setCamposPacote] = useState({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Chave para localStorage
  const STORAGE_KEY = 'transferencia_embrioes_sessao';

  // Função para salvar estado no localStorage
  const salvarEstadoSessao = () => {
    const estadoSessao = {
      fazenda_id: formData.fazenda_id,
      pacote_id: formData.pacote_id,
      data_te: formData.data_te,
      veterinario_responsavel: formData.veterinario_responsavel,
      tecnico_responsavel: formData.tecnico_responsavel,
      permitirDuplas,
      transferenciasSessao,
      transferenciasIdsSessao,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoSessao));
  };

  // Função para restaurar estado do localStorage
  const restaurarEstadoSessao = () => {
    try {
      const estadoSalvo = localStorage.getItem(STORAGE_KEY);
      if (estadoSalvo) {
        const estado = JSON.parse(estadoSalvo);
        if (estado.fazenda_id) {
          setFormData(prev => ({
            ...prev,
            fazenda_id: estado.fazenda_id || '',
            pacote_id: estado.pacote_id || '',
            data_te: estado.data_te || new Date().toISOString().split('T')[0],
            veterinario_responsavel: estado.veterinario_responsavel || '',
            tecnico_responsavel: estado.tecnico_responsavel || '',
          }));
          setCamposPacote({
            data_te: estado.data_te || '',
            veterinario_responsavel: estado.veterinario_responsavel || '',
            tecnico_responsavel: estado.tecnico_responsavel || '',
          });
          setPermitirDuplas(estado.permitirDuplas || false);
          setTransferenciasSessao(estado.transferenciasSessao || []);
          setTransferenciasIdsSessao(estado.transferenciasIdsSessao || []);
          return true;
        }
      }
    } catch (error) {
      console.error('Erro ao restaurar estado da sessão:', error);
    }
    return false;
  };

  // Função para buscar transferências não finalizadas e restaurar sessão (silenciosamente)
  const restaurarSessaoEmAndamento = async () => {
    try {
      // Buscar todas as transferências REALIZADAS dos últimos 7 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 7);
      const dataLimiteStr = dataLimite.toISOString().split('T')[0];
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, protocolo_receptora_id, data_te, receptora_id, created_at')
        .eq('status_te', 'REALIZADA')
        .gte('data_te', dataLimiteStr)
        .order('created_at', { ascending: false });

      if (teError || !transferenciasData || transferenciasData.length === 0) {
        return false;
      }

      // Obter protocolo_receptora_ids únicos
      const protocoloReceptoraIds = [...new Set(
        transferenciasData.map(t => t.protocolo_receptora_id).filter(Boolean)
      )];

      // Verificar status dos protocolos_receptoras
      const { data: protocolosReceptorasData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('id, status')
        .in('id', protocoloReceptoraIds);

      if (prError || !protocolosReceptorasData || protocolosReceptorasData.length === 0) {
        return false;
      }

      // Priorizar transferências com protocolos NÃO UTILIZADAS (sessão realmente em andamento)
      const protocoloReceptoraIdsAtivos = new Set(
        protocolosReceptorasData
          .filter(pr => pr.status !== 'UTILIZADA')
          .map(pr => pr.id)
      );
      
      let transferenciasAtivas = transferenciasData.filter(t => 
        t.protocolo_receptora_id && protocoloReceptoraIdsAtivos.has(t.protocolo_receptora_id)
      );

      // Se não encontrou transferências com protocolos ativos, verificar transferências de hoje
      if (transferenciasAtivas.length === 0) {
        const transferenciasHoje = transferenciasData.filter(t => t.data_te === hoje);
        
        if (transferenciasHoje.length > 0) {
          transferenciasAtivas = transferenciasHoje;
        } else {
          // Última tentativa: buscar transferências dos últimos 3 dias
          const tresDiasAtras = new Date();
          tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);
          const tresDiasAtrasStr = tresDiasAtras.toISOString().split('T')[0];
          
          const transferenciasRecentes = transferenciasData.filter(t => 
            t.data_te >= tresDiasAtrasStr
          );
          
          if (transferenciasRecentes.length > 0) {
            transferenciasAtivas = transferenciasRecentes;
          } else {
            return false;
          }
        }
      }

      // Agrupar por fazenda através das receptoras
      const receptoraIds = [...new Set(transferenciasAtivas.map(t => t.receptora_id))];
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual')
        .in('receptora_id', receptoraIds);

      if (viewError || !viewData || viewData.length === 0) {
        return false;
      }

      // Obter fazenda mais comum
      const fazendaIds = viewData.map(v => v.fazenda_id_atual).filter(Boolean);
      const fazendaMaisComum = fazendaIds.sort((a, b) =>
        fazendaIds.filter(id => id === a).length - fazendaIds.filter(id => id === b).length
      ).pop();

      if (!fazendaMaisComum) {
        return false;
      }

      // Restaurar sessão com transferências ativas
      const transferenciasIds = transferenciasAtivas.map(t => t.id);
      const protocoloReceptoraIdsRestaurar = [...new Set(transferenciasAtivas.map(t => t.protocolo_receptora_id).filter(Boolean))];
      
      setTransferenciasIdsSessao(transferenciasIds);
      setTransferenciasSessao(protocoloReceptoraIdsRestaurar);
      
      // Buscar primeira transferência (mais recente) para restaurar campos do pacote
      const primeiraTransferencia = transferenciasAtivas[0];
      if (primeiraTransferencia) {
        const { data: transferenciaCompleta } = await supabase
          .from('transferencias_embrioes')
          .select('veterinario_responsavel, tecnico_responsavel, data_te')
          .eq('id', primeiraTransferencia.id)
          .single();

        if (transferenciaCompleta) {
          const novoEstado = {
            fazenda_id: fazendaMaisComum,
            pacote_id: '',
            data_te: transferenciaCompleta.data_te || primeiraTransferencia.data_te,
            veterinario_responsavel: transferenciaCompleta.veterinario_responsavel || '',
            tecnico_responsavel: transferenciaCompleta.tecnico_responsavel || '',
          };
          
          setFormData(prev => ({
            ...prev,
            ...novoEstado,
          }));
          setCamposPacote({
            data_te: transferenciaCompleta.data_te || primeiraTransferencia.data_te,
            veterinario_responsavel: transferenciaCompleta.veterinario_responsavel || '',
            tecnico_responsavel: transferenciaCompleta.tecnico_responsavel || '',
          });
          
          // Salvar estado restaurado no localStorage
          const estadoSessao = {
            ...novoEstado,
            permitirDuplas: false,
            transferenciasSessao: protocoloReceptoraIdsRestaurar,
            transferenciasIdsSessao: transferenciasIds,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoSessao));

          toast({
            title: 'Sessão em andamento restaurada',
            description: `${transferenciasAtivas.length} transferência(s) encontrada(s). Continue de onde parou.`,
          });
          
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao restaurar sessão em andamento:', error);
      return false;
    }
  };

  useEffect(() => {
    const carregarDados = async () => {
      await loadFazendas();
      await loadPacotes();
      
      // Tentar restaurar estado salvo do localStorage primeiro
      const estadoRestaurado = restaurarEstadoSessao();
      
      if (estadoRestaurado) {
        // Se restaurou estado salvo, aguardar um pouco para garantir que os pacotes foram carregados
        // e então carregar receptoras da fazenda
        setTimeout(async () => {
          const estadoSalvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          if (estadoSalvo.fazenda_id) {
            await recarregarReceptoras(estadoSalvo.fazenda_id);
          }
        }, 100);
      } else {
        // Se não há estado salvo, tentar restaurar sessão em andamento do banco
        await restaurarSessaoEmAndamento();
        // Após restaurar sessão, também restaurar estado (que foi salvo em restaurarSessaoEmAndamento)
        const estadoRestauradoBanco = restaurarEstadoSessao();
        if (estadoRestauradoBanco) {
          setTimeout(async () => {
            const estadoSalvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (estadoSalvo.fazenda_id) {
              await recarregarReceptoras(estadoSalvo.fazenda_id);
            }
          }, 100);
        }
      }
    };
    
    carregarDados();
  }, []);

  // Salvar estado quando mudar
  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, permitirDuplas, transferenciasSessao.length, transferenciasIdsSessao.length]);

  useEffect(() => {
    // Filtrar pacotes quando a fazenda mudar
    if (formData.fazenda_id) {
      const filtrados = pacotes.filter(pacote =>
        pacote.fazendas_destino_ids.includes(formData.fazenda_id)
      );
      setPacotesFiltrados(filtrados);
    } else {
      setPacotesFiltrados([]);
    }
  }, [formData.fazenda_id, pacotes]);

  // Recarregar receptoras quando o switch mudar (sem limpar campos)
  useEffect(() => {
    if (formData.fazenda_id) {
      carregarReceptorasDaFazenda(formData.fazenda_id, permitirDuplas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitirDuplas]);

  const loadFazendas = async () => {
    try {
      // Buscar receptoras sincronizadas usando a view de status
      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('receptora_id')
        .eq('fase_ciclo', 'SINCRONIZADA');

      if (statusError) throw statusError;

      if (!statusData || statusData.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      // Obter IDs únicos das receptoras sincronizadas
      const receptoraIds = [...new Set(statusData.map(s => s.receptora_id))];

      // Buscar fazendas atuais dessas receptoras usando a view
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('fazenda_id_atual')
        .in('receptora_id', receptoraIds);

      if (viewError) throw viewError;

      if (!viewData || viewData.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      // Obter IDs únicos das fazendas
      const fazendaIds = [...new Set(viewData.map(v => v.fazenda_id_atual).filter(Boolean))];

      if (fazendaIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
      }

      // Buscar dados das fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds)
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;

      setFazendas(fazendasData || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const loadPacotes = async () => {
    try {
      // Buscar embriões disponíveis para transferência:
      // - Embriões FRESCOS sempre disponíveis (exceto TRANSFERIDO ou já transferidos)
      // - Embriões CONGELADOS sem cliente_id ainda disponíveis (exceto TRANSFERIDO ou já transferidos)
      // - Embriões CONGELADOS com cliente_id NÃO aparecem (já direcionados para estoque do cliente)
      // - Embriões TRANSFERIDO ou já com transferência nunca aparecem na lista
      // 
      // Buscar IDs de embriões já transferidos e embriões disponíveis em paralelo
      const [transferenciasResult, frescosResult, congeladosResult] = await Promise.all([
        supabase
          .from('transferencias_embrioes')
          .select('embriao_id'),
        supabase
          .from('embrioes')
          .select('*')
          .eq('status_atual', 'FRESCO')
          .order('created_at', { ascending: false }),
        supabase
          .from('embrioes')
          .select('*')
          .eq('status_atual', 'CONGELADO')
          .is('cliente_id', null)
          .order('created_at', { ascending: false })
      ]);

      const embrioesTransferidosIds = transferenciasResult.data?.map(t => t.embriao_id) || [];

      if (frescosResult.error) throw frescosResult.error;
      if (congeladosResult.error) throw congeladosResult.error;

      // Combinar os resultados e excluir embriões já transferidos ou com status TRANSFERIDO
      const embrioesData = [
        ...(frescosResult.data || []),
        ...(congeladosResult.data || [])
      ]
      .filter(e => !embrioesTransferidosIds.includes(e.id) && e.status_atual !== 'TRANSFERIDO')
      .sort((a, b) => {
        // Ordenar por data de criação (mais recentes primeiro)
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      if (!embrioesData || embrioesData.length === 0) {
        setPacotes([]);
        return;
      }

      const loteFivIds = [
        ...new Set(embrioesData.filter((e) => e.lote_fiv_id).map((e) => e.lote_fiv_id)),
      ] as string[];

      let pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      let pacoteParaLoteMap = new Map<string, string>();
      let fazendasDestinoPorPacoteMap = new Map<string, string[]>();
      let fazendasMap = new Map<string, string>(); // Mapa global de fazendas

      // Buscar todas as fazendas de uma vez
      const { data: todasFazendasData } = await supabase
        .from('fazendas')
        .select('id, nome');

      if (todasFazendasData) {
        fazendasMap = new Map(todasFazendasData.map((f) => [f.id, f.nome]));
      }

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
            const { data: pacotesData, error: pacotesError } = await supabase
              .from('pacotes_aspiracao')
              .select('*')
              .in('id', pacoteIds);

            if (!pacotesError && pacotesData) {
              // Buscar fazendas destino dos pacotes
              const { data: fazendasDestinoData } = await supabase
                .from('pacotes_aspiracao_fazendas_destino')
                .select('pacote_aspiracao_id, fazenda_destino_id')
                .in('pacote_aspiracao_id', pacoteIds);

              if (fazendasDestinoData) {
                fazendasDestinoData.forEach(item => {
                  const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
                  if (!atual.includes(item.fazenda_destino_id)) {
                    atual.push(item.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
                });
              }

              pacotesData.forEach(pacote => {
                if (pacote.fazenda_destino_id) {
                  const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
                  if (!atual.includes(pacote.fazenda_destino_id)) {
                    atual.push(pacote.fazenda_destino_id);
                  }
                  fazendasDestinoPorPacoteMap.set(pacote.id, atual);
                }

                pacotesAspiracaoMap.set(pacote.id, {
                  id: pacote.id,
                  data_aspiracao: pacote.data_aspiracao,
                  fazenda_nome: fazendasMap.get(pacote.fazenda_id),
                  quantidade_doadoras: 0,
                  horario_inicio: pacote.horario_inicio,
                  veterinario_responsavel: pacote.veterinario_responsavel,
                  total_oocitos: pacote.total_oocitos,
                });
              });
            }
          }
        }
      }

      // Buscar doadoras e touros para enriquecer os embriões
      const acasalamentoIds = embrioesData
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);
      
      let acasalamentosMap = new Map();
      let doadorasMap = new Map<string, string>();
      let dosesMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          acasalamentosMap = new Map(acasalamentosData.map((a) => [a.id, a]));

          const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id).filter(Boolean))];

          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  doadorasMap = new Map(doadorasData.map((d) => [d.id, d.registro]));
                  
                  // Criar mapa aspiracao -> doadora
                  const aspiracaoDoadoraMap = new Map(
                    aspiracoesData.map(a => [a.id, a.doadora_id])
                  );
                  
                  // Criar mapa acasalamento -> doadora através da aspiração
                  acasalamentosData.forEach(ac => {
                    if (ac.aspiracao_doadora_id) {
                      const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
                      if (doadoraId) {
                        const registro = doadorasMap.get(doadoraId);
                        if (registro) {
                          acasalamentosMap.set(ac.id, {
                            ...ac,
                            doadora_registro: registro,
                          });
                        }
                      }
                    }
                  });
                }
              }
            }
          }

          if (doseIds.length > 0) {
            // Buscar doses com informações do touro relacionado
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              // Criar mapa de dose_id -> nome do touro
              dosesMap = new Map(
                dosesData.map((d) => {
                  const touro = d.touro as any;
                  return [d.id, touro?.nome || 'Touro desconhecido'];
                })
              );
              
              // Adicionar nome do touro aos acasalamentos
              acasalamentosData.forEach(ac => {
                if (ac.dose_semen_id) {
                  const touroNome = dosesMap.get(ac.dose_semen_id);
                  if (touroNome) {
                    const acasalamentoAtual = acasalamentosMap.get(ac.id);
                    acasalamentosMap.set(ac.id, {
                      ...acasalamentoAtual,
                      touro_nome: touroNome,
                    });
                  }
                }
              });
            }
          }
        }
      }

      // Agrupar embriões por lote_fiv_id + data de criação (mesma lógica de Embriões.tsx)
      const pacotesMap = new Map<string, PacoteEmbrioes>();

      embrioesData.forEach((embriao) => {
        if (!embriao.lote_fiv_id || !embriao.created_at) {
          return;
        }

        const dataDespacho = embriao.created_at.split('T')[0];
        const chavePacote = `${embriao.lote_fiv_id}-${dataDespacho}`;

        let pacote = pacotesMap.get(chavePacote);
        if (!pacote) {
          const pacoteAspiracaoIdOriginal = pacoteParaLoteMap.get(embriao.lote_fiv_id);
          const pacoteInfo = pacoteAspiracaoIdOriginal
            ? pacotesAspiracaoMap.get(pacoteAspiracaoIdOriginal)
            : undefined;

          const fazendasDestinoIds = pacoteAspiracaoIdOriginal
            ? (fazendasDestinoPorPacoteMap.get(pacoteAspiracaoIdOriginal) || [])
            : [];

          const fazendasDestinoNomes = fazendasDestinoIds
            .map(id => fazendasMap.get(id))
            .filter((nome): nome is string => !!nome);

          pacote = {
            id: chavePacote,
            lote_fiv_id: embriao.lote_fiv_id,
            data_despacho: dataDespacho,
            fazendas_destino_ids: fazendasDestinoIds,
            fazendas_destino_nomes: fazendasDestinoNomes,
            pacote_info: pacoteInfo || {
              id: pacoteAspiracaoIdOriginal || '',
              data_aspiracao: dataDespacho,
              quantidade_doadoras: 0,
            },
            embrioes: [],
            total: 0,
            frescos: 0,
            congelados: 0,
          };
          pacotesMap.set(chavePacote, pacote);
        }

        // Enriquecer embrião com informações de doadora e touro
        const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id || '');
        const doadoraRegistro = acasalamento?.doadora_registro;
        const touroNome = acasalamento?.touro_nome;

        pacote.embrioes.push({
          ...embriao,
          doadora_registro: doadoraRegistro,
          touro_nome: touroNome,
        });
        pacote.total++;

        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
      });

      // Buscar informações de disponibilidade dos lotes FIV
      const loteFivIdsParaPacotes = [...new Set(Array.from(pacotesMap.values()).map(p => p.lote_fiv_id))];
      const { data: lotesFivDisponibilidade } = await supabase
        .from('lotes_fiv')
        .select('id, disponivel_para_transferencia')
        .in('id', loteFivIdsParaPacotes);

      const lotesDisponiveisMap = new Map(
        lotesFivDisponibilidade?.map(l => [l.id, l.disponivel_para_transferencia === true]) || []
      );

      // Filtrar pacotes: só mostrar aqueles onde o lote está marcado como disponível para transferência
      const pacotesArray = Array.from(pacotesMap.values())
        .filter(pacote => {
          const disponivel = lotesDisponiveisMap.get(pacote.lote_fiv_id);
          return disponivel === true && pacote.total > 0; // Só pacotes disponíveis e com embriões
        })
        .sort((a, b) => b.data_despacho.localeCompare(a.data_despacho));

      setPacotes(pacotesArray);
    } catch (error) {
      console.error('Erro ao carregar pacotes:', error);
      toast({
        title: 'Erro ao carregar pacotes de embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setPacotes([]);
    }
  };

  // Função unificada para carregar receptoras (usada tanto em handleFazendaChange quanto em recarregarReceptoras)
  const carregarReceptorasDaFazenda = async (fazendaId: string, valorPermitirDuplas: boolean = permitirDuplas) => {
    try {
      // Verificar se a fazenda tem receptoras antes de continuar
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) {
        console.error('Erro ao buscar receptoras da fazenda (view):', viewError);
        throw viewError;
      }

      const receptoraIdsNaFazenda = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIdsNaFazenda.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      // Buscar receptoras diretamente de protocolo_receptoras que estão na fazenda
      // e que NÃO estão UTILIZADAS (para incluir todas as receptoras sincronizadas ativas)
      // Primeiro, buscar protocolos_receptoras para essas receptoras
      const { data: prDataInicial, error: prErrorInicial } = await supabase
        .from('protocolo_receptoras')
        .select('id, receptora_id, protocolo_id, status, ciclando_classificacao, qualidade_semaforo')
        .in('receptora_id', receptoraIdsNaFazenda)
        .neq('status', 'UTILIZADA'); // Excluir apenas as que foram finalizadas

      if (prErrorInicial) {
        console.error('Erro ao buscar protocolo_receptoras:', prErrorInicial);
        throw prErrorInicial;
      }

      if (!prDataInicial || prDataInicial.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      // Filtrar apenas as que estão INAPTAS (descartadas)
      const prDataAtivas = prDataInicial.filter(pr => pr.status !== 'INAPTA');
      
      if (prDataAtivas.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      // Buscar informações da view para obter dados de sincronização
      const protocoloIds = [...new Set(prDataAtivas.map(pr => pr.protocolo_id).filter(Boolean))];
      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('*')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('receptora_id', receptoraIdsNaFazenda)
        .in('protocolo_id', protocoloIds);

      if (statusError) {
        console.error('Erro ao buscar receptoras sincronizadas (view):', statusError);
        // Continuar mesmo se a view falhar - usar dados diretos de protocolo_receptoras
      }

      // Mapear receptoras: usar dados da view se disponível, senão usar dados diretos
      const receptoraIdsAtivas = new Set(prDataAtivas.map(pr => pr.receptora_id));
      const statusDataMap = new Map(
        (statusData || []).map(s => [s.receptora_id, s])
      );

      // Criar lista de receptoras sincronizadas combinando dados
      const statusDataFiltrado = prDataAtivas
        .filter(pr => {
          // Incluir apenas se está na view como SINCRONIZADA ou se não temos dados da view
          const dadosView = statusDataMap.get(pr.receptora_id);
          return !dadosView || dadosView.fase_ciclo === 'SINCRONIZADA';
        })
        .map(pr => {
          const dadosView = statusDataMap.get(pr.receptora_id);
          return {
            receptora_id: pr.receptora_id,
            protocolo_id: pr.protocolo_id,
            protocolo_receptora_id: pr.id,
            pr_id: pr.id,
            brinco: dadosView?.brinco || '',
            identificacao: dadosView?.identificacao || '',
            data_te_prevista: dadosView?.data_te_prevista,
            data_limite_te: dadosView?.data_limite_te,
          };
        });

      // Contar TODAS as transferências realizadas para cada receptora
      const contagemEmbrioesPorReceptora = new Map<string, number>();
      const receptoraIdsParaContagem = Array.from(new Set(statusDataFiltrado.map(r => r.receptora_id).filter(Boolean)));
      
      if (receptoraIdsParaContagem.length > 0) {
        const { data: todasTransferenciasData } = await supabase
          .from('transferencias_embrioes')
          .select('receptora_id')
          .in('receptora_id', receptoraIdsParaContagem)
          .eq('status_te', 'REALIZADA')
          .order('created_at', { ascending: false });

        todasTransferenciasData?.forEach(t => {
          const atual = contagemEmbrioesPorReceptora.get(t.receptora_id) || 0;
          contagemEmbrioesPorReceptora.set(t.receptora_id, atual + 1);
        });
      }

      // Criar mapa de qualidade e ciclando a partir dos dados já obtidos
      const qualidadeCiclandoMap = new Map<string, { ciclando_classificacao?: 'N' | 'CL' | null; qualidade_semaforo?: 1 | 2 | 3 | null }>();
      prDataAtivas.forEach(pr => {
        qualidadeCiclandoMap.set(pr.id, {
          ciclando_classificacao: pr.ciclando_classificacao as 'N' | 'CL' | null | undefined,
          qualidade_semaforo: pr.qualidade_semaforo as 1 | 2 | 3 | null | undefined,
        });
      });

      // Filtrar receptoras baseado no switch e na contagem
      let receptorasFiltradas = statusDataFiltrado;
      
      if (!valorPermitirDuplas) {
        // Modo normal: excluir receptoras que já receberam embrião (quantidade >= 1)
        receptorasFiltradas = statusDataFiltrado.filter((r) => {
          const quantidade = contagemEmbrioesPorReceptora.get(r.receptora_id) || 0;
          return quantidade === 0;
        });
      } else {
        // Modo duplas: excluir apenas receptoras que já receberam 2 embriões (máximo permitido)
        // Mostrar receptoras com 0 ou 1 embrião (quantidade < 2)
        receptorasFiltradas = statusDataFiltrado.filter((r) => {
          const quantidade = contagemEmbrioesPorReceptora.get(r.receptora_id) || 0;
          return quantidade < 2;
        });
      }
      
      const receptorasComId = receptorasFiltradas.map((r) => {
        const quantidadeEmbrioes = contagemEmbrioesPorReceptora.get(r.receptora_id) || 0;
        const protocoloReceptoraId = r.protocolo_receptora_id || r.pr_id || '';
        const qualidadeCiclando = qualidadeCiclandoMap.get(protocoloReceptoraId) || {};
        
        return {
          receptora_id: r.receptora_id,
          brinco: r.brinco || r.identificacao || 'N/A',
          protocolo_id: r.protocolo_id,
          protocolo_receptora_id: protocoloReceptoraId,
          data_te_prevista: r.data_te_prevista,
          data_limite_te: r.data_limite_te,
          quantidade_embrioes: quantidadeEmbrioes,
          ciclando_classificacao: qualidadeCiclando.ciclando_classificacao,
          qualidade_semaforo: qualidadeCiclando.qualidade_semaforo,
        };
      });

      setReceptoras(receptorasComId);
      return { receptorasDisponiveis: receptorasComId.length };
    } catch (error) {
      console.error('Erro ao carregar receptoras:', error);
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
      return { receptorasDisponiveis: 0 };
    }
  };

  // Função para recarregar receptoras sem limpar o pacote (usada após registrar transferência)
  const recarregarReceptoras = async (fazendaId: string, valorPermitirDuplas?: boolean) => {
    await carregarReceptorasDaFazenda(fazendaId, valorPermitirDuplas ?? permitirDuplas);
  };

  const handleFazendaChange = async (fazendaId: string) => {
    // Se não há fazenda selecionada, limpar tudo (permitir sempre limpar)
    if (!fazendaId) {
      setFormData({
        ...formData,
        fazenda_id: '',
        pacote_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
      });
      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setReceptoras([]);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Antes de carregar receptoras, tentar restaurar sessão em andamento para esta fazenda
    const sessaoRestaurada = await restaurarSessaoPorFazenda(fazendaId);
    
    if (!sessaoRestaurada) {
      // Se não há sessão para restaurar, limpar estado anterior e carregar receptoras normalmente
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });
    }

    // Carregar receptoras da fazenda (pode estar vazia se todas já receberam, mas ainda assim permitir selecionar)
    await carregarReceptorasDaFazenda(fazendaId, permitirDuplas);

    // Atualizar formData com a fazenda selecionada
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      // Se não restaurou sessão, limpar pacote
      pacote_id: sessaoRestaurada ? formData.pacote_id : '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });
  };

  // Função para restaurar sessão por fazenda específica
  const restaurarSessaoPorFazenda = async (fazendaId: string): Promise<boolean> => {
    try {
      // Buscar transferências REALIZADAS dos últimos 7 dias para esta fazenda
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 7);
      const dataLimiteStr = dataLimite.toISOString().split('T')[0];
      
      // Primeiro, buscar receptoras desta fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError || !viewData || viewData.length === 0) {
        return false;
      }

      const receptoraIds = viewData.map(v => v.receptora_id);

      // Buscar transferências para essas receptoras
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, protocolo_receptora_id, data_te, receptora_id, created_at')
        .eq('status_te', 'REALIZADA')
        .gte('data_te', dataLimiteStr)
        .in('receptora_id', receptoraIds)
        .order('created_at', { ascending: false });

      if (teError || !transferenciasData || transferenciasData.length === 0) {
        return false;
      }

      // Verificar quais protocolos ainda não estão UTILIZADOS
      const protocoloReceptoraIds = [...new Set(transferenciasData.map(t => t.protocolo_receptora_id).filter(Boolean))];
      const { data: protocolosReceptorasData } = await supabase
        .from('protocolo_receptoras')
        .select('id, status')
        .in('id', protocoloReceptoraIds);

      if (!protocolosReceptorasData || protocolosReceptorasData.length === 0) {
        return false;
      }

      // Filtrar transferências cujos protocolos ainda não foram marcados como UTILIZADA
      const protocoloReceptoraIdsAtivos = new Set(
        protocolosReceptorasData
          .filter(pr => pr.status !== 'UTILIZADA')
          .map(pr => pr.id)
      );

      const transferenciasAtivas = transferenciasData.filter(t => 
        t.protocolo_receptora_id && protocoloReceptoraIdsAtivos.has(t.protocolo_receptora_id)
      );

      if (transferenciasAtivas.length === 0) {
        return false;
      }

      // Restaurar sessão
      const transferenciasIds = transferenciasAtivas.map(t => t.id);
      const protocoloReceptoraIdsRestaurar = [...new Set(transferenciasAtivas.map(t => t.protocolo_receptora_id).filter(Boolean))];
      
      setTransferenciasIdsSessao(transferenciasIds);
      setTransferenciasSessao(protocoloReceptoraIdsRestaurar);

      // Buscar primeira transferência para restaurar campos
      const primeiraTransferencia = transferenciasAtivas[0];
      if (primeiraTransferencia) {
        const { data: transferenciaCompleta } = await supabase
          .from('transferencias_embrioes')
          .select('veterinario_responsavel, tecnico_responsavel, data_te, embriao:embrioes(lote_fiv_id)')
          .eq('id', primeiraTransferencia.id)
          .single();

        if (transferenciaCompleta) {
          const embriaoData = transferenciaCompleta.embriao as any;
          const loteFivId = embriaoData?.lote_fiv_id;
          
          // Buscar pacote pelo lote_fiv_id
          let pacoteId = '';
          if (loteFivId) {
            const { data: pacoteData } = await supabase
              .from('pacotes_embrioes')
              .select('id')
              .eq('lote_fiv_id', loteFivId)
              .limit(1)
              .single();
            
            if (pacoteData) {
              pacoteId = pacoteData.id;
            }
          }
          
          setFormData(prev => ({
            ...prev,
            fazenda_id: fazendaId,
            pacote_id: pacoteId,
            data_te: transferenciaCompleta.data_te || primeiraTransferencia.data_te,
            veterinario_responsavel: transferenciaCompleta.veterinario_responsavel || '',
            tecnico_responsavel: transferenciaCompleta.tecnico_responsavel || '',
          }));

          setCamposPacote({
            data_te: transferenciaCompleta.data_te || primeiraTransferencia.data_te,
            veterinario_responsavel: transferenciaCompleta.veterinario_responsavel || '',
            tecnico_responsavel: transferenciaCompleta.tecnico_responsavel || '',
          });

          // Salvar estado no localStorage
          const estadoSessao = {
            fazenda_id: fazendaId,
            pacote_id: pacoteId,
            data_te: transferenciaCompleta.data_te || primeiraTransferencia.data_te,
            veterinario_responsavel: transferenciaCompleta.veterinario_responsavel || '',
            tecnico_responsavel: transferenciaCompleta.tecnico_responsavel || '',
            permitirDuplas,
            transferenciasSessao: protocoloReceptoraIdsRestaurar,
            transferenciasIdsSessao: transferenciasIds,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(estadoSessao));

          toast({
            title: 'Sessão em andamento restaurada',
            description: `${transferenciasAtivas.length} transferência(s) encontrada(s) para esta fazenda.`,
          });

          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Erro ao restaurar sessão por fazenda:', error);
      return false;
    }
  };


  const handlePacoteChange = (pacoteId: string) => {
    // Quando muda o pacote, limpar embrião e receptora, mas manter fazenda
    // Se já havia campos salvos para este pacote, restaurá-los
    setFormData({
      ...formData,
      pacote_id: pacoteId,
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
      data_te: camposPacote.data_te || formData.data_te,
      veterinario_responsavel: camposPacote.veterinario_responsavel || formData.veterinario_responsavel,
      tecnico_responsavel: camposPacote.tecnico_responsavel || formData.tecnico_responsavel,
    });
  };

  const handleDescartarReceptora = async () => {
    if (!formData.protocolo_receptora_id || !formData.receptora_id) {
      toast({
        title: 'Erro',
        description: 'Nenhuma receptora selecionada para descartar',
        variant: 'destructive',
      });
      return;
    }

    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
    const brincoReceptora = receptoraSelecionada?.brinco || 'Receptora';

    if (!confirm(`Tem certeza que deseja descartar a receptora ${brincoReceptora}? Ela não receberá embrião e não poderá ser selecionada novamente neste protocolo.`)) {
      return;
    }

    try {
      setSubmitting(true);

      // Atualizar status para INAPTA (descartada)
      const { error: prError } = await supabase
        .from('protocolo_receptoras')
        .update({ 
          status: 'INAPTA',
          motivo_inapta: 'Descartada no menu de TE - não recebeu embrião'
        })
        .eq('id', formData.protocolo_receptora_id);

      if (prError) throw prError;

      // Atualizar status da receptora para VAZIA quando descartada na TE
      // Atualizar diretamente sem validações para garantir que sempre atualiza
      if (formData.receptora_id) {
        const { error: statusError } = await supabase
          .from('receptoras')
          .update({ status_reprodutivo: 'VAZIA' })
          .eq('id', formData.receptora_id);
        
        if (statusError) {
          console.error('Erro ao atualizar status da receptora descartada:', statusError);
          // Não falhar se houver erro, mas logar para debug
          // O importante é que o status em protocolo_receptoras foi atualizado
        } else {
        }
      }

      toast({
        title: 'Receptora descartada',
        description: `${brincoReceptora} foi descartada e não receberá embrião neste protocolo.`,
      });

      // Limpar seleção de receptora
      setFormData({
        ...formData,
        receptora_id: '',
        protocolo_receptora_id: '',
      });

      // Recarregar lista de receptoras (a descartada não aparecerá mais)
      if (formData.fazenda_id) {
        await recarregarReceptoras(formData.fazenda_id, permitirDuplas);
      }
    } catch (error) {
      console.error('Erro ao descartar receptora:', error);
      toast({
        title: 'Erro ao descartar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações específicas com mensagens claras
    if (!formData.embriao_id) {
      toast({
        title: 'Embrião não selecionado',
        description: 'Por favor, selecione um embrião para realizar a transferência.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.fazenda_id || !formData.pacote_id || !formData.receptora_id || !formData.data_te) {
      toast({
        title: 'Erro de validação',
        description: 'Todos os campos obrigatórios devem ser preenchidos',
        variant: 'destructive',
      });
      return;
    }

    // Validar quantidade máxima de embriões por receptora
    // A validação é feita pela lista de receptoras que já está filtrada baseado no switch
    // Se a receptora aparece na lista, ela pode receber embrião
    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
    
    if (!receptoraSelecionada) {
      toast({
        title: 'Receptora não disponível',
        description: 'A receptora selecionada não está disponível para transferência.',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeAtual = receptoraSelecionada.quantidade_embrioes || 0;
    
    // Se switch ligado, permitir até 2 embriões (a lista já filtra isso, mas validamos por segurança)
    if (permitirDuplas && quantidadeAtual >= 2) {
      toast({
        title: 'Limite atingido',
        description: 'Esta receptora já recebeu o máximo de 2 embriões permitidos.',
        variant: 'destructive',
      });
      return;
    }

    // Validar que a receptora está SINCRONIZADA antes de realizar a TE
    if (formData.receptora_id) {
      const statusAtual = await calcularStatusReceptora(formData.receptora_id);
      const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_TE');
      
      if (!validacao.valido) {
        toast({
          title: 'Erro de validação',
          description: validacao.mensagem || 'A receptora não pode receber embrião no estado atual',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      // Validar campos obrigatórios antes de inserir
      if (!formData.embriao_id) {
        toast({
          title: 'Erro de validação',
          description: 'Embrião não selecionado',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.receptora_id) {
        toast({
          title: 'Erro de validação',
          description: 'Receptora não selecionada',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.data_te) {
        toast({
          title: 'Erro de validação',
          description: 'Data da TE não informada',
          variant: 'destructive',
        });
        return;
      }

      // Validar que o veterinário responsável foi informado (campo obrigatório no banco)
      if (!formData.veterinario_responsavel || formData.veterinario_responsavel.trim() === '') {
        toast({
          title: 'Erro de validação',
          description: 'Veterinário responsável é obrigatório. Por favor, informe o nome do veterinário.',
          variant: 'destructive',
        });
        return;
      }

      const insertData: Record<string, string | null> = {
        embriao_id: formData.embriao_id,
        receptora_id: formData.receptora_id,
        protocolo_receptora_id: formData.protocolo_receptora_id || null,
        data_te: formData.data_te,
        tipo_te: 'FRESCO', // Tipo fixo como FRESCO (campo removido do formulário)
        veterinario_responsavel: formData.veterinario_responsavel.trim(), // Campo obrigatório, sempre preenchido após validação
        tecnico_responsavel: formData.tecnico_responsavel?.trim() || null,
        status_te: 'REALIZADA',
        observacoes: formData.observacoes?.trim() || null,
      };

      const { data: teData, error: teError } = await supabase.from('transferencias_embrioes').insert([insertData]).select('id');

      if (teError) {
        console.error('Erro ao inserir transferência:', teError);
        console.error('Dados tentados:', insertData);
        
        // Se houver erro de constraint única, recarregar a lista silenciosamente
        // (o embrião não deveria aparecer na lista se já foi transferido)
        if (teError.code === '23505' && teError.message?.includes('unq_embriao_te_realizada')) {
          loadPacotes();
          return;
        }
        
        throw teError;
      }

      // Adicionar o ID da transferência à sessão
      if (teData && teData[0]?.id) {
        setTransferenciasIdsSessao(prev => [...prev, teData[0].id]);
      }

      const { error: embriaoError } = await supabase
        .from('embrioes')
        .update({ status_atual: 'TRANSFERIDO' })
        .eq('id', formData.embriao_id);

      if (embriaoError) throw embriaoError;

      // NÃO atualizar status da receptora para SERVIDA imediatamente após a transferência
      // Isso permite que a receptora continue aparecendo na lista para receber um segundo embrião
      // (quando o switch "Permitir duplas" estiver ligado) durante a mesma sessão
      // O status será atualizado apenas ao encerrar a sessão de transferências
      
      // Validar apenas que a receptora está apta para receber o embrião (sem atualizar status)
      const statusAtual = await calcularStatusReceptora(formData.receptora_id);
      const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_TE');
      
      if (!validacao.valido) {
        console.warn(`Validação de status: ${validacao.mensagem}`);
        // Não falhar a operação, apenas logar o aviso
        // Em alguns casos, a receptora pode já ter status diferente mas ainda estar apta na sessão
      }

      // NÃO marcar como UTILIZADA ou SERVIDA imediatamente - será feito ao encerrar a sessão
      // Apenas adicionar à lista de transferências da sessão
      if (formData.protocolo_receptora_id) {
        setTransferenciasSessao(prev => {
          if (!prev.includes(formData.protocolo_receptora_id)) {
            return [...prev, formData.protocolo_receptora_id];
          }
          return prev;
        });
      }

      toast({
        title: 'Transferência realizada',
        description: 'Transferência de embrião registrada com sucesso',
      });

      // Salvar campos do pacote para manter preenchidos
      setCamposPacote({
        data_te: formData.data_te,
        veterinario_responsavel: formData.veterinario_responsavel,
        tecnico_responsavel: formData.tecnico_responsavel,
      });

      // Manter fazenda, pacote e TODOS os campos preenchidos, apenas limpar receptora e embrião
      setFormData({
        fazenda_id: formData.fazenda_id, // Manter fazenda selecionada
        pacote_id: formData.pacote_id, // Manter pacote selecionado (NÃO limpar)
        embriao_id: '', // Limpar apenas embrião
        receptora_id: '', // Limpar apenas receptora
        protocolo_receptora_id: '', // Limpar apenas protocolo
        data_te: formData.data_te, // Manter data da TE
        veterinario_responsavel: formData.veterinario_responsavel, // Manter vet responsável
        tecnico_responsavel: formData.tecnico_responsavel, // Manter técnico responsável
        observacoes: '', // Limpar apenas observações
      });

      loadPacotes();
      
      // Recarregar receptoras para atualizar a lista (sem limpar o pacote)
      // Usar o valor atual de permitirDuplas para garantir que a lista seja recarregada corretamente
      // Aguardar um pequeno delay para garantir que a transferência foi salva no banco
      if (formData.fazenda_id) {
        setTimeout(async () => {
          await recarregarReceptoras(formData.fazenda_id, permitirDuplas);
        }, 200);
      }
    } catch (error) {
      console.error('Erro completo:', error);
      toast({
        title: 'Erro ao realizar transferência',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visualizarRelatorioSessao = async () => {
    if (transferenciasIdsSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para visualizar.',
        variant: 'destructive',
      });
      return;
    }

    setIsVisualizacaoApenas(true);
    await gerarRelatorioSessao(true);
  };

  const gerarRelatorioSessao = async (apenasVisualizacao: boolean = false) => {
    const temTransferencias = transferenciasIdsSessao.length > 0;
    
    if (!temTransferencias) {
      if (!apenasVisualizacao) {
        toast({
          title: 'Nenhuma transferência na sessão',
          description: 'Não há transferências para gerar relatório.',
          variant: 'destructive',
        });
      }
      return;
    }
    
    if (!apenasVisualizacao && transferenciasSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para gerar relatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Buscar todas as transferências da sessão atual (baseado nos IDs das transferências)
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select(`
          *,
          embrioes (
            id,
            classificacao,
            status_atual,
            lote_fiv_id,
            lote_fiv_acasalamento_id
          ),
          receptoras (
            id,
            identificacao,
            nome
          )
        `)
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA')
        .order('created_at', { ascending: true });

      if (teError) throw teError;

      if (!transferenciasData || transferenciasData.length === 0) {
        toast({
          title: 'Erro ao gerar relatório',
          description: 'Não foi possível encontrar as transferências da sessão.',
          variant: 'destructive',
        });
        return;
      }

      // Enriquecer com informações de doadora e touro
      const acasalamentoIds = transferenciasData
        .map(t => t.embrioes?.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);

      let doadorasMap = new Map<string, string>();
      let tourosMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id).filter(Boolean))];

          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  const aspiracaoDoadoraMap = new Map(aspiracoesData.map(a => [a.id, a.doadora_id]));
                  aspiracoesData.forEach(a => {
                    const doadoraId = aspiracaoDoadoraMap.get(a.id);
                    if (doadoraId) {
                      const doadora = doadorasData.find(d => d.id === doadoraId);
                      if (doadora) {
                        doadorasMap.set(a.id, doadora.registro);
                      }
                    }
                  });
                }
              }
            }
          }

          if (doseIds.length > 0) {
            // Buscar doses com informações do touro relacionado
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              dosesData.forEach(d => {
                const touro = d.touro as any;
                tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
              });
            }
          }

          // Mapear acasalamentos para doadora e touro
          acasalamentosData.forEach(ac => {
            const aspiracaoId = ac.aspiracao_doadora_id;
            const doseId = ac.dose_semen_id;
            if (aspiracaoId && doseId) {
              const doadoraRegistro = doadorasMap.get(aspiracaoId);
              const touroNome = tourosMap.get(doseId);
              if (doadoraRegistro) doadorasMap.set(ac.id, doadoraRegistro);
              if (touroNome) tourosMap.set(ac.id, touroNome);
            }
          });
        }
      }

      // Montar dados do relatório
      const relatorio = transferenciasData.map((t: any) => {
        const acasalamentoId = t.embrioes?.lote_fiv_acasalamento_id;
        const doadoraRegistro = acasalamentoId ? (doadorasMap.get(acasalamentoId) || 'N/A') : 'N/A';
        const touroNome = acasalamentoId ? (tourosMap.get(acasalamentoId) || 'N/A') : 'N/A';
        // Buscar número do embrião do mapa ou usar ID como fallback
        const numeroEmbriao = (numerosFixosMap && numerosFixosMap.get(t.embriao_id)) 
          ? numerosFixosMap.get(t.embriao_id) 
          : (t.embriao_id ? t.embriao_id.substring(0, 8) : 'N/A');

        return {
          numero_embriao: numeroEmbriao,
          doadora: doadoraRegistro,
          touro: touroNome,
          classificacao: t.embrioes?.classificacao || 'N/A',
          receptora_brinco: t.receptoras?.identificacao || 'N/A',
          receptora_nome: t.receptoras?.nome || 'N/A',
          data_te: t.data_te,
          veterinario: t.veterinario_responsavel || 'N/A',
          tecnico: t.tecnico_responsavel || 'N/A',
          observacoes: t.observacoes || '',
        };
      });

      setRelatorioData(relatorio);
      setShowRelatorioDialog(true);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setIsVisualizacaoApenas(false);
    }
  };

  const handleEncerrarSessao = async () => {
    if (transferenciasSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para encerrar nesta sessão.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Marcar todos os protocolos_receptoras da sessão como UTILIZADA
      const { error: prError } = await supabase
        .from('protocolo_receptoras')
        .update({ status: 'UTILIZADA' })
        .in('id', transferenciasSessao);

      if (prError) {
        console.error('Erro ao atualizar protocolos_receptoras:', prError);
        throw prError;
      }

      // Buscar IDs das receptoras que receberam embriões nesta sessão para atualizar status
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id')
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA');

      if (teError) {
        console.error('Erro ao buscar transferências para atualizar status das receptoras:', teError);
        // Não falhar a operação, apenas logar o erro
      } else if (transferenciasData && transferenciasData.length > 0) {
        // Obter IDs únicos das receptoras
        const receptoraIds = [...new Set(transferenciasData.map(t => t.receptora_id))];
        
        // Atualizar status de cada receptora para SERVIDA
        for (const receptoraId of receptoraIds) {
          const { error: statusError } = await atualizarStatusReceptora(receptoraId, 'SERVIDA');
          if (statusError) {
            console.error(`Erro ao atualizar status da receptora ${receptoraId}:`, statusError);
            // Não falhar a operação, apenas logar o erro
          }
        }
      }

      toast({
        title: 'Sessão encerrada',
        description: `${transferenciasSessao.length} transferência(s) finalizada(s) com sucesso.`,
      });

      // Limpar tudo
      setFormData({
        fazenda_id: '',
        pacote_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        data_te: new Date().toISOString().split('T')[0],
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });

      setCamposPacote({
        data_te: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
      });

      const fazendaIdAnterior = formData.fazenda_id;
      
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setPermitirDuplas(false);
      setShowRelatorioDialog(false);
      setRelatorioData([]);
      
      // Limpar estado salvo no localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Recarregar dados antes de limpar o formData
      await loadPacotes();
      if (fazendaIdAnterior) {
        await recarregarReceptoras(fazendaIdAnterior);
      }
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      toast({
        title: 'Erro ao encerrar sessão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = pacoteSelecionado?.embrioes.filter(e => 
    e.status_atual === 'FRESCO' || e.status_atual === 'CONGELADO'
  ) || [];

  // Criar mapa de números fixos para rastreabilidade
  // Buscar TODOS os embriões do pacote (incluindo transferidos) para criar números fixos
  const [todosEmbrioesPacote, setTodosEmbrioesPacote] = useState<EmbrioCompleto[]>([]);
  const [numerosFixosMap, setNumerosFixosMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (formData.pacote_id && pacoteSelecionado) {
      // Buscar TODOS os embriões do lote (incluindo transferidos) para criar números fixos
      const carregarTodosEmbrioes = async () => {
        try {
          const { data: todosEmbrioes, error } = await supabase
            .from('embrioes')
            .select('*')
            .eq('lote_fiv_id', pacoteSelecionado.lote_fiv_id)
            .order('created_at', { ascending: true }); // Ordenar por data de criação para ordem fixa

          if (error) throw error;

          if (todosEmbrioes) {
            // Enriquecer com informações de doadora e touro
            const acasalamentoIds = todosEmbrioes
              .map(e => e.lote_fiv_acasalamento_id)
              .filter((id): id is string => !!id);
            
            let acasalamentosMap = new Map();
            let doadorasMap = new Map<string, string>();
            let dosesMap = new Map<string, string>();

            if (acasalamentoIds.length > 0) {
              const { data: acasalamentosData } = await supabase
                .from('lote_fiv_acasalamentos')
                .select('id, aspiracao_doadora_id, dose_semen_id')
                .in('id', acasalamentoIds);

              if (acasalamentosData) {
                acasalamentosMap = new Map(acasalamentosData.map((a) => [a.id, a]));

                const aspiracaoIds = [...new Set(acasalamentosData.map((a) => a.aspiracao_doadora_id).filter(Boolean))];
                const doseIds = [...new Set(acasalamentosData.map((a) => a.dose_semen_id).filter(Boolean))];

                if (aspiracaoIds.length > 0) {
                  const { data: aspiracoesData } = await supabase
                    .from('aspiracoes_doadoras')
                    .select('id, doadora_id')
                    .in('id', aspiracaoIds);

                  if (aspiracoesData) {
                    const doadoraIds = [...new Set(aspiracoesData.map((a) => a.doadora_id))];
                    if (doadoraIds.length > 0) {
                      const { data: doadorasData } = await supabase
                        .from('doadoras')
                        .select('id, registro')
                        .in('id', doadoraIds);

                      if (doadorasData) {
                        doadorasMap = new Map(doadorasData.map((d) => [d.id, d.registro]));
                        
                        const aspiracaoDoadoraMap = new Map(
                          aspiracoesData.map(a => [a.id, a.doadora_id])
                        );
                        
                        acasalamentosData.forEach(ac => {
                          if (ac.aspiracao_doadora_id) {
                            const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
                            if (doadoraId) {
                              const registro = doadorasMap.get(doadoraId);
                              if (registro) {
                                acasalamentosMap.set(ac.id, {
                                  ...ac,
                                  doadora_registro: registro,
                                });
                              }
                            }
                          }
                        });
                      }
                    }
                  }
                }

                if (doseIds.length > 0) {
                  // Buscar doses com informações do touro relacionado
                  const { data: dosesData } = await supabase
                    .from('doses_semen')
                    .select(`
                      id,
                      touro_id,
                      touro:touros(id, nome, registro, raca)
                    `)
                    .in('id', doseIds);

                  if (dosesData) {
                    // Criar mapa de dose_id -> nome do touro
                    dosesMap = new Map(
                      dosesData.map((d) => {
                        const touro = d.touro as any;
                        return [d.id, touro?.nome || 'Touro desconhecido'];
                      })
                    );
                    
                    acasalamentosData.forEach(ac => {
                      if (ac.dose_semen_id) {
                        const touroNome = dosesMap.get(ac.dose_semen_id);
                        if (touroNome) {
                          const acasalamentoAtual = acasalamentosMap.get(ac.id);
                          acasalamentosMap.set(ac.id, {
                            ...acasalamentoAtual,
                            touro_nome: touroNome,
                          });
                        }
                      }
                    });
                  }
                }
              }
            }

            // Enriquecer embriões com informações
            const embrioesEnriquecidos = todosEmbrioes.map(embriao => {
              const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id || '');
              return {
                ...embriao,
                doadora_registro: acasalamento?.doadora_registro,
                touro_nome: acasalamento?.touro_nome,
              } as EmbrioCompleto;
            });

            setTodosEmbrioesPacote(embrioesEnriquecidos);

            // Criar mapa de números fixos agrupando por doadora e depois por touro (acasalamento)
            // Ordem: Doadora X + Touro X (1,2,3), Doadora X + Touro Y (4,5,6), Doadora Y + Touro X (7,8,9), etc.
            const numerosMap = new Map<string, number>();
            
            // Agrupar embriões por doadora + touro (acasalamento)
            const grupos = new Map<string, EmbrioCompleto[]>();
            
            embrioesEnriquecidos.forEach((embriao) => {
              const doadora = embriao.doadora_registro || '';
              const touro = embriao.touro_nome || '';
              const chaveGrupo = `${doadora}|${touro}`;
              
              if (!grupos.has(chaveGrupo)) {
                grupos.set(chaveGrupo, []);
              }
              grupos.get(chaveGrupo)!.push(embriao);
            });
            
            // Ordenar grupos: primeiro por doadora, depois por touro
            const gruposOrdenados = Array.from(grupos.entries()).sort(([chaveA], [chaveB]) => {
              const [doadoraA, touroA] = chaveA.split('|');
              const [doadoraB, touroB] = chaveB.split('|');
              
              // Primeiro ordena por doadora
              if (doadoraA !== doadoraB) {
                return doadoraA.localeCompare(doadoraB);
              }
              // Se mesma doadora, ordena por touro
              return touroA.localeCompare(touroB);
            });
            
            // Ordenar embriões dentro de cada grupo por created_at (ordem de criação)
            gruposOrdenados.forEach(([_, embrioesGrupo]) => {
              embrioesGrupo.sort((a, b) => {
                const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dataA - dataB;
              });
            });
            
            // Atribuir números sequenciais: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12...
            let numeroAtual = 1;
            gruposOrdenados.forEach(([_, embrioesGrupo]) => {
              embrioesGrupo.forEach((embriao) => {
                numerosMap.set(embriao.id, numeroAtual);
                numeroAtual++;
              });
            });
            
            setNumerosFixosMap(numerosMap);
          }
        } catch (error) {
          console.error('Erro ao carregar todos os embriões:', error);
        }
      };

      carregarTodosEmbrioes();
    } else {
      setTodosEmbrioesPacote([]);
      setNumerosFixosMap(new Map());
    }
  }, [formData.pacote_id, pacoteSelecionado]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Transferência de Embriões (TE)</h1>
        <p className="text-slate-600 mt-1">Destinar embriões para receptoras sincronizadas</p>
      </div>


      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Nova Transferência
          </CardTitle>
            {/* Botões de Sessão - Topo do Card */}
            {formData.fazenda_id && formData.pacote_id && transferenciasSessao.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={visualizarRelatorioSessao}
                  className="bg-slate-600 hover:bg-slate-700"
                  disabled={submitting}
                  variant="default"
                  title="Visualizar relatório da sessão atual sem encerrar"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Visualizar Relatório ({transferenciasSessao.length} transferência{transferenciasSessao.length > 1 ? 's' : ''})
                </Button>
                <Button
                  type="button"
                  onClick={() => gerarRelatorioSessao(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={submitting}
                  variant="default"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {submitting ? 'Gerando...' : `Encerrar Sessão (${transferenciasSessao.length} transferência${transferenciasSessao.length > 1 ? 's' : ''})`}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Parte Superior: Seleção de Fazenda, Pacote, Receptora e Campos Comuns */}
            <div className="space-y-4 border-b pb-6">
            {/* Passo 1: Selecionar Fazenda */}
            <div className="space-y-2">
              <Label htmlFor="fazenda_id">1. Fazenda onde estão as receptoras *</Label>
              <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.fazenda_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFazendaChange('')}
                  className="mt-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Limpar seleção
                </Button>
              )}
            </div>


            {/* Passo 2: Selecionar Pacote de Embriões */}
            {formData.fazenda_id && (
              <div className="space-y-2">
                <Label htmlFor="pacote_id">2. Pacote de Embriões *</Label>
                <Select
                  value={formData.pacote_id}
                  onValueChange={handlePacoteChange}
                  disabled={!formData.fazenda_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pacote" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacotesFiltrados.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhum pacote disponível para esta fazenda
                      </div>
                    ) : (
                      pacotesFiltrados.map((pacote) => (
                        <SelectItem key={pacote.id} value={pacote.id}>
                          {formatDate(pacote.data_despacho)} - {pacote.total} embrião(ões) - 
                          {pacote.frescos > 0 && ` ${pacote.frescos} fresco(s)`}
                          {pacote.congelados > 0 && ` ${pacote.congelados} congelado(s)`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

              {/* Passo 3: Selecionar Receptora Sincronizada (ANTES do embrião) */}
              {formData.fazenda_id && formData.pacote_id && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="receptora_id">3. Receptora Sincronizada *</Label>
                    {/* Switch: Permitir Transferências Duplas - Versão discreta */}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Switch
                        id="permitir-duplas"
                        checked={permitirDuplas}
                        onCheckedChange={setPermitirDuplas}
                        className="scale-75"
                      />
                      <Label htmlFor="permitir-duplas" className="cursor-pointer text-xs">
                        Permitir duplas
                      </Label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={formData.receptora_id}
                      onValueChange={(value) => {
                        const receptora = receptoras.find((r) => r.receptora_id === value);
                        setFormData({
                          ...formData,
                          receptora_id: value,
                          protocolo_receptora_id: receptora?.protocolo_receptora_id || '',
                        });
                      }}
                      disabled={!formData.fazenda_id || !formData.pacote_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a receptora" />
                      </SelectTrigger>
                      <SelectContent>
                        {receptoras.length === 0 ? (
                          <div className="p-2 text-sm text-slate-500">
                            {permitirDuplas 
                              ? 'Nenhuma receptora sincronizada disponível. Todas já receberam 2 embriões ou não estão sincronizadas.'
                              : 'Nenhuma receptora sincronizada disponível nesta fazenda'}
                          </div>
                        ) : (
                          receptoras.map((receptora) => {
                            const quantidadeEmbrioes = receptora.quantidade_embrioes || 0;
                            const jaRecebeu = quantidadeEmbrioes > 0;
                            return (
                              <SelectItem key={receptora.receptora_id} value={receptora.receptora_id}>
                                <div className="flex items-center gap-2">
                                  <span>{receptora.brinco}</span>
                                  {jaRecebeu && permitirDuplas && (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                                      {quantidadeEmbrioes === 1 ? '1 embrião' : '2 embriões'}
                                    </Badge>
                                  )}
                                  {receptora.data_te_prevista && (
                                    <span className="text-slate-500 text-xs">
                                      (TE prevista: {formatDate(receptora.data_te_prevista)})
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {/* Botão Descartar Receptora */}
                    {formData.receptora_id && formData.protocolo_receptora_id && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={handleDescartarReceptora}
                        disabled={submitting}
                        title="Descartar receptora (não receberá embrião)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Exibir Qualidade e Ciclando quando receptora for selecionada */}
                  {formData.receptora_id && (() => {
                    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
                    const temQualidade = receptoraSelecionada?.qualidade_semaforo !== null && receptoraSelecionada?.qualidade_semaforo !== undefined;
                    const temCiclando = receptoraSelecionada?.ciclando_classificacao !== null && receptoraSelecionada?.ciclando_classificacao !== undefined;
                    
                    if (temQualidade || temCiclando) {
                      return (
                        <div className="mt-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                          <p className="text-sm font-medium text-slate-700 mb-2">Avaliação da Receptora:</p>
                          <div className="flex items-center gap-4">
                            {temCiclando && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Ciclando:</span>
                                <CiclandoBadge
                                  value={receptoraSelecionada.ciclando_classificacao}
                                  variant="display"
                                  disabled={true}
                                />
                              </div>
                            )}
                            {temQualidade && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600">Qualidade:</span>
                                <QualidadeSemaforo
                                  value={receptoraSelecionada.qualidade_semaforo}
                                  variant="single"
                                  disabled={true}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Campos Comuns: Data TE, Vet Responsável, Técnico Responsável */}
              {formData.pacote_id && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_te">Data da TE *</Label>
                    <DatePickerBR
                      id="data_te"
                      value={formData.data_te}
                      onChange={(value) => {
                        const newDataTe = value || '';
                        setFormData({ ...formData, data_te: newDataTe });
                        setCamposPacote(prev => ({ ...prev, data_te: newDataTe }));
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="veterinario_responsavel">Veterinário Responsável *</Label>
                    <Input
                      id="veterinario_responsavel"
                      value={formData.veterinario_responsavel}
                      onChange={(e) => {
                        const newVet = e.target.value;
                        setFormData({ ...formData, veterinario_responsavel: newVet });
                        setCamposPacote(prev => ({ ...prev, veterinario_responsavel: newVet }));
                      }}
                      placeholder="Nome do veterinário"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                    <Input
                      id="tecnico_responsavel"
                      value={formData.tecnico_responsavel}
                      onChange={(e) => {
                        const newTecnico = e.target.value;
                        setFormData({ ...formData, tecnico_responsavel: newTecnico });
                        setCamposPacote(prev => ({ ...prev, tecnico_responsavel: newTecnico }));
                      }}
                      placeholder="Nome do técnico"
                    />
                  </div>
                </div>
              )}

              {/* Botão Registrar Transferência - Parte Superior */}
              {formData.embriao_id && formData.receptora_id && (
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={submitting}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    {submitting ? 'Registrando...' : 'Registrar Transferência'}
                  </Button>
                </div>
              )}

            </div>

            {/* Lista de Embriões - Sempre visível quando pacote está selecionado */}
            {formData.pacote_id && pacoteSelecionado && (
              <div className="space-y-4">
                <Label>4. Selecionar Embrião do Pacote *</Label>
                <div className="border rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900">Pacote selecionado</h3>
                    <p className="text-sm text-slate-600">
                      Data Despacho: {formatDate(pacoteSelecionado.data_despacho)} | 
                      Total: {pacoteSelecionado.total} embrião(ões)
                    </p>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="text-center w-16">Nº</TableHead>
                          <TableHead>Doadora</TableHead>
                          <TableHead>Touro</TableHead>
                          <TableHead>Classificação</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Ordenar embriões pelo número fixo (ordem crescente)
                          const embrioesOrdenados = [...embrioesDisponiveis].sort((a, b) => {
                            const numeroA = numerosFixosMap.get(a.id) || 9999;
                            const numeroB = numerosFixosMap.get(b.id) || 9999;
                            return numeroA - numeroB;
                          });

                          return embrioesOrdenados.map((embriao) => {
                            // Usar número fixo do mapa para rastreabilidade
                            const numeroFixo = numerosFixosMap.get(embriao.id) || 0;
                            
                            return (
                            <TableRow
                              key={embriao.id}
                              className={formData.embriao_id === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                              onClick={() => setFormData({ ...formData, embriao_id: embriao.id })}
                            >
                              <TableCell>
                                <input
                                  type="radio"
                                  name="embriao"
                                  value={embriao.id}
                                  checked={formData.embriao_id === embriao.id}
                                  onChange={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                  className="w-4 h-4"
                                />
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                  {numeroFixo}
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
                            </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Campo de Observações */}
            {formData.embriao_id && formData.receptora_id && (
              <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações sobre a transferência"
                    rows={3}
                  />
                      </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Dialog do Relatório */}
      <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório da Sessão de Transferência de Embriões
            </DialogTitle>
            <DialogDescription>
              Fazenda: {fazendas.find(f => f.id === formData.fazenda_id)?.nome || 'N/A'} | 
              Data da TE: {formData.data_te ? formatDate(formData.data_te) : 'N/A'} | 
              Total: {relatorioData.length} transferência(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Veterinário Responsável:</strong> {formData.veterinario_responsavel || 'N/A'}
                  </div>
              <div>
                <strong>Técnico Responsável:</strong> {formData.tecnico_responsavel || 'N/A'}
                </div>
                  </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Nº Embrião</TableHead>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Touro</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Receptora (Brinco)</TableHead>
                    <TableHead>Receptora (Nome)</TableHead>
                    <TableHead>Data TE</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorioData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-semibold">{item.numero_embriao}</TableCell>
                      <TableCell>{item.doadora}</TableCell>
                      <TableCell>{item.touro}</TableCell>
                      <TableCell>{item.classificacao}</TableCell>
                      <TableCell className="font-semibold">{item.receptora_brinco}</TableCell>
                      <TableCell>{item.receptora_nome}</TableCell>
                      <TableCell>{item.data_te ? formatDate(item.data_te) : 'N/A'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{item.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                  </div>
                </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRelatorioDialog(false);
                setIsVisualizacaoApenas(false);
              }}
            >
              Fechar
            </Button>
            {!isVisualizacaoApenas && (
              <Button
                type="button"
                onClick={async () => {
                  setShowRelatorioDialog(false);
                  setIsVisualizacaoApenas(false);
                  await handleEncerrarSessao();
                }}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Encerrando...' : 'Confirmar e Encerrar Sessão'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
