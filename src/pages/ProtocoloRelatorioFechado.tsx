import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import CountBadge, { getTaxaVariant } from '@/components/shared/CountBadge';
import { DataTable, Column } from '@/components/shared/DataTable';

interface ReceptoraComStatusFinal extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_data_inclusao?: string;
  pr_data_retirada?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
}

export default function ProtocoloRelatorioFechado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptorasFinal, setReceptorasFinal] = useState<ReceptoraComStatusFinal[]>([]);
  const [teInfo, setTeInfo] = useState<{
    data_te?: string;
    veterinario_responsavel?: string;
    tecnico_responsavel?: string;
  } | null>(null);
  const [resumo, setResumo] = useState({
    totalIniciaram: 0,
    totalSincronizadas: 0,
    totalServidas: 0,
    totalDescartadas: 0,
  });

  // Função para enriquecer observações com informações da mudança de fazenda
  const enriquecerObservacoesMudancaFazenda = async (protocolo: ProtocoloSincronizacao): Promise<string> => {
    try {
      // Buscar receptoras do protocolo
      const { data: prData } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id')
        .eq('protocolo_id', protocolo.id)
        .limit(1); // Precisamos apenas de uma receptora para identificar a mudança

      if (!prData || prData.length === 0) {
        return protocolo.observacoes || '';
      }

      const primeiraReceptoraId = prData[0].receptora_id;

      // Buscar histórico de fazendas dessa receptora
      const { data: historicoFazendas } = await supabase
        .from('receptora_fazenda_historico')
        .select(`
          fazenda_id,
          data_inicio
        `)
        .eq('receptora_id', primeiraReceptoraId)
        .order('data_inicio', { ascending: true });

      if (!historicoFazendas || historicoFazendas.length < 2) {
        return protocolo.observacoes || '';
      }

      // Coletar IDs de fazendas para buscar nomes
      const fazendaIds = new Set<string>();
      for (const historico of historicoFazendas) {
        if (historico.fazenda_id) {
          fazendaIds.add(historico.fazenda_id);
        }
      }

      // Buscar nomes das fazendas
      const { data: fazendasData } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', Array.from(fazendaIds));

      const fazendasMap = new Map<string, string>();
      if (fazendasData) {
        for (const fazenda of fazendasData) {
          fazendasMap.set(fazenda.id, fazenda.nome);
        }
      }

      // Encontrar a mudança que corresponde à data_inicio do protocolo
      // A mudança deve ter ocorrido na mesma data ou próximo à data_inicio do protocolo
      // Normalizar data do protocolo para comparar apenas o dia (sem horas)
      const dataProtocoloStr = protocolo.data_inicio.split('T')[0]; // YYYY-MM-DD
      const [anoProtocolo, mesProtocolo, diaProtocolo] = dataProtocoloStr.split('-').map(Number);
      const dataProtocolo = new Date(anoProtocolo, mesProtocolo - 1, diaProtocolo);
      
      // Procurar mudança que ocorreu na data do protocolo ou próximo
      let mudancaEncontrada = null;
      let menorDiffDias = Infinity;
      
      for (let i = 1; i < historicoFazendas.length; i++) {
        const historicoAtual = historicoFazendas[i];
        const historicoAnterior = historicoFazendas[i - 1];
        
        // Normalizar data da mudança para comparar apenas o dia (sem horas)
        const dataMudancaStr = historicoAtual.data_inicio.split('T')[0]; // YYYY-MM-DD
        const [anoMudanca, mesMudanca, diaMudanca] = dataMudancaStr.split('-').map(Number);
        const dataMudanca = new Date(anoMudanca, mesMudanca - 1, diaMudanca);
        
        // Calcular diferença em dias (valor absoluto)
        const diffDias = Math.abs((dataMudanca.getTime() - dataProtocolo.getTime()) / (1000 * 60 * 60 * 24));
        
        // Aceitar mudanças que ocorreram na mesma data ou até 1 dia antes/depois
        // Mas preferir a mudança mais próxima da data do protocolo
        if (diffDias <= 1 && diffDias < menorDiffDias) {
          menorDiffDias = diffDias;
          mudancaEncontrada = {
            fazendaOrigem: fazendasMap.get(historicoAnterior.fazenda_id) || 'Fazenda desconhecida',
            fazendaDestino: fazendasMap.get(historicoAtual.fazenda_id) || 'Fazenda desconhecida',
            dataMudanca: historicoAtual.data_inicio, // Usar a data original do histórico
          };
        }
      }
      
      // Se não encontrou mudança próxima, usar a mudança mais recente antes da data do protocolo
      // (pode ser que o protocolo foi criado no dia seguinte à mudança)
      if (!mudancaEncontrada && historicoFazendas.length > 1) {
        // Buscar a última mudança antes ou na data do protocolo
        for (let i = historicoFazendas.length - 1; i >= 1; i--) {
          const historicoAtual = historicoFazendas[i];
          const historicoAnterior = historicoFazendas[i - 1];
          
          const dataMudancaStr = historicoAtual.data_inicio.split('T')[0];
          const [anoMudanca, mesMudanca, diaMudanca] = dataMudancaStr.split('-').map(Number);
          const dataMudanca = new Date(anoMudanca, mesMudanca - 1, diaMudanca);
          
          // Se a mudança foi antes ou na data do protocolo (até 2 dias antes)
          if (dataMudanca <= dataProtocolo && (dataProtocolo.getTime() - dataMudanca.getTime()) / (1000 * 60 * 60 * 24) <= 2) {
            mudancaEncontrada = {
              fazendaOrigem: fazendasMap.get(historicoAnterior.fazenda_id) || 'Fazenda desconhecida',
              fazendaDestino: fazendasMap.get(historicoAtual.fazenda_id) || 'Fazenda desconhecida',
              dataMudanca: historicoAtual.data_inicio,
            };
            break;
          }
        }
      }

      if (mudancaEncontrada) {
        const dataFormatada = new Date(mudancaEncontrada.dataMudanca).toLocaleDateString('pt-BR');
        return `${protocolo.observacoes} (Mudança: ${mudancaEncontrada.fazendaOrigem} → ${mudancaEncontrada.fazendaDestino} em ${dataFormatada})`;
      }

      return protocolo.observacoes || '';
    } catch {
      return protocolo.observacoes || '';
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load protocolo
      const { data: protocoloData, error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .eq('id', id)
        .single();

      if (protocoloError) throw protocoloError;

      // Permitir visualização de protocolos em qualquer status
      // Removida restrição que só permitia protocolos fechados

      // Se a observação indica que foi criado automaticamente, buscar informações da mudança
      let observacoesEnriquecidas = protocoloData.observacoes;
      if (protocoloData.observacoes && protocoloData.observacoes.includes('Protocolo criado automaticamente')) {
        observacoesEnriquecidas = await enriquecerObservacoesMudancaFazenda(protocoloData);
      }

      setProtocolo({
        ...protocoloData,
        observacoes: observacoesEnriquecidas,
      });

      // Load fazenda nome
      const { data: fazendaData, error: fazendaError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', protocoloData.fazenda_id)
        .single();

      if (fazendaError) throw fazendaError;
      setFazendaNome(fazendaData.nome);

      // Load informações da TE que resultou no fechamento do protocolo
      await loadTeInfo(protocoloData.id);

      // Load receptoras do protocolo
      await loadReceptoras({
        ...protocoloData,
        observacoes: observacoesEnriquecidas,
      });
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const loadTeInfo = async (protocoloId: string) => {
    try {
      // Buscar todas as receptoras do protocolo
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('id')
        .eq('protocolo_id', protocoloId);

      if (prError) {
        return;
      }

      if (!prData || prData.length === 0) {
        return;
      }

      const protocoloReceptoraIds = prData.map(pr => pr.id);

      // Buscar a TE mais recente realizada no protocolo
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('data_te, veterinario_responsavel, tecnico_responsavel')
        .in('protocolo_receptora_id', protocoloReceptoraIds)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (teError) {
        // Se não encontrou TE, não é erro - apenas não há TE ainda
        return;
      }

      if (teData && teData.length > 0) {
        const te = teData[0];
        setTeInfo({
          data_te: te.data_te,
          veterinario_responsavel: te.veterinario_responsavel || undefined,
          tecnico_responsavel: te.tecnico_responsavel || undefined,
        });
      }
    } catch {
      // Informações de TE são opcionais no relatório - não bloquear exibição
      setTeInfo(null);
    }
  };

  const loadReceptoras = async (protocolo: ProtocoloSincronizacao) => {
    try {
      // Buscar todas as receptoras que foram vinculadas ao protocolo
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('*')
        .eq('protocolo_id', protocolo.id)
        .order('data_inclusao', { ascending: true });

      if (prError) throw prError;

      const receptorasComStatus: ReceptoraComStatusFinal[] = [];

      for (const pr of prData || []) {
        const { data: receptoraData, error: receptoraError } = await supabase
          .from('receptoras')
          .select('*')
          .eq('id', pr.receptora_id)
          .single();

        if (receptoraError) {
          continue;
        }

        receptorasComStatus.push({
          ...receptoraData,
          pr_id: pr.id,
          pr_status: pr.status,
          pr_motivo_inapta: pr.motivo_inapta,
          pr_data_inclusao: pr.data_inclusao,
          pr_data_retirada: pr.data_retirada,
          pr_ciclando_classificacao: pr.ciclando_classificacao as 'N' | 'CL' | null | undefined,
          pr_qualidade_semaforo: pr.qualidade_semaforo as 1 | 2 | 3 | null | undefined,
        });
      }

      // Receptoras finais = todas com status final
      setReceptorasFinal(receptorasComStatus);

      // Calcular resumo
      // Sincronizadas = todas que foram aprovadas no 2º passo (APTA + UTILIZADA)
      // Servidas = das sincronizadas, quantas receberam embrião (UTILIZADA)
      const totalIniciaram = receptorasComStatus.length;
      const totalSincronizadas = receptorasComStatus.filter(r => r.pr_status === 'APTA' || r.pr_status === 'UTILIZADA').length;
      const totalServidas = receptorasComStatus.filter(r => r.pr_status === 'UTILIZADA').length;
      const totalDescartadas = receptorasComStatus.filter(r => r.pr_status === 'INAPTA').length;

      setResumo({
        totalIniciaram,
        totalSincronizadas,
        totalServidas,
        totalDescartadas,
      });
    } catch {
      toast({
        title: 'Erro ao carregar receptoras',
        description: 'Não foi possível carregar a lista de receptoras do protocolo.',
        variant: 'destructive',
      });
    }
  };

  // Extrair veterinário e técnico do responsavel_inicio
  const parseResponsavelInicio = (responsavelInicio: string | undefined) => {
    if (!responsavelInicio) return { veterinario: null, tecnico: null };
    
    const vetMatch = responsavelInicio.match(/VET:\s*(.+?)(?:\s*\||$)/i);
    const tecMatch = responsavelInicio.match(/TEC:\s*(.+?)(?:\s*\||$)/i);
    
    return {
      veterinario: vetMatch ? vetMatch[1].trim() : null,
      tecnico: tecMatch ? tecMatch[1].trim() : null,
    };
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'INICIADA': {
        label: 'Pendente',
        className: 'bg-muted text-muted-foreground border-border',
      },
      'APTA': {
        label: 'Sincronizada',
        className: 'bg-primary/15 text-primary border-primary/30',
      },
      'INAPTA': {
        label: 'Descartada',
        className: 'bg-destructive/15 text-destructive border-destructive/30',
      },
      'UTILIZADA': {
        label: 'Servida',
        className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      },
    };

    const config = statusMap[status] || { label: status, className: '' };
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!protocolo) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Protocolo não encontrado</p>
        <Button onClick={() => navigate('/protocolos')} className="mt-4">
          Voltar para Protocolos
        </Button>
      </div>
    );
  }

  const responsavelPasso1 = parseResponsavelInicio(protocolo.responsavel_inicio);
  const taxaSucesso = resumo.totalIniciaram > 0
    ? Math.round((resumo.totalSincronizadas / resumo.totalIniciaram) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Relatório do Protocolo</h1>
      </div>

      {/* Card principal com informações do protocolo */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Linha 1: Fazenda + Status + Resumo */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:gap-4 w-full md:w-auto">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                <p className="text-base font-semibold text-foreground">{fazendaNome || '—'}</p>
              </div>
              <div className="h-8 w-px bg-border hidden md:block" />
              <div>
                <span className="text-xs font-medium text-muted-foreground">Data Início</span>
                <p className="text-sm text-foreground">{protocolo.data_inicio ? formatDate(protocolo.data_inicio) : '—'}</p>
              </div>
              <div className="h-8 w-px bg-border hidden md:block" />
              <div>
                {protocolo.status === 'SINCRONIZADO' && (
                  <Badge variant="default" className="bg-primary hover:bg-primary-dark">Sincronizado</Badge>
                )}
                {protocolo.status === 'FECHADO' && (
                  <Badge variant="secondary" className="bg-muted-foreground hover:bg-muted-foreground/90 text-white">Fechado</Badge>
                )}
                {protocolo.status === 'PASSO1_FECHADO' && (
                  <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Aguardando 2º Passo</Badge>
                )}
                {protocolo.status === 'EM_TE' && (
                  <Badge variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white">Em TE</Badge>
                )}
              </div>
            </div>

            {/* Resumo inline */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total:</span>
                <CountBadge value={resumo.totalIniciaram} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Servidas:</span>
                <CountBadge value={resumo.totalServidas} variant="violet" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sinc.:</span>
                <CountBadge value={resumo.totalSincronizadas} variant="primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Desc.:</span>
                <CountBadge value={resumo.totalDescartadas} variant="danger" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Taxa:</span>
                <CountBadge value={taxaSucesso} suffix="%" variant={getTaxaVariant(taxaSucesso)} />
              </div>
            </div>
          </div>

          {/* Linha 2: Grid com etapas do protocolo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
            {/* 1º Passo */}
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">1º Passo</h4>
              <div className="space-y-0.5">
                <p className="text-xs">
                  <span className="text-muted-foreground">Vet:</span>{' '}
                  <span className="text-foreground">{responsavelPasso1.veterinario || '—'}</span>
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Téc:</span>{' '}
                  <span className="text-foreground">{responsavelPasso1.tecnico || '—'}</span>
                </p>
              </div>
            </div>

            {/* 2º Passo */}
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">2º Passo</h4>
              <div className="space-y-0.5">
                <p className="text-xs">
                  <span className="text-muted-foreground">Data:</span>{' '}
                  <span className="text-foreground">{protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '—'}</span>
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Téc:</span>{' '}
                  <span className="text-foreground">{protocolo.passo2_tecnico_responsavel || '—'}</span>
                </p>
              </div>
            </div>

            {/* TE */}
            <div className="space-y-1">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Transferência</h4>
              <div className="space-y-0.5">
                <p className="text-xs">
                  <span className="text-muted-foreground">Data:</span>{' '}
                  <span className="text-foreground">{teInfo?.data_te ? formatDate(teInfo.data_te) : '—'}</span>
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Vet:</span>{' '}
                  <span className="text-foreground">{teInfo?.veterinario_responsavel || '—'}</span>
                </p>
              </div>
            </div>

            {/* Observações (se houver) */}
            {protocolo.observacoes ? (
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Observações</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{protocolo.observacoes}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">TE (cont.)</h4>
                <p className="text-xs">
                  <span className="text-muted-foreground">Téc:</span>{' '}
                  <span className="text-foreground">{teInfo?.tecnico_responsavel || '—'}</span>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Receptoras */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Receptoras ({receptorasFinal.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <DataTable<ReceptoraComStatusFinal>
            data={receptorasFinal}
            rowKey="id"
            rowNumber
            emptyMessage="Nenhuma receptora no protocolo"
            columns={[
              { key: 'identificacao', label: 'Identificação' },
              { key: 'pr_ciclando_classificacao', label: 'Ciclo', align: 'center' },
              { key: 'pr_qualidade_semaforo', label: 'Qual.', align: 'center' },
              { key: 'pr_status', label: 'Resultado', align: 'center' },
              { key: 'pr_motivo_inapta', label: 'Motivo Descarte' },
            ]}
            renderCell={(row, column) => {
              switch (column.key) {
                case 'identificacao':
                  return (
                    <div>
                      <span className="font-medium text-sm text-foreground">{row.identificacao}</span>
                      {row.nome && (
                        <span className="text-[10px] text-muted-foreground block">{row.nome}</span>
                      )}
                    </div>
                  );
                case 'pr_ciclando_classificacao':
                  return (
                    <CiclandoBadge
                      value={row.pr_ciclando_classificacao}
                      variant="display"
                      disabled={true}
                    />
                  );
                case 'pr_qualidade_semaforo':
                  return (
                    <QualidadeSemaforo
                      value={row.pr_qualidade_semaforo}
                      variant="single"
                      disabled={true}
                    />
                  );
                case 'pr_status':
                  return getStatusBadge(row.pr_status);
                case 'pr_motivo_inapta':
                  return (
                    <span className="text-xs text-muted-foreground">
                      {row.pr_motivo_inapta || '—'}
                    </span>
                  );
                default:
                  return null;
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
