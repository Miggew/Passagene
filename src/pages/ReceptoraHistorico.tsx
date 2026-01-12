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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag } from 'lucide-react';

interface HistoryEvent {
  tipo: 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM' | 'MUDANCA_FAZENDA' | 'CADASTRO' | 'RENOMEACAO';
  data: string;
  descricao: string;
  detalhes?: string;
}

// Função auxiliar para normalizar datas (evitar problemas de timezone)
// Sempre extrai apenas a parte da data (YYYY-MM-DD) da string, sem parsear como Date
// Isso garante que a data exibida seja exatamente a que está no banco de dados
const normalizarData = (dataString: string): string => {
  if (!dataString) return dataString;
  
  // Se já é apenas uma data (YYYY-MM-DD), retornar como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
    return dataString;
  }
  
  // Tentar extrair a data diretamente da string (evita problemas de timezone)
  // Formato esperado: "2026-01-12T00:00:00.000Z" ou "2026-01-12T10:30:00.000Z" ou "2026-01-12 00:00:00"
  const match = dataString.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }
  
  // Se não conseguiu extrair, tentar parsear como Date (último recurso)
  // Neste caso, usar UTC para manter consistência
  try {
    const date = new Date(dataString);
    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      return dataString;
    }
    
    // Usar UTC para extrair a data (evita problemas de timezone)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dataString;
  }
};

interface ReceptoraHistoricoProps {
  receptoraId: string;
  open: boolean;
  onClose: () => void;
}

