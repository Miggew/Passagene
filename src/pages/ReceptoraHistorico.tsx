import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag, CheckCircle, XCircle } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';

interface HistoricoItem {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA' | 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM';
  resumo: string;
  detalhes?: string;
}

interface HistoricoAdmin {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA';
  resumo: string;
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
}

interface Estatisticas {
  totalCiclos: number;
  totalGestacoes: number;
  ciclosDesdeUltimaGestacao: number;
}

export default function ReceptoraHistorico({ receptoraId, open, onClose }: ReceptoraHistoricoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receptora, setReceptora] = useState<Receptora | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoAdmin, setHistoricoAdmin] = useState<HistoricoAdmin[]>([]);
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

  const loadData = async () => {
    try {
      setLoading(true);
      const items: HistoricoItem[] = [];
      const itemsAdmin: HistoricoAdmin[] = [];

      // Carregar receptora
      const { data: receptoraData, error: receptoraError } = await supabase
        .from('receptoras')
        .select('*')
        .eq('id', receptoraId)
        .single();

      if (receptoraError) throw receptoraError;
      setReceptora(receptoraData);

      // 1. CADASTRO e MUDANÇAS DE FAZENDA - separar em histórico administrativo
      const { data: historicoFazendas } = await supabase
        .from('receptora_fazenda_historico')
        .select('id, fazenda_id, data_inicio')
        .eq('receptora_id', receptoraId)
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

        // Mudanças de fazenda
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

      // 2. PROTOCOLOS - agrupar 1º e 2º passo
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
        .eq('receptora_id', receptoraId)
        .order('data_inclusao', { ascending: false });

      // Buscar DGs para calcular estatísticas
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('receptora_id', receptoraId)
        .eq('tipo_diagnostico', 'DG')
        .order('data_diagnostico', { ascending: false });

      if (protocoloReceptoras) {
        for (const pr of protocoloReceptoras) {
          const protocolo: any = Array.isArray(pr.protocolos_sincronizacao) 
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
            // Usar data do 2º passo como referência
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

      // 3. TEs - agrupar por data e resumir (com acasalamentos)
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
        .eq('receptora_id', receptoraId)
        .order('data_te', { ascending: false });

      // Buscar acasalamentos separadamente para evitar problemas com joins aninhados
      const acasalamentoIds = new Set<string>();
      if (tesData) {
        tesData.forEach(te => {
          const embriao: any = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
          if (embriao?.lote_fiv_acasalamento_id) {
            acasalamentoIds.add(embriao.lote_fiv_acasalamento_id);
          }
        });
      }

      // Buscar acasalamentos com doadoras e touros
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

          if (acasalamentosError) {
            console.error('Erro ao buscar acasalamentos:', acasalamentosError);
          } else if (acasalamentosData) {
            const aspiracaoIds = acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean);
            const doseIds = acasalamentosData.map(a => a.dose_semen_id).filter(Boolean);

            // Buscar aspirações e doadoras
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
                    // Criar mapa doadora_id -> registro
                    const doadorasRegistroMap = new Map(doadorasData.map(d => [d.id, d.registro]));
                    // Mapear aspiração -> doadora
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

            // Buscar doses e touros
            const tourosMap = new Map<string, string>();
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
                // Extrair nome do touro relacionado
                dosesData.forEach((d: any) => {
                  const touro = d.touro;
                  tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
                });
              }
            }

            // Mapear acasalamentos
            acasalamentosData.forEach(ac => {
              const doadoraRegistro = doadorasMap.get(ac.aspiracao_doadora_id) || '?';
              const touroNome = tourosMap.get(ac.dose_semen_id) || '?';
              acasalamentosMap.set(ac.id, { doadora: doadoraRegistro, touro: touroNome });
            });
          }
        }
      }

      // Mapa para armazenar acasalamentos por data_te (para usar nos DGs)
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
              const embriao: any = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
              const identificacao = embriao?.identificacao || 'Embrião';
              embrioesInfo.push(identificacao);

              // Buscar acasalamento do mapa
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

            // Armazenar acasalamentos para usar nos DGs
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

      // 4. DGs (já carregado acima para calcular estatísticas)
      if (diagnosticosData) {
        for (const dg of diagnosticosData) {
          let resumo = dg.resultado === 'PRENHE' ? 'PRENHE' : 
                       dg.resultado === 'RETOQUE' ? 'PRENHE (RETOQUE)' : 
                       'VAZIA';

          if (dg.numero_gestacoes && dg.numero_gestacoes > 0 && dg.resultado !== 'VAZIA') {
            resumo += ` (${dg.numero_gestacoes} gestação${dg.numero_gestacoes > 1 ? 'ões' : ''})`;
          }

          // Adicionar acasalamento(s) do(s) embrião(ões) que resultaram na gestação
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

      // 5. SEXAGENS
      const { data: sexagensData } = await supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('receptora_id', receptoraId)
        .eq('tipo_diagnostico', 'SEXAGEM')
        .order('data_diagnostico', { ascending: false });

      if (sexagensData) {
        for (const sexagem of sexagensData) {
          let resumo = 'Sexagem: ';
          let sexagensDetalhadas: string[] = [];

          // Parsear sexagens das observações (formato: SEXAGENS:FEMEA,MACHO|...)
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

          // Se não encontrou nas observações, usar o campo sexagem
          if (sexagensDetalhadas.length === 0 && sexagem.sexagem) {
            const map: Record<string, string> = { 'FEMEA': 'Fêmea', 'MACHO': 'Macho' };
            sexagensDetalhadas.push(map[sexagem.sexagem] || sexagem.sexagem);
          }

          // Montar resumo com os resultados
          if (sexagensDetalhadas.length > 0) {
            // Formatar de forma mais legível
            if (sexagensDetalhadas.length === 1) {
              resumo += sexagensDetalhadas[0];
            } else if (sexagensDetalhadas.length === 2) {
              // Se são 2 e diferentes, mostrar ambos
              if (sexagensDetalhadas[0] === sexagensDetalhadas[1]) {
                resumo += `2 ${sexagensDetalhadas[0]}s`;
              } else {
                resumo += `${sexagensDetalhadas[0]} e ${sexagensDetalhadas[1]}`;
              }
            } else {
              // Múltiplas gestações
              resumo += sexagensDetalhadas.join(', ');
            }

            // Adicionar número de gestações se disponível
            if (sexagem.numero_gestacoes && sexagem.numero_gestacoes > 1) {
              resumo += ` (${sexagem.numero_gestacoes} gestações)`;
            }
          } else {
            // Fallback: mostrar resultado básico
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

      // Calcular estatísticas
      const stats: Estatisticas = {
        totalCiclos: 0,
        totalGestacoes: 0,
        ciclosDesdeUltimaGestacao: 0,
      };

      // Contar ciclos (protocolos iniciados = cada protocolo_receptora é um ciclo)
      if (protocoloReceptoras) {
        stats.totalCiclos = protocoloReceptoras.length;

        // Encontrar a data da última gestação (último DG com PRENHE ou RETOQUE)
        let dataUltimaGestacao: string | null = null;
        if (diagnosticosData && diagnosticosData.length > 0) {
          // Ordenar por data (mais recente primeiro) e encontrar a última gestação
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

        // Contar ciclos desde a última gestação
        if (dataUltimaGestacao) {
          // Contar protocolos que ocorreram após a última gestação
          for (const pr of protocoloReceptoras) {
            const protocolo: any = Array.isArray(pr.protocolos_sincronizacao) 
              ? pr.protocolos_sincronizacao[0] 
              : pr.protocolos_sincronizacao;

            if (!protocolo) continue;

            // Data de referência: passo2_data se existir, senão data_inicio
            const dataReferencia = protocolo.passo2_data || protocolo.data_inicio;
            if (!dataReferencia) continue;

            const dataRefNormalizada = normalizarData(dataReferencia);
            
            // Se o protocolo ocorreu após a última gestação, conta como ciclo desde última gestação
            if (dataRefNormalizada > dataUltimaGestacao) {
              stats.ciclosDesdeUltimaGestacao++;
            }
          }
        } else {
          // Se nunca teve gestação, todos os ciclos são desde a última gestação (que não existe)
          stats.ciclosDesdeUltimaGestacao = stats.totalCiclos;
        }
      }

      // Contar gestações (DGs únicos com PRENHE ou RETOQUE)
      // Agrupar por data_te para contar gestações únicas (mesma TE = mesma gestação)
      if (diagnosticosData) {
        const gestacoesUnicas = new Set<string>();
        diagnosticosData.forEach(dg => {
          if (dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE') {
            // Usar data_te como chave para agrupar gestações da mesma TE
            const chave = dg.data_te || dg.data_diagnostico;
            gestacoesUnicas.add(chave);
          }
        });
        stats.totalGestacoes = gestacoesUnicas.size;
      }

      // Ordenar por data (mais recente primeiro)
      items.sort((a, b) => {
        if (b.data > a.data) return 1;
        if (b.data < a.data) return -1;
        return 0;
      });

      // Ordenar histórico administrativo (mais recente primeiro)
      itemsAdmin.sort((a, b) => {
        if (b.data > a.data) return 1;
        if (b.data < a.data) return -1;
        return 0;
      });

      setHistorico(items);
      setHistoricoAdmin(itemsAdmin);
      setEstatisticas(stats);
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

  const getTipoIcon = (tipo: string) => {
    const icons = {
      'CADASTRO': <UserPlus className="w-4 h-4 text-indigo-600" />,
      'MUDANCA_FAZENDA': <MapPin className="w-4 h-4 text-orange-600" />,
      'PROTOCOLO': <Calendar className="w-4 h-4 text-blue-600" />,
      'TE': <Syringe className="w-4 h-4 text-green-600" />,
      'DG': <Activity className="w-4 h-4 text-purple-600" />,
      'SEXAGEM': <Baby className="w-4 h-4 text-pink-600" />,
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
    };
    return badges[tipo as keyof typeof badges] || <Badge variant="outline">{tipo}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico da Receptora</SheetTitle>
          <SheetDescription>
            {receptora ? `Brinco ${receptora.identificacao} ${receptora.nome ? `- ${receptora.nome}` : ''}` : 'Carregando...'}
          </SheetDescription>
        </SheetHeader>

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
                  <div className="text-center py-8 text-slate-500">
                    Nenhum evento registrado
                  </div>
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
    </Sheet>
  );
}
