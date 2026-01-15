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
import { ArrowRightLeft, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fazenda_id: '',
    pacote_id: '',
    embriao_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    data_te: new Date().toISOString().split('T')[0],
    tipo_te: 'FRESCO',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  useEffect(() => {
    loadFazendas();
    loadPacotes();
  }, []);

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

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
      setLoading(false);
    } catch (error) {
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
      // Buscar embriões disponíveis (FRESCO ou CONGELADO)
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .in('status_atual', ['FRESCO', 'CONGELADO'])
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

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
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select('id, nome')
              .in('id', doseIds);

            if (dosesData) {
              dosesMap = new Map(dosesData.map((d) => [d.id, d.nome]));
              
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

      const pacotesArray = Array.from(pacotesMap.values());
      pacotesArray.sort((a, b) => b.data_despacho.localeCompare(a.data_despacho));

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

  const handleFazendaChange = async (fazendaId: string) => {
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      pacote_id: '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });

    // Carregar receptoras sincronizadas da fazenda
    try {
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

      const receptoraIdsNaFazenda = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIdsNaFazenda.length === 0) {
        setReceptoras([]);
        return;
      }

      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('*')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('receptora_id', receptoraIdsNaFazenda);

      if (statusError) throw statusError;

      if (!statusData || statusData.length === 0) {
        setReceptoras([]);
        return;
      }

      const protocolosIds = Array.from(new Set(statusData.map(r => r.protocolo_id)));
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('id, receptora_id, protocolo_id')
        .in('protocolo_id', protocolosIds)
        .in('receptora_id', receptoraIdsNaFazenda);

      if (prError) throw prError;

      const prMap = new Map(prData?.map((pr) => [`${pr.receptora_id}-${pr.protocolo_id}`, pr.id]) || []);

      const receptorasComId = statusData.map((r) => ({
        receptora_id: r.receptora_id,
        brinco: r.brinco,
        protocolo_id: r.protocolo_id,
        protocolo_receptora_id: prMap.get(`${r.receptora_id}-${r.protocolo_id}`) || '',
        data_te_prevista: r.data_te_prevista,
        data_limite_te: r.data_limite_te,
      }));

      setReceptoras(receptorasComId);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
    }
  };

  const handlePacoteChange = (pacoteId: string) => {
    setFormData({
      ...formData,
      pacote_id: pacoteId,
      embriao_id: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fazenda_id || !formData.pacote_id || !formData.embriao_id || !formData.receptora_id || !formData.data_te) {
      toast({
        title: 'Erro de validação',
        description: 'Todos os campos obrigatórios devem ser preenchidos',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string | null> = {
        embriao_id: formData.embriao_id,
        receptora_id: formData.receptora_id,
        protocolo_receptora_id: formData.protocolo_receptora_id || null,
        data_te: formData.data_te,
        tipo_te: formData.tipo_te,
        veterinario_responsavel: formData.veterinario_responsavel || null,
        tecnico_responsavel: formData.tecnico_responsavel || null,
        status_te: 'REALIZADA',
        observacoes: formData.observacoes || null,
      };

      const { error: teError } = await supabase.from('transferencias_embrioes').insert([insertData]);

      if (teError) throw teError;

      const { error: embriaoError } = await supabase
        .from('embrioes')
        .update({ status_atual: 'TRANSFERIDO' })
        .eq('id', formData.embriao_id);

      if (embriaoError) throw embriaoError;

      if (formData.protocolo_receptora_id) {
        const { error: prError } = await supabase
          .from('protocolo_receptoras')
          .update({ status: 'UTILIZADA' })
          .eq('id', formData.protocolo_receptora_id);

        if (prError) throw prError;
      }

      toast({
        title: 'Transferência realizada',
        description: 'Transferência de embrião registrada com sucesso',
      });

      setFormData({
        fazenda_id: formData.fazenda_id, // Manter fazenda selecionada
        pacote_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        data_te: new Date().toISOString().split('T')[0],
        tipo_te: 'FRESCO',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });

      loadPacotes();
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

  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = pacoteSelecionado?.embrioes.filter(e => 
    e.status_atual === 'FRESCO' || e.status_atual === 'CONGELADO'
  ) || [];

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
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Nova Transferência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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

            {/* Passo 3: Selecionar Embrião do Pacote */}
            {formData.pacote_id && pacoteSelecionado && (
              <div className="space-y-4">
                <Label>3. Selecionar Embrião do Pacote *</Label>
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
                          // Ordenar embriões por doadora e depois por classificação
                          const getClassificacaoOrdem = (classificacao?: string): number => {
                            if (!classificacao) return 999;
                            const ordem: Record<string, number> = {
                              'BE': 1,
                              'BN': 2,
                              'BX': 3,
                              'BL': 4,
                              'BI': 5,
                            };
                            return ordem[classificacao.toUpperCase()] || 999;
                          };

                          const embrioesOrdenados = [...embrioesDisponiveis].sort((a, b) => {
                            const doadoraA = a.doadora_registro || '';
                            const doadoraB = b.doadora_registro || '';
                            if (doadoraA !== doadoraB) {
                              return doadoraA.localeCompare(doadoraB);
                            }
                            const ordemA = getClassificacaoOrdem(a.classificacao);
                            const ordemB = getClassificacaoOrdem(b.classificacao);
                            return ordemA - ordemB;
                          });

                          return embrioesOrdenados.map((embriao, index) => (
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
                                {index + 1}
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
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* Passo 4: Selecionar Receptora Sincronizada */}
            {formData.fazenda_id && formData.embriao_id && (
              <div className="space-y-2">
                <Label htmlFor="receptora_id">4. Receptora Sincronizada *</Label>
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
                  disabled={!formData.fazenda_id || !formData.embriao_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a receptora" />
                  </SelectTrigger>
                  <SelectContent>
                    {receptoras.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhuma receptora sincronizada disponível nesta fazenda
                      </div>
                    ) : (
                      receptoras.map((receptora) => (
                        <SelectItem key={receptora.receptora_id} value={receptora.receptora_id}>
                          {receptora.brinco}
                          {receptora.data_te_prevista && ` (TE prevista: ${formatDate(receptora.data_te_prevista)})`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Campos adicionais */}
            {formData.receptora_id && (
              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_te">Data da TE *</Label>
                    <Input
                      id="data_te"
                      type="date"
                      value={formData.data_te}
                      onChange={(e) => setFormData({ ...formData, data_te: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tipo_te">Tipo de TE</Label>
                    <Select
                      value={formData.tipo_te}
                      onValueChange={(value) => setFormData({ ...formData, tipo_te: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FRESCO">FRESCO</SelectItem>
                        <SelectItem value="CONGELADO">CONGELADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="veterinario_responsavel">Veterinário Responsável</Label>
                    <Input
                      id="veterinario_responsavel"
                      value={formData.veterinario_responsavel}
                      onChange={(e) =>
                        setFormData({ ...formData, veterinario_responsavel: e.target.value })
                      }
                      placeholder="Nome do veterinário"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                    <Input
                      id="tecnico_responsavel"
                      value={formData.tecnico_responsavel}
                      onChange={(e) =>
                        setFormData({ ...formData, tecnico_responsavel: e.target.value })
                      }
                      placeholder="Nome do técnico"
                    />
                  </div>
                </div>

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
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
