import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';
import { Button } from '@/components/ui/button';
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
import { Calendar, Syringe, Activity, Baby, MapPin } from 'lucide-react';

interface HistoryEvent {
  tipo: 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM' | 'MUDANCA_FAZENDA';
  data: string;
  descricao: string;
  detalhes?: string;
}

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
          observacoes,
          fazendas!receptora_fazenda_historico_fazenda_id_fkey (
            id,
            nome
          )
        `)
        .eq('receptora_id', receptoraId)
        .order('data_inicio', { ascending: false });

      if (!historicoError && historicoFazendas && historicoFazendas.length > 0) {
        // Para cada registro no histórico:
        // - Se data_fim IS NULL: vínculo ativo (chegada na fazenda atual)
        // - Se data_fim IS NOT NULL: saída dessa fazenda (mudança)
        for (let i = 0; i < historicoFazendas.length; i++) {
          const historico = historicoFazendas[i];
          const fazendaNome = (historico.fazendas as any)?.nome || 'Fazenda desconhecida';
          
          if (historico.data_fim) {
            // Mudança: saiu desta fazenda em data_fim
            // A fazenda de destino é a próxima entrada na lista (i+1), que é anterior no tempo
            let fazendaDestinoNome = 'Fazenda desconhecida';
            if (i + 1 < historicoFazendas.length) {
              const historicoDestino = historicoFazendas[i + 1];
              fazendaDestinoNome = (historicoDestino.fazendas as any)?.nome || 'Fazenda desconhecida';
            }
            
            events.push({
              tipo: 'MUDANCA_FAZENDA',
              data: historico.data_fim,
              descricao: `Mudança de Fazenda`,
              detalhes: `De: ${fazendaNome} → Para: ${fazendaDestinoNome}${historico.observacoes ? ` | Observações: ${historico.observacoes}` : ''}`,
            });
          } else {
            // Vínculo ativo (data_fim IS NULL): chegada nesta fazenda em data_inicio
            // A fazenda de origem é a próxima entrada na lista (i+1), que é anterior no tempo
            if (i + 1 < historicoFazendas.length) {
              // Tem histórico anterior: foi uma mudança
              const historicoOrigem = historicoFazendas[i + 1];
              const fazendaOrigemNome = (historicoOrigem.fazendas as any)?.nome || 'Fazenda desconhecida';
              
              events.push({
                tipo: 'MUDANCA_FAZENDA',
                data: historico.data_inicio,
                descricao: `Mudança de Fazenda`,
                detalhes: `De: ${fazendaOrigemNome} → Para: ${fazendaNome}${historico.observacoes ? ` | Observações: ${historico.observacoes}` : ''}`,
              });
            } else {
              // Primeira entrada: chegada inicial/criação na fazenda
              events.push({
                tipo: 'MUDANCA_FAZENDA',
                data: historico.data_inicio,
                descricao: `Chegada à Fazenda`,
                detalhes: `Fazenda: ${fazendaNome}${historico.observacoes ? ` | Observações: ${historico.observacoes}` : ''}`,
              });
            }
          }
        }
      }

      // 2. Protocolos via v_protocolo_receptoras_status
      const { data: protocoloStatus } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('*')
        .eq('receptora_id', receptoraId);

      if (protocoloStatus && protocoloStatus.length > 0) {
        for (const ps of protocoloStatus) {
          events.push({
            tipo: 'PROTOCOLO',
            data: ps.data_te_prevista || new Date().toISOString(),
            descricao: `Protocolo de Sincronização`,
            detalhes: `Fase: ${ps.fase_ciclo} | Status: ${ps.status_efetivo}`,
          });
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
          events.push({
            tipo: 'TE',
            data: te.data_te,
            descricao: `Transferência de Embrião`,
            detalhes: `Status: ${te.status_tentativa}`,
          });

          if (te.data_dg) {
            events.push({
              tipo: 'DG',
              data: te.data_dg,
              descricao: `Diagnóstico de Gestação`,
              detalhes: `Resultado: ${te.resultado_dg || 'N/A'}`,
            });
          }

          if (te.sexagem) {
            events.push({
              tipo: 'SEXAGEM',
              data: te.data_dg || te.data_te,
              descricao: `Sexagem`,
              detalhes: `Sexo: ${te.sexagem}`,
            });
          }
        }
      }

      // Sort timeline by date (most recent first)
      events.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
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
                                {new Date(event.data).toLocaleDateString('pt-BR', {
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