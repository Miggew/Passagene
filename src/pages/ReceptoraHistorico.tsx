import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora, SupabaseError, DoseComTouroQuery, EmbriaoQuery, ProtocoloReceptoraQuery } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag, XCircle } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

interface HistoricoItem {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA' | 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM' | 'CIO_LIVRE' | 'PARICAO';
  resumo: string;
  detalhes?: string;
}

interface HistoricoAdmin {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA';
  resumo: string;
}

// Tipos para queries de Supabase (evita uso de 'any')
interface ProtocoloReceptoraComProtocoloQuery {
  id: string;
  protocolo_id: string;
  status: string;
  motivo_inapta?: string;
  protocolos_sincronizacao?: {
    id: string;
    data_inicio: string;
    passo2_data?: string;
    status?: string;
  } | Array<{
    id: string;
    data_inicio: string;
    passo2_data?: string;
    status?: string;
  }>;
}

interface EmbriaoQueryLocal {
  id: string;
  identificacao?: string;
  classificacao?: string;
  lote_fiv_acasalamento_id?: string;
}

interface DoseQueryLocal {
  id: string;
  touro_id?: string;
  touro?: {
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
  } | null;
}

const normalizarData = (dataString: string): string => {
  if (!dataString) return dataString;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString;
  }
  
  const match = dataString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  
  try {
    const date = new Date(dataString);
    if (isNaN(date.getTime())) {
      return dataString;
    }
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dataString;
  }
};

const formatarData = (data: string): string => {
  try {
    return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return data;
  }
};