export default function ReceptoraHistorico({ receptoraId, open, onClose }: ReceptoraHistoricoProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receptora, setReceptora] = useState<Receptora | null>(null);
  const [timeline, setTimeline] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    if (open && receptoraId) {
      loadData();
    }
  }, [open, receptoraId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load receptora
      const { data: receptoraData, error: receptoraError } = await supabase
        .from('receptoras')
        .select('*')
        .eq('id', receptoraId)
        .single();

      if (receptoraError) throw receptoraError;
      setReceptora(receptoraData);

      // Build timeline
      const events: HistoryEvent[] = [];

      // 1. Mudanças de fazenda via receptora_fazenda_historico
      const { data: historicoFazendas, error: historicoError } = await supabase
        .from('receptora_fazenda_historico')
        .select(`
          id,
          fazenda_id,
          data_inicio,
          data_fim,
          observacoes
        `)
        .eq('receptora_id', receptoraId)
        .order('data_inicio', { ascending: false });

      if (!historicoError && historicoFazendas && historicoFazendas.length > 0) {
        // Ordenar por data_inicio para identificar o primeiro registro (mais antigo)
        const historicoOrdenado = [...historicoFazendas].sort((a, b) => 
          new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
        );
        const primeiroRegistro = historicoOrdenado[0];
        const primeiroRegistroId = primeiroRegistro.id;

        // Buscar nomes das fazendas separadamente para evitar problemas com relacionamentos
        const fazendaIdsHistorico = new Set<string>();
        for (const historico of historicoFazendas) {
          if (historico.fazenda_id) {
            fazendaIdsHistorico.add(historico.fazenda_id);
          }
        }

        const fazendasMapHistorico = new Map<string, string>();
        if (fazendaIdsHistorico.size > 0) {
          const { data: fazendasDataHistorico } = await supabase
            .from('fazendas')
            .select('id, nome')
            .in('id', Array.from(fazendaIdsHistorico));

          if (fazendasDataHistorico) {
            for (const fazenda of fazendasDataHistorico) {
              fazendasMapHistorico.set(fazenda.id, fazenda.nome);
            }
          }
        }

        // Processar histórico de forma mais clara:
        // - Ordenar do mais antigo para o mais recente para processar na ordem cronológica
        // - Cada registro com data_fim NULL representa uma chegada/mudança
        // - O primeiro registro (mais antigo) é o cadastro
        // - Os demais são mudanças de fazenda
        for (let i = 0; i < historicoOrdenado.length; i++) {
          const historico = historicoOrdenado[i];
          
          // Buscar nome da fazenda do mapa
          const fazendaNome = fazendasMapHistorico.get(historico.fazenda_id) || 'Fazenda desconhecida';
          const isPrimeiroRegistro = i === 0;
          
          if (isPrimeiroRegistro) {
            // Primeira entrada: cadastro/criação da receptora no sistema
            events.push({
              tipo: 'CADASTRO',
              data: normalizarData(historico.data_inicio),
              descricao: `Cadastro da Receptora`,
              detalhes: `Receptora cadastrada no sistema | Fazenda: ${fazendaNome}${historico.observacoes ? ` | Observações: ${historico.observacoes}` : ''}`,
            });
          } else {
            // Mudança de fazenda: chegada na nova fazenda
            // A fazenda de origem é o registro anterior (i-1)
            const historicoOrigem = historicoOrdenado[i - 1];
            const fazendaOrigemNome = fazendasMapHistorico.get(historicoOrigem.fazenda_id) || 'Fazenda desconhecida';
            
            events.push({
              tipo: 'MUDANCA_FAZENDA',
              data: normalizarData(historico.data_inicio),
              descricao: `Mudança de Fazenda`,
              detalhes: `De: ${fazendaOrigemNome} → Para: ${fazendaNome}${historico.observacoes ? ` | Observações: ${historico.observacoes}` : ''}`,
            });
          }
        }
      }

      // 2. Renomeações - buscar histórico de renomeações
      try {
        const { data: renomeacoes, error: renomeacoesError } = await supabase
          .from('receptora_renomeacoes_historico')
          .select('*')
          .eq('receptora_id', receptoraId)
          .order('data_renomeacao', { ascending: false });

        // Se a tabela não existir (erro 42P01), apenas ignorar silenciosamente
        if (renomeacoesError && renomeacoesError.code !== '42P01') {
          console.error('Erro ao buscar renomeações:', renomeacoesError);
        }

        if (!renomeacoesError && renomeacoes && renomeacoes.length > 0) {
          for (const renomeacao of renomeacoes) {
            const motivoMap: Record<string, string> = {
              'MUDANCA_FAZENDA': 'Mudança de Fazenda',
              'EDICAO_MANUAL': 'Edição Manual',
            };
            const motivoDescricao = motivoMap[renomeacao.motivo] || renomeacao.motivo || 'Renomeação';
            
            events.push({
              tipo: 'RENOMEACAO',
              data: normalizarData(renomeacao.data_renomeacao),
              descricao: `Renomeação de Brinco`,
              detalhes: `De: "${renomeacao.brinco_anterior}" → Para: "${renomeacao.brinco_novo}" | Motivo: ${motivoDescricao}${renomeacao.observacoes ? ` | ${renomeacao.observacoes}` : ''}`,
            });
          }
        }
      } catch (error) {
        // Ignorar erro se a tabela não existir
        console.warn('Tabela receptora_renomeacoes_historico não encontrada. Execute criar_tabela_historico_renomeacoes.sql');
      }

      // 3. Protocolos - buscar informações completas
      // Primeiro, buscar os protocolos_receptoras para esta receptora
      const { data: protocoloReceptoras, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          protocolo_id,
          evento_fazenda_id,
          data_inclusao,
          status,
          motivo_inapta,
          ciclando_classificacao,
          qualidade_semaforo,
          protocolos_sincronizacao (
            id,
            data_inicio,
            responsavel_inicio,
            passo2_data,
            passo2_tecnico_responsavel,
            fazenda_id
          )
        `)
        .eq('receptora_id', receptoraId)
        .order('data_inclusao', { ascending: false });

      if (prError) {
        console.error('Erro ao buscar protocolos:', prError);
        throw prError;
      }

      if (protocoloReceptoras && protocoloReceptoras.length > 0) {
        // Função para extrair veterinário e técnico do responsavel_inicio
        const parseResponsavelInicio = (responsavelInicio: string | undefined) => {
          if (!responsavelInicio) return { veterinario: null, tecnico: null };
          
          const vetMatch = responsavelInicio.match(/VET:\s*(.+?)(?:\s*\||$)/i);
          const tecMatch = responsavelInicio.match(/TEC:\s*(.+?)(?:\s*\||$)/i);
          
          return {
            veterinario: vetMatch ? vetMatch[1].trim() : null,
            tecnico: tecMatch ? tecMatch[1].trim() : null,
          };
        };

        // Coletar todos os IDs de fazendas únicos que precisamos buscar
        const fazendaIds = new Set<string>();
        for (const pr of protocoloReceptoras) {
          if (pr.evento_fazenda_id) {
            fazendaIds.add(pr.evento_fazenda_id);
          }
          // Também coletar fazenda_id dos protocolos se existir
          try {
            const protocolo = Array.isArray(pr.protocolos_sincronizacao) 
              ? pr.protocolos_sincronizacao[0] 
              : pr.protocolos_sincronizacao;
            if (protocolo && protocolo.fazenda_id) {
              fazendaIds.add(protocolo.fazenda_id);
            }
          } catch (e) {
            // Ignorar erros ao acessar protocolo
            console.warn('Erro ao acessar protocolo:', e);
          }
        }

        // Buscar todas as fazendas de uma vez
        const fazendasMap = new Map<string, string>();
        if (fazendaIds.size > 0) {
          const { data: fazendasData, error: fazendasError } = await supabase
            .from('fazendas')
            .select('id, nome')
            .in('id', Array.from(fazendaIds));

          if (fazendasError) {
            console.error('Erro ao buscar fazendas:', fazendasError);
          } else if (fazendasData) {
            for (const fazenda of fazendasData) {
              fazendasMap.set(fazenda.id, fazenda.nome);
            }
          }
        }

        // Processar cada protocolo
        for (const pr of protocoloReceptoras) {
          try {
          // Verificar se protocolo existe e está no formato correto
          let protocolo: any = null;
          
          // O Supabase pode retornar como objeto ou array dependendo da relação
          if (Array.isArray(pr.protocolos_sincronizacao)) {
            protocolo = pr.protocolos_sincronizacao[0];
          } else {
            protocolo = pr.protocolos_sincronizacao;
          }
          
          if (!protocolo || !protocolo.id) {
            console.warn('Protocolo não encontrado para protocolo_receptora:', pr.id);
            continue;
          }

          // Verificar se a receptora estava em fazenda diferente durante o protocolo
          let fazendaInfoPasso1 = '';
          
          if (pr.evento_fazenda_id && protocolo.fazenda_id && pr.evento_fazenda_id !== protocolo.fazenda_id) {
            const eventoFazendaNome = fazendasMap.get(pr.evento_fazenda_id) || 'Fazenda desconhecida';
            fazendaInfoPasso1 = ` (Fazenda: ${eventoFazendaNome})`;
          }

          // Extrair responsáveis do primeiro passo
          const responsaveisPasso1 = parseResponsavelInicio(protocolo.responsavel_inicio);
          
          // Verificar se data_inicio existe antes de formatar
          if (!protocolo.data_inicio) {
            console.warn('Protocolo sem data_inicio:', protocolo.id);
            continue;
          }
          
          // Normalizar data do protocolo
          const dataInicioNormalizada = normalizarData(protocolo.data_inicio);
          
          // Detalhes do primeiro passo
          // Formatar data usando apenas a parte da data (sem hora)
          const dataInicioFormatada = new Date(dataInicioNormalizada + 'T12:00:00').toLocaleDateString('pt-BR');
          let detalhesPasso1 = `1º Passo realizado em ${dataInicioFormatada}`;
          if (responsaveisPasso1.veterinario) {
            detalhesPasso1 += ` | Veterinário: ${responsaveisPasso1.veterinario}`;
          }
          if (responsaveisPasso1.tecnico) {
            detalhesPasso1 += ` | Técnico: ${responsaveisPasso1.tecnico}`;
          }
          detalhesPasso1 += fazendaInfoPasso1;

          // Adicionar evento do primeiro passo
          events.push({
            tipo: 'PROTOCOLO',
            data: dataInicioNormalizada,
            descricao: `Protocolo de Sincronização - 1º Passo`,
            detalhes: detalhesPasso1,
          });

          // Se houver segundo passo, adicionar evento do segundo passo
          if (protocolo.passo2_data) {
            // Normalizar data do segundo passo
            const passo2DataNormalizada = normalizarData(protocolo.passo2_data);
            const passo2DataFormatada = new Date(passo2DataNormalizada + 'T12:00:00').toLocaleDateString('pt-BR');
            let detalhesPasso2 = `2º Passo realizado em ${passo2DataFormatada}`;
            if (protocolo.passo2_tecnico_responsavel) {
              detalhesPasso2 += ` | Responsável: ${protocolo.passo2_tecnico_responsavel}`;
            }
            
            // Verificar se estava em fazenda diferente no segundo passo
            if (pr.evento_fazenda_id && protocolo.fazenda_id && pr.evento_fazenda_id !== protocolo.fazenda_id) {
              const eventoFazendaNome = fazendasMap.get(pr.evento_fazenda_id) || 'Fazenda desconhecida';
              detalhesPasso2 += ` (Fazenda: ${eventoFazendaNome})`;
            }

            // Adicionar classificações
            const classificacoes: string[] = [];
            if (pr.ciclando_classificacao) {
              classificacoes.push(`Classificação: ${pr.ciclando_classificacao}`);
            }
            if (pr.qualidade_semaforo) {
              classificacoes.push(`Nota: ${pr.qualidade_semaforo}`);
            }
            if (classificacoes.length > 0) {
              detalhesPasso2 += ` | ${classificacoes.join(' | ')}`;
            }

            // Adicionar resultado final
            if (pr.status) {
              if (pr.status === 'APTA') {
                detalhesPasso2 += ` | Resultado: APTA para transferência de embriões`;
              } else if (pr.status === 'INAPTA') {
                detalhesPasso2 += ` | Resultado: DESCARTADA`;
                if (pr.motivo_inapta) {
                  detalhesPasso2 += ` (Motivo: ${pr.motivo_inapta})`;
                }
              } else {
                detalhesPasso2 += ` | Status: ${pr.status}`;
              }
            }
            
            events.push({
              tipo: 'PROTOCOLO',
              data: passo2DataNormalizada,
              descricao: `Protocolo de Sincronização - 2º Passo`,
              detalhes: detalhesPasso2,
            });
          }
          } catch (error) {
            console.error('Erro ao processar protocolo_receptora:', pr.id, error);
            // Continuar processando os outros protocolos mesmo se um falhar
            continue;
          }
        }
      }

      // 3. Tentativas TE via v_tentativas_te_status
      const { data: tentativas } = await supabase
        .from('v_tentativas_te_status')
        .select('*')
        .eq('receptora_id', receptoraId)
        .order('data_te', { ascending: false });

      if (tentativas && tentativas.length > 0) {
        for (const te of tentativas) {
          const dataTENormalizada = normalizarData(te.data_te);
          events.push({
            tipo: 'TE',
            data: dataTENormalizada,
            descricao: `Transferência de Embrião`,
            detalhes: `Status: ${te.status_tentativa}`,
          });

          if (te.data_dg) {
            const dataDGNormalizada = normalizarData(te.data_dg);
            events.push({
              tipo: 'DG',
              data: dataDGNormalizada,
              descricao: `Diagnóstico de Gestação`,
              detalhes: `Resultado: ${te.resultado_dg || 'N/A'}`,
            });
          }

          if (te.sexagem) {
            // Usar data_dg se disponível, senão data_te
            const dataSexagem = te.data_dg ? normalizarData(te.data_dg) : dataTENormalizada;
            events.push({
              tipo: 'SEXAGEM',
              data: dataSexagem,
              descricao: `Sexagem`,
              detalhes: `Sexo: ${te.sexagem}`,
            });
          }
        }
      }

      // Sort timeline by date (most recent first)
      // Usar comparação direta de strings YYYY-MM-DD para evitar problemas de timezone
      events.sort((a, b) => {
        // Comparar strings diretamente (YYYY-MM-DD permite comparação lexicográfica)
        if (b.data > a.data) return 1;
        if (b.data < a.data) return -1;
        return 0;
      });
      setTimeline(events);
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

  const getEventIcon = (tipo: string) => {
    const icons = {
      'PROTOCOLO': <Calendar className="w-5 h-5 text-blue-600" />,
      'TE': <Syringe className="w-5 h-5 text-green-600" />,
      'DG': <Activity className="w-5 h-5 text-purple-600" />,
      'SEXAGEM': <Baby className="w-5 h-5 text-pink-600" />,
      'MUDANCA_FAZENDA': <MapPin className="w-5 h-5 text-orange-600" />,
      'CADASTRO': <UserPlus className="w-5 h-5 text-indigo-600" />,
      'RENOMEACAO': <Tag className="w-5 h-5 text-amber-600" />,
    };
    return icons[tipo as keyof typeof icons];
  };

  const getEventBadge = (tipo: string) => {
    const badges = {
      'PROTOCOLO': <Badge variant="default" className="bg-blue-600">Protocolo</Badge>,
      'TE': <Badge variant="default" className="bg-green-600">TE</Badge>,
      'DG': <Badge variant="default" className="bg-purple-600">DG</Badge>,
      'SEXAGEM': <Badge variant="default" className="bg-pink-600">Sexagem</Badge>,
      'MUDANCA_FAZENDA': <Badge variant="default" className="bg-orange-600">Mudança de Fazenda</Badge>,
      'CADASTRO': <Badge variant="default" className="bg-indigo-600">Cadastro</Badge>,
      'RENOMEACAO': <Badge variant="default" className="bg-amber-600">Renomeação</Badge>,
    };
    return badges[tipo as keyof typeof badges] || <Badge>{tipo}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
          <div className="mt-6 space-y-6">
            {receptora && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Dados da Receptora</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Brinco</p>
                    <p className="text-base text-slate-900">{receptora.identificacao}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">Nome</p>
                    <p className="text-base text-slate-900">{receptora.nome || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linha do Tempo ({timeline.length} eventos)</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Nenhum evento registrado para esta receptora
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeline.map((event, index) => (
                      <div key={index} className="flex gap-4 pb-4 border-b last:border-b-0">
                        <div className="flex-shrink-0 mt-1">
                          {getEventIcon(event.tipo)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <p className="font-medium text-slate-900">{event.descricao}</p>
                              <p className="text-sm text-slate-600">
                                {new Date(event.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                            {getEventBadge(event.tipo)}
                          </div>
                          {event.detalhes && (
                            <p className="text-sm text-slate-600 mt-2">{event.detalhes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}