interface ReceptoraHistoricoProps {
  receptoraId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

interface Estatisticas {
  totalCiclos: number;
  totalGestacoes: number;
  ciclosDesdeUltimaGestacao: number;
}

export default function ReceptoraHistorico({ receptoraId, open, onClose, onUpdated }: ReceptoraHistoricoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receptora, setReceptora] = useState<Receptora | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoAdmin, setHistoricoAdmin] = useState<HistoricoAdmin[]>([]);
  const [showCioLivreDialog, setShowCioLivreDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cioLivreForm, setCioLivreForm] = useState({
    data_cio: new Date().toISOString().split('T')[0],
  });
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalCiclos: 0,
    totalGestacoes: 0,
    ciclosDesdeUltimaGestacao: 0,
  });

  useEffect(() => {
    if (open && receptoraId) {
      loadData();
    }
  }, [open, receptoraId]);

  const carregarHistoricoReceptora = async (targetReceptoraId: string) => {
    const items: HistoricoItem[] = [];
    const itemsAdmin: HistoricoAdmin[] = [];

    const { data: receptoraData, error: receptoraError } = await supabase
      .from('receptoras')
      .select('*')
      .eq('id', targetReceptoraId)
      .single();

    if (receptoraError) {
      if ((receptoraError as SupabaseError)?.code === 'PGRST116') {
        return {
          receptoraData: null,
          items: [],
          itemsAdmin: [],
          stats: {
            totalCiclos: 0,
            totalGestacoes: 0,
            ciclosDesdeUltimaGestacao: 0,
          },
        };
      }
      throw receptoraError;
    }

    const { data: historicoFazendas } = await supabase
      .from('receptora_fazenda_historico')
      .select('id, fazenda_id, data_inicio')
      .eq('receptora_id', targetReceptoraId)
      .order('data_inicio', { ascending: true });

    if (historicoFazendas && historicoFazendas.length > 0) {
      const primeiroRegistro = historicoFazendas[0];
      const { data: fazendaData } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', primeiroRegistro.fazenda_id)
        .single();

      itemsAdmin.push({
        data: normalizarData(primeiroRegistro.data_inicio),
        tipo: 'CADASTRO',
        resumo: `Cadastro na fazenda ${fazendaData?.nome || 'desconhecida'}`,
      });

      for (let i = 1; i < historicoFazendas.length; i++) {
        const historicoAtual = historicoFazendas[i];
        const historicoAnterior = historicoFazendas[i - 1];

        const { data: fazendasData } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', [historicoAnterior.fazenda_id, historicoAtual.fazenda_id].filter(Boolean));

        const fazendasMap = new Map(fazendasData?.map(f => [f.id, f.nome]) || []);
        const origemNome = fazendasMap.get(historicoAnterior.fazenda_id) || '?';
        const destinoNome = fazendasMap.get(historicoAtual.fazenda_id) || '?';

        itemsAdmin.push({
          data: normalizarData(historicoAtual.data_inicio),
          tipo: 'MUDANCA_FAZENDA',
          resumo: `${origemNome} → ${destinoNome}`,
        });
      }
    }

    const { data: protocoloReceptoras } = await supabase
      .from('protocolo_receptoras')
      .select(`
        id,
        data_inclusao,
        status,
        motivo_inapta,
        protocolos_sincronizacao (
          id,
          data_inicio,
          passo2_data
        )
      `)
      .eq('receptora_id', targetReceptoraId)
      .order('data_inclusao', { ascending: false });

    const { data: diagnosticosData } = await supabase
      .from('diagnosticos_gestacao')
      .select('*')
      .eq('receptora_id', targetReceptoraId)
      .eq('tipo_diagnostico', 'DG')
      .order('data_diagnostico', { ascending: false });

    const { data: animaisData, error: animaisError } = await supabase
      .from('animais')
      .select('id, data_nascimento, sexo')
      .eq('receptora_id', targetReceptoraId);

    if (animaisData && animaisData.length > 0) {
      animaisData.forEach((animal) => {
        if (!animal.data_nascimento) return;
        items.push({
          data: normalizarData(animal.data_nascimento),
          tipo: 'PARICAO',
          resumo: 'Parição registrada',
          detalhes: `Animal ${animal.id.substring(0, 8)} • Sexo: ${animal.sexo || '—'}`,
        });
      });
    }

    if (protocoloReceptoras) {
      for (const pr of protocoloReceptoras) {
        const protocolo = Array.isArray(pr.protocolos_sincronizacao)
          ? pr.protocolos_sincronizacao[0]
          : pr.protocolos_sincronizacao;

        if (!protocolo || !protocolo.data_inicio) continue;

        const dataInicio = normalizarData(protocolo.data_inicio);
        let resumo = `1º Passo`;

        if (protocolo.passo2_data) {
          const dataPasso2 = normalizarData(protocolo.passo2_data);
          if (pr.status === 'APTA') {
            resumo = `1º Passo • 2º Passo: APTA`;
          } else if (pr.status === 'INAPTA') {
            resumo = `1º Passo • 2º Passo: DESCARTADA`;
            if (pr.motivo_inapta) {
              resumo += ` (${pr.motivo_inapta})`;
            }
          } else {
            resumo = `1º Passo • 2º Passo`;
          }
          items.push({
            data: dataPasso2,
            tipo: 'PROTOCOLO',
            resumo,
          });
        } else {
          items.push({
            data: dataInicio,
            tipo: 'PROTOCOLO',
            resumo,
          });
        }
      }
    }

    const { data: tesData } = await supabase
      .from('transferencias_embrioes')
      .select(`
        id,
        embriao_id,
        data_te,
        status_te,
        embrioes (
          id,
          identificacao,
          classificacao,
          lote_fiv_acasalamento_id
        )
      `)
      .eq('receptora_id', targetReceptoraId)
      .order('data_te', { ascending: false });

    const acasalamentoIds = new Set<string>();
    if (tesData) {
      tesData.forEach(te => {
        const embriao = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
        if (embriao?.lote_fiv_acasalamento_id) {
          acasalamentoIds.add(embriao.lote_fiv_acasalamento_id);
        }
      });
    }

    const acasalamentosMap = new Map<string, { doadora: string; touro: string }>();
    if (acasalamentoIds.size > 0) {
      const acasalamentoIdsArray = Array.from(acasalamentoIds).filter(Boolean);
      if (acasalamentoIdsArray.length > 0) {
        const { data: acasalamentosData, error: acasalamentosError } = await supabase
          .from('lote_fiv_acasalamentos')
          .select(`
            id,
            aspiracao_doadora_id,
            dose_semen_id
          `)
          .in('id', acasalamentoIdsArray);

        if (!acasalamentosError && acasalamentosData) {
          const aspiracaoIds = acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean);
          const doseIds = acasalamentosData.map(a => a.dose_semen_id).filter(Boolean);

          const doadorasMap = new Map<string, string>();
          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = aspiracoesData.map(a => a.doadora_id).filter(Boolean);
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  const doadorasRegistroMap = new Map(doadorasData.map(d => [d.id, d.registro]));
                  aspiracoesData.forEach(a => {
                    const registro = doadorasRegistroMap.get(a.doadora_id);
                    if (registro) {
                      doadorasMap.set(a.id, registro);
                    }
                  });
                }
              }
            }
          }

          const tourosMap = new Map<string, string>();
          if (doseIds.length > 0) {
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select(`
                id,
                touro_id,
                touro:touros(id, nome, registro, raca)
              `)
              .in('id', doseIds);

            if (dosesData) {
              dosesData.forEach((d: DoseQueryLocal) => {
                const touro = d.touro;
                tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
              });
            }
          }

          acasalamentosData.forEach(ac => {
            const doadoraRegistro = doadorasMap.get(ac.aspiracao_doadora_id) || '?';
            const touroNome = tourosMap.get(ac.dose_semen_id) || '?';
            acasalamentosMap.set(ac.id, { doadora: doadoraRegistro, touro: touroNome });
          });
        }
      }
    }

    const acasalamentosPorDataTe = new Map<string, string[]>();

    if (tesData) {
      const tesPorData = new Map<string, typeof tesData>();

      tesData.forEach(te => {
        const chave = te.data_te;
        if (!tesPorData.has(chave)) {
          tesPorData.set(chave, []);
        }
        tesPorData.get(chave)!.push(te);
      });

      tesPorData.forEach((tes, dataTe) => {
        const tesRealizadas = tes.filter(t => t.status_te === 'REALIZADA');
        const tesDescartadas = tes.filter(t => t.status_te === 'DESCARTADA');

        if (tesRealizadas.length > 0) {
          const embrioesInfo: string[] = [];
          const acasalamentosInfo: string[] = [];

          tesRealizadas.forEach(te => {
            const embriao = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
            const identificacao = embriao?.identificacao || 'Embrião';
            embrioesInfo.push(identificacao);

            if (embriao?.lote_fiv_acasalamento_id) {
              const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id);
              if (acasalamento) {
                const acasalamentoStr = `${acasalamento.doadora} × ${acasalamento.touro}`;
                if (!acasalamentosInfo.includes(acasalamentoStr)) {
                  acasalamentosInfo.push(acasalamentoStr);
                }
              }
            }
          });

          let resumo = `${tesRealizadas.length} embrião(ões): ${embrioesInfo.join(', ')}`;
          if (acasalamentosInfo.length > 0) {
            resumo += ` | ${acasalamentosInfo.join('; ')}`;
          }

          items.push({
            data: normalizarData(dataTe),
            tipo: 'TE',
            resumo,
          });

          acasalamentosPorDataTe.set(dataTe, acasalamentosInfo);
        } else if (tesDescartadas.length > 0) {
          items.push({
            data: normalizarData(dataTe),
            tipo: 'TE',
            resumo: 'Descartada para TE',
          });
        }
      });
    }

    if (diagnosticosData) {
      for (const dg of diagnosticosData) {
        let resumo = dg.resultado === 'PRENHE' ? 'PRENHE' : 
                     dg.resultado === 'RETOQUE' ? 'PRENHE (RETOQUE)' : 
                     'VAZIA';

        if (dg.numero_gestacoes && dg.numero_gestacoes > 0 && dg.resultado !== 'VAZIA') {
          resumo += ` (${dg.numero_gestacoes} gestação${dg.numero_gestacoes > 1 ? 'ões' : ''})`;
        }

        if ((dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE') && dg.data_te) {
          const acasalamentos = acasalamentosPorDataTe.get(dg.data_te);
          if (acasalamentos && acasalamentos.length > 0) {
            resumo += ` | ${acasalamentos.join('; ')}`;
          }
        }

        items.push({
          data: normalizarData(dg.data_diagnostico),
          tipo: 'DG',
          resumo,
        });
      }
    }

    const { data: sexagensData } = await supabase
      .from('diagnosticos_gestacao')
      .select('*')
      .eq('receptora_id', targetReceptoraId)
      .eq('tipo_diagnostico', 'SEXAGEM')
      .order('data_diagnostico', { ascending: false });

    if (sexagensData) {
      for (const sexagem of sexagensData) {
        let resumo = 'Sexagem: ';
        let sexagensDetalhadas: string[] = [];

        if (sexagem.observacoes) {
          const match = sexagem.observacoes.match(/SEXAGENS:([^|]+)/);
          if (match) {
            const sexagensArray = match[1].split(',').map(s => s.trim()).filter(s => s);
            sexagensDetalhadas = sexagensArray.map(s => {
              const map: Record<string, string> = { 
                'FEMEA': 'Fêmea', 
                'MACHO': 'Macho', 
                'SEM_SEXO': 'Sem Sexo', 
                'VAZIA': 'Vazia' 
              };
              return map[s] || s;
            });
          }
        }

        if (sexagensDetalhadas.length === 0 && sexagem.sexagem) {
          const map: Record<string, string> = { 'FEMEA': 'Fêmea', 'MACHO': 'Macho' };
          sexagensDetalhadas.push(map[sexagem.sexagem] || sexagem.sexagem);
        }

        if (sexagensDetalhadas.length > 0) {
          if (sexagensDetalhadas.length === 1) {
            resumo += sexagensDetalhadas[0];
          } else if (sexagensDetalhadas.length === 2) {
            if (sexagensDetalhadas[0] === sexagensDetalhadas[1]) {
              resumo += `2 ${sexagensDetalhadas[0]}s`;
            } else {
              resumo += `${sexagensDetalhadas[0]} e ${sexagensDetalhadas[1]}`;
            }
          } else {
            resumo += sexagensDetalhadas.join(', ');
          }

          if (sexagem.numero_gestacoes && sexagem.numero_gestacoes > 1) {
            resumo += ` (${sexagem.numero_gestacoes} gestações)`;
          }
        } else {
          if (sexagem.resultado === 'PRENHE') {
            resumo += 'PRENHE';
          } else if (sexagem.resultado === 'VAZIA') {
            resumo += 'VAZIA';
          } else {
            resumo += 'Resultado não disponível';
          }
        }

        items.push({
          data: normalizarData(sexagem.data_diagnostico),
          tipo: 'SEXAGEM',
          resumo,
        });
      }
    }

    const { data: cioLivreData } = await supabase
      .from('receptoras_cio_livre')
      .select('data_cio, observacoes, ativa')
      .eq('receptora_id', targetReceptoraId)
      .order('data_cio', { ascending: false });

    if (cioLivreData && receptoraData?.status_cio_livre === 'CONFIRMADA') {
      const cio = cioLivreData[0];
      if (cio?.data_cio) {
        items.push({
          data: normalizarData(cio.data_cio),
          tipo: 'CIO_LIVRE',
          resumo: 'Cio livre',
        });
      }
    }

    const stats: Estatisticas = {
      totalCiclos: 0,
      totalGestacoes: 0,
      ciclosDesdeUltimaGestacao: 0,
    };

    if (protocoloReceptoras) {
      stats.totalCiclos = protocoloReceptoras.length;

      let dataUltimaGestacao: string | null = null;
      if (diagnosticosData && diagnosticosData.length > 0) {
        const dgsOrdenados = [...diagnosticosData].sort((a, b) => {
          const dataA = normalizarData(a.data_diagnostico);
          const dataB = normalizarData(b.data_diagnostico);
          return dataB.localeCompare(dataA);
        });

        const ultimaGestacao = dgsOrdenados.find(dg => 
          dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE'
        );

        if (ultimaGestacao) {
          dataUltimaGestacao = normalizarData(ultimaGestacao.data_diagnostico);
        }
      }

      if (dataUltimaGestacao) {
        for (const pr of protocoloReceptoras) {
          const protocolo = Array.isArray(pr.protocolos_sincronizacao)
            ? pr.protocolos_sincronizacao[0]
            : pr.protocolos_sincronizacao;

          if (!protocolo) continue;

          const dataReferencia = protocolo.passo2_data || protocolo.data_inicio;
          if (!dataReferencia) continue;

          const dataRefNormalizada = normalizarData(dataReferencia);
          
          if (dataRefNormalizada > dataUltimaGestacao) {
            stats.ciclosDesdeUltimaGestacao++;
          }
        }
      } else {
        stats.ciclosDesdeUltimaGestacao = stats.totalCiclos;
      }
    }

    if (diagnosticosData) {
      const gestacoesUnicas = new Set<string>();
      diagnosticosData.forEach(dg => {
        if (dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE') {
          const chave = dg.data_te || dg.data_diagnostico;
          gestacoesUnicas.add(chave);
        }
      });
      stats.totalGestacoes = gestacoesUnicas.size;
    }

    items.sort((a, b) => {
      if (b.data > a.data) return 1;
      if (b.data < a.data) return -1;
      return 0;
    });

    itemsAdmin.sort((a, b) => {
      if (b.data > a.data) return 1;
      if (b.data < a.data) return -1;
      return 0;
    });

    return { receptoraData, items, itemsAdmin, stats };
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const principal = await carregarHistoricoReceptora(receptoraId);
      setReceptora(principal.receptoraData);
      setHistorico(principal.items);
      setHistoricoAdmin(principal.itemsAdmin);
      setEstatisticas(principal.stats);

    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarCioLivre = async () => {
    if (!receptora) {
      toast({
        title: 'Receptora não carregada',
        description: 'Abra novamente o histórico para registrar o cio livre.',
        variant: 'destructive',
      });
      return;
    }

    let fazendaId = receptora.fazenda_atual_id;
    if (!fazendaId) {
      const { data: fazendaAtualData, error: fazendaAtualError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('fazenda_id_atual')
        .eq('receptora_id', receptora.id)
        .limit(1);
      if (!fazendaAtualError && fazendaAtualData && fazendaAtualData.length > 0) {
        fazendaId = fazendaAtualData[0]?.fazenda_id_atual || undefined;
      }
    }
    if (!fazendaId) {
      const { data: historicoFazendaData, error: historicoFazendaError } = await supabase
        .from('receptora_fazenda_historico')
        .select('fazenda_id, data_inicio')
        .eq('receptora_id', receptora.id)
        .order('data_inicio', { ascending: false })
        .limit(1);
      if (!historicoFazendaError && historicoFazendaData && historicoFazendaData.length > 0) {
        fazendaId = historicoFazendaData[0]?.fazenda_id || undefined;
      }
    }
    if (!fazendaId) {
      toast({
        title: 'Fazenda não encontrada',
        description: 'A receptora não possui fazenda atual vinculada.',
        variant: 'destructive',
      });
      return;
    }

    if (!cioLivreForm.data_cio) {
      toast({
        title: 'Data do cio não informada',
        description: 'Informe a data do cio livre.',
        variant: 'destructive',
      });
      return;
    }

    const statusAtual = receptora.status_reprodutivo || 'VAZIA';

    try {
      setSubmitting(true);
      const { error: atualizarReceptoraError } = await supabase
        .from('receptoras')
        .update({
          is_cio_livre: true,
          status_cio_livre: 'PENDENTE',
        })
        .eq('id', receptora.id);
      if (atualizarReceptoraError) throw atualizarReceptoraError;

      const { error: cioLivreError } = await supabase
        .from('receptoras_cio_livre')
        .insert([
          {
            receptora_id: receptora.id,
            fazenda_id: fazendaId,
            data_cio: cioLivreForm.data_cio,
            observacoes: null,
            ativa: true,
          },
        ]);
      if (cioLivreError) throw cioLivreError;

      toast({
        title: 'Cio livre registrado',
        description: 'Receptora liberada para TE. Confirmação automática após a transferência.',
      });
      setShowCioLivreDialog(false);
      setCioLivreForm({
        data_cio: new Date().toISOString().split('T')[0],
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Erro ao registrar cio livre',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejeitarCioLivre = async () => {
    if (!receptora || !receptora.is_cio_livre) {
      return;
    }
    if (!confirm('Rejeitar este cio livre? A receptora não ficará disponível para TE.')) {
      return;
    }
    try {
      setSubmitting(true);
      const { error: copiaError } = await supabase
        .from('receptoras')
        .update({ is_cio_livre: false, status_cio_livre: 'REJEITADA' })
        .eq('id', receptora.id);
      if (copiaError) throw copiaError;

      const { error: cioLivreError } = await supabase
        .from('receptoras_cio_livre')
        .update({ ativa: false })
        .eq('receptora_id', receptora.id)
        .eq('ativa', true);
      if (cioLivreError) throw cioLivreError;

      toast({
        title: 'Cio livre rejeitado',
        description: 'O cio livre foi marcado como rejeitado.',
      });
      await loadData();
    } catch (error) {
      toast({
        title: 'Erro ao rejeitar cio livre',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getTipoIcon = (tipo: string) => {
    const icons = {
      'CADASTRO': <UserPlus className="w-4 h-4 text-indigo-600" />,
      'MUDANCA_FAZENDA': <MapPin className="w-4 h-4 text-orange-600" />,
      'PROTOCOLO': <Calendar className="w-4 h-4 text-blue-600" />,
      'TE': <Syringe className="w-4 h-4 text-green-600" />,
      'DG': <Activity className="w-4 h-4 text-purple-600" />,
      'SEXAGEM': <Baby className="w-4 h-4 text-pink-600" />,
      'PARICAO': <Baby className="w-4 h-4 text-teal-600" />,
      'CIO_LIVRE': <Tag className="w-4 h-4 text-amber-600" />,
    };
    return icons[tipo as keyof typeof icons] || <Calendar className="w-4 h-4" />;
  };

  const getTipoBadge = (tipo: string) => {
    const badges = {
      'CADASTRO': <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Cadastro</Badge>,
      'MUDANCA_FAZENDA': <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Fazenda</Badge>,
      'PROTOCOLO': <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Protocolo</Badge>,
      'TE': <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">TE</Badge>,
      'DG': <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">DG</Badge>,
      'SEXAGEM': <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">Sexagem</Badge>,
      'PARICAO': <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">Parição</Badge>,
      'CIO_LIVRE': <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Cio Livre</Badge>,
    };
    return badges[tipo as keyof typeof badges] || <Badge variant="outline">{tipo}</Badge>;
  };

  const getBadgeCioLivre = (status?: string | null) => {
    if (status === 'CONFIRMADA') {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Confirmada</Badge>;
    }
    if (status === 'REJEITADA') {
      return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Rejeitada</Badge>;
    }
    if (status === 'SUBSTITUIDA') {
      return <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Substituída</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>;
  };

  const statusAtual = receptora?.status_reprodutivo || 'VAZIA';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico da Receptora</SheetTitle>
          <SheetDescription>
            {receptora ? `Brinco ${receptora.identificacao} ${receptora.nome ? `- ${receptora.nome}` : ''}` : 'Carregando...'}
          </SheetDescription>
        </SheetHeader>
        {receptora && !receptora.is_cio_livre && (
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={() => setShowCioLivreDialog(true)}>
              Registrar Cio Livre
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {receptora && (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Brinco</p>
                        <p className="font-medium">{receptora.identificacao}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Nome</p>
                        <p className="font-medium">{receptora.nome || '-'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Status Atual</p>
                        <StatusBadge status={receptora.status_reprodutivo || 'VAZIA'} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {receptora.is_cio_livre && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Cio Livre</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <p className="text-slate-500">Status</p>
                        {getBadgeCioLivre(receptora.status_cio_livre)}
                      </div>
                      {receptora.status_cio_livre === 'PENDENTE' && (
                        <div className="mt-4 flex items-center gap-2">
                          <Button type="button" variant="outline" onClick={handleRejeitarCioLivre} disabled={submitting}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejeitar Cio Livre
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Estatísticas Reprodutivas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-2xl font-bold text-blue-700">{estatisticas.totalCiclos}</p>
                        <p className="text-sm text-slate-600 mt-1">Ciclos Realizados</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-2xl font-bold text-green-700">{estatisticas.totalGestacoes}</p>
                        <p className="text-sm text-slate-600 mt-1">Gestações</p>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-2xl font-bold text-orange-700">{estatisticas.ciclosDesdeUltimaGestacao}</p>
                        <p className="text-sm text-slate-600 mt-1">Ciclos desde Última Gestação</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}


            {historicoAdmin.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Histórico Administrativo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historicoAdmin.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          {getTipoIcon(item.tipo)}
                          {getTipoBadge(item.tipo)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.resumo}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatarData(item.data)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linha do Tempo Reprodutiva ({historico.length} eventos)</CardTitle>
              </CardHeader>
              <CardContent>
                {historico.length === 0 ? (
                  <EmptyState
                    title="Nenhum evento registrado"
                    description="Quando houver eventos, eles aparecerão aqui."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Data</TableHead>
                        <TableHead className="w-[120px]">Tipo</TableHead>
                        <TableHead>Resumo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historico.map((item, index) => (
                        <TableRow key={index} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-sm">
                            {formatarData(item.data)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTipoIcon(item.tipo)}
                              {getTipoBadge(item.tipo)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{item.resumo}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </div>
        )}
      </SheetContent>
      <Dialog
        open={showCioLivreDialog}
        onOpenChange={(isOpen) => {
          setShowCioLivreDialog(isOpen);
          if (isOpen) {
            setCioLivreForm({
              data_cio: new Date().toISOString().split('T')[0],
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Cio Livre</DialogTitle>
            <DialogDescription>
              Registre a data do cio livre. A confirmação ocorrerá automaticamente após a TE.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>Receptora</span>
                <span className="font-medium">
                  {receptora?.identificacao} {receptora?.nome ? `- ${receptora.nome}` : ''}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span>Status atual</span>
                <StatusBadge status={statusAtual} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data do cio *</Label>
              <DatePickerBR
                value={cioLivreForm.data_cio}
                onChange={(value) => setCioLivreForm((prev) => ({ ...prev, data_cio: value || '' }))}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCioLivreDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleRegistrarCioLivre} disabled={submitting}>
              Registrar Cio Livre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
