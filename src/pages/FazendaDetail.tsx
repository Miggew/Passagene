import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getGoogleMapsUrl, getGoogleMapsSearchUrl } from '@/lib/coordinates';
import type { Fazenda, Doadora, DoseComTouroQuery } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Navigation, Calendar, Syringe, Activity, Baby } from 'lucide-react';

interface ProtocoloInfo {
  id: string;
  data_inicio: string;
  data_retirada?: string;
  status?: string;
}

interface ReceptoraInfo {
  brinco: string;
  fase_ciclo?: string;
  status_efetivo?: string;
  motivo_efetivo?: string;
  data_te_prevista?: string;
  data_limite_te?: string;
}

interface ReceptoraFazenda {
  receptora_id: string;
  brinco: string;
  nome?: string;
  status_reprodutivo?: string;
  data_provavel_parto?: string | null;
}

interface TransferenciaStats {
  total_ultimos_60_dias: number;
  sem_diagnostico: number;
}

interface PendenciasResumo {
  passo2Pendente: number;
  tePendente: number;
  dgPendente: number;
  sexagemPendente: number;
  prenhesTotal: number;
  prenhesDataMaisProxima?: string;
  prenhesNaDataMaisProxima: number;
}

interface ReceptoraStats {
  total: number;
  porStatus: Array<{ status: string; total: number }>;
}

interface DoadoraStats {
  total: number;
  porRaca: Array<{ raca: string; total: number }>;
  oocitos30d: number;
  aspiracoes30d: number;
  mediaOocitos: number;
}

interface AnimalNascido {
  id: string;
  data_nascimento: string;
  sexo: string;
  raca?: string | null;
  receptora_id?: string | null;
  receptora_brinco?: string;
  receptora_nome?: string;
  embriao_id?: string | null;
  embriao_identificacao?: string | null;
  doadora?: string | null;
  touro?: string | null;
}

export default function FazendaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [clienteNome, setClienteNome] = useState<string>('');
  const [protocolos, setProtocolos] = useState<ProtocoloInfo[]>([]);
  const [receptorasSincronizadas, setReceptorasSincronizadas] = useState<ReceptoraInfo[]>([]);
  const [receptorasFazenda, setReceptorasFazenda] = useState<ReceptoraFazenda[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [transferenciaStats, setTransferenciaStats] = useState<TransferenciaStats>({
    total_ultimos_60_dias: 0,
    sem_diagnostico: 0,
  });
  const [pendencias, setPendencias] = useState<PendenciasResumo>({
    passo2Pendente: 0,
    tePendente: 0,
    dgPendente: 0,
    sexagemPendente: 0,
    prenhesTotal: 0,
    prenhesDataMaisProxima: undefined,
    prenhesNaDataMaisProxima: 0,
  });
  const [receptoraStats, setReceptoraStats] = useState<ReceptoraStats>({
    total: 0,
    porStatus: [],
  });
  const [doadoraStats, setDoadoraStats] = useState<DoadoraStats>({
    total: 0,
    porRaca: [],
    oocitos30d: 0,
    aspiracoes30d: 0,
    mediaOocitos: 0,
  });
  const [animaisNascidos, setAnimaisNascidos] = useState<AnimalNascido[]>([]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load fazenda
      const { data: fazendaData, error: fazendaError } = await supabase
        .from('fazendas')
        .select('*')
        .eq('id', id)
        .single();

      if (fazendaError) throw fazendaError;
      setFazenda(fazendaData);

      // Load cliente name
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('nome')
        .eq('id', fazendaData.cliente_id)
        .single();

      if (clienteError) throw clienteError;
      setClienteNome(clienteData.nome);

      // Load protocolos em andamento
      // Buscar protocolos aguardando 2º passo (PASSO1_FECHADO) ou sincronizados (SINCRONIZADO) ou fechados (FECHADO)
      // Nota: Status 'ABERTO' foi removido - protocolos são criados já com PASSO1_FECHADO
      // Nota: SINCRONIZADO = 2º passo finalizado (pronto para TE)
      // Nota: FECHADO = TE(s) realizada(s) (atualizado automaticamente pelo trigger)
      // Nota: Após unificação do Passo 2, não existe mais estado intermediário no banco.
      // O passo 2 só salva tudo quando finalizado (status = SINCRONIZADO).
      const { data: protocolosData, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, data_inicio, data_retirada, status')
        .eq('fazenda_id', id)
        .in('status', ['PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO', 'SINCRONIZADO', 'FECHADO'])
        .order('data_inicio', { ascending: false });

      if (protocolosError) throw protocolosError;
      setProtocolos(protocolosData || []);

      // Load receptoras sincronizadas (try view first, fallback to direct query)
      try {
        const { data: viewData, error: viewError } = await supabase
          .from('v_protocolo_receptoras_status')
          .select('*')
          .in('protocolo_id', protocolosData?.map(p => p.id) || [])
          .eq('fase_ciclo', 'SINCRONIZADA');

        if (!viewError && viewData) {
          setReceptorasSincronizadas(viewData.map(v => ({
            brinco: v.brinco,
            fase_ciclo: v.fase_ciclo,
            status_efetivo: v.status_efetivo,
            motivo_efetivo: v.motivo_efetivo,
            data_te_prevista: v.data_te_prevista,
            data_limite_te: v.data_limite_te,
          })));
        }
      } catch {
        // View doesn't exist, skip
      }

      // Load transferencias stats
      // Primeiro, buscar receptoras da fazenda atual
      const { data: viewDataFazenda, error: viewErrorFazenda } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', id);

      if (viewErrorFazenda) throw viewErrorFazenda;

      const receptoraIdsNaFazenda = viewDataFazenda?.map(v => v.receptora_id) || [];
      const hoje = new Date().toISOString().split('T')[0];

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 60);
      
      // Filtrar transferências por receptoras que estão na fazenda
      const { data: transferenciasData, error: transferenciasError } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te')
        .in('receptora_id', receptoraIdsNaFazenda.length > 0 ? receptoraIdsNaFazenda : ['00000000-0000-0000-0000-000000000000'])
        .gte('data_te', dataLimite.toISOString().split('T')[0]);

      if (transferenciasError) throw transferenciasError;

      const totalTransferencias = transferenciasData?.length || 0;

      // Check which have diagnostico
      if (transferenciasData && transferenciasData.length > 0) {
        const receptoraIds = transferenciasData.map(t => t.receptora_id);
        const { data: diagnosticosData, error: diagnosticosError } = await supabase
          .from('diagnosticos_gestacao')
          .select('receptora_id')
          .in('receptora_id', receptoraIds);

        if (!diagnosticosError) {
          const receptorasComDiagnostico = new Set(diagnosticosData?.map(d => d.receptora_id));
          const semDiagnostico = transferenciasData.filter(t => !receptorasComDiagnostico.has(t.receptora_id)).length;
          
          setTransferenciaStats({
            total_ultimos_60_dias: totalTransferencias,
            sem_diagnostico: semDiagnostico,
          });
        }
      }

      // Load receptoras da fazenda atual (via vw_receptoras_fazenda_atual)
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', id);

      if (!viewError && viewData) {
        const receptoraIds = viewData.map(v => v.receptora_id);
        
        if (receptoraIds.length > 0) {
          const { data: receptorasData, error: receptorasError } = await supabase
            .from('receptoras')
            .select('id, identificacao, nome, status_reprodutivo, data_provavel_parto')
            .in('id', receptoraIds)
            .order('identificacao', { ascending: true });

          if (!receptorasError) {
            setReceptorasFazenda(receptorasData?.map(r => ({
              receptora_id: r.id,
              brinco: r.identificacao,
              nome: r.nome,
              status_reprodutivo: r.status_reprodutivo,
              data_provavel_parto: r.data_provavel_parto,
            })) || []);

            const totalReceptoras = receptorasData?.length || 0;
            const statusMap = new Map<string, number>();
            (receptorasData || []).forEach((r) => {
              const status = r.status_reprodutivo || 'SEM_STATUS';
              statusMap.set(status, (statusMap.get(status) || 0) + 1);
            });
            setReceptoraStats({
              total: totalReceptoras,
              porStatus: Array.from(statusMap.entries())
                .map(([status, total]) => ({ status, total }))
                .sort((a, b) => b.total - a.total),
            });

            const protocolosPendentesPasso2 = (protocolosData || [])
              .filter(p => p.status === 'PASSO1_FECHADO' || p.status === 'PRIMEIRO_PASSO_FECHADO').length;
            const protocolosPendentesTe = (protocolosData || [])
              .filter(p => p.status === 'SINCRONIZADO').length;

            const { data: tesData } = await supabase
              .from('transferencias_embrioes')
              .select('receptora_id')
              .in('receptora_id', receptoraIds)
              .eq('status_te', 'REALIZADA');

            const teReceptoraIds = Array.from(new Set((tesData || []).map(t => t.receptora_id)));
            const dgQueryIds = teReceptoraIds.length > 0 ? teReceptoraIds : ['00000000-0000-0000-0000-000000000000'];
            const { data: diagnosticosData } = await supabase
              .from('diagnosticos_gestacao')
              .select('receptora_id, tipo_diagnostico')
              .in('receptora_id', dgQueryIds)
              .in('tipo_diagnostico', ['DG', 'SEXAGEM']);

            const dgSet = new Set((diagnosticosData || [])
              .filter(d => d.tipo_diagnostico === 'DG')
              .map(d => d.receptora_id));
            const sexagemSet = new Set((diagnosticosData || [])
              .filter(d => d.tipo_diagnostico === 'SEXAGEM')
              .map(d => d.receptora_id));

            const dgPendente = teReceptoraIds.filter(id => !dgSet.has(id)).length;
            const prenhesComDg = (receptorasData || [])
              .filter(r => (r.status_reprodutivo || '').includes('PRENHE') && dgSet.has(r.id))
              .map(r => r.id);
            const sexagemPendente = prenhesComDg.filter(id => !sexagemSet.has(id)).length;

            const prenhes = (receptorasData || [])
              .filter(r => (r.status_reprodutivo || '').includes('PRENHE') && r.data_provavel_parto)
              .map(r => r.data_provavel_parto as string)
              .sort((a, b) => a.localeCompare(b));
            const prenhesDataMaisProxima = prenhes.length > 0 ? prenhes[0] : undefined;
            const prenhesNaDataMaisProxima = prenhesDataMaisProxima
              ? prenhes.filter(d => d === prenhesDataMaisProxima).length
              : 0;

            setPendencias({
              passo2Pendente: protocolosPendentesPasso2,
              tePendente: protocolosPendentesTe,
              dgPendente,
              sexagemPendente,
              prenhesTotal: prenhes.length,
              prenhesDataMaisProxima,
              prenhesNaDataMaisProxima,
            });
          }
        } else {
          setReceptorasFazenda([]);
          setReceptoraStats({ total: 0, porStatus: [] });
          setPendencias({
            passo2Pendente: 0,
            tePendente: 0,
            dgPendente: 0,
            sexagemPendente: 0,
            prenhesTotal: 0,
            prenhesDataMaisProxima: undefined,
            prenhesNaDataMaisProxima: 0,
          });
        }
      }

      // Load doadoras
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', id)
        .order('registro', { ascending: true });

      if (doadorasError) throw doadorasError;
      setDoadoras(doadorasData || []);

      const doadorasMap = new Map<string, number>();
      (doadorasData || []).forEach((d) => {
        const raca = d.raca || 'SEM_RACA';
        doadorasMap.set(raca, (doadorasMap.get(raca) || 0) + 1);
      });

      const dataLimite30 = new Date();
      dataLimite30.setDate(dataLimite30.getDate() - 30);
      const { data: aspiracoesData } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, total_oocitos, data_aspiracao')
        .eq('fazenda_id', id)
        .gte('data_aspiracao', dataLimite30.toISOString().split('T')[0]);

      const aspiracoes30d = aspiracoesData?.length || 0;
      const oocitos30d = (aspiracoesData || []).reduce((sum, a) => sum + (a.total_oocitos || 0), 0);
      const mediaOocitos = aspiracoes30d > 0 ? Math.round((oocitos30d / aspiracoes30d) * 10) / 10 : 0;

      setDoadoraStats({
        total: doadorasData?.length || 0,
        porRaca: Array.from(doadorasMap.entries())
          .map(([raca, total]) => ({ raca, total }))
          .sort((a, b) => b.total - a.total),
        oocitos30d,
        aspiracoes30d,
        mediaOocitos,
      });

      const { data: animaisData } = await supabase
        .from('animais')
        .select('id, embriao_id, receptora_id, data_nascimento, sexo, raca, pai_nome, mae_nome, created_at')
        .eq('fazenda_id', id)
        .order('created_at', { ascending: false })
        .limit(200);

      const receptoraIdsAnimais = Array.from(new Set((animaisData || [])
        .map(a => a.receptora_id)
        .filter((rid): rid is string => !!rid)));
      const embriaoIdsAnimais = Array.from(new Set((animaisData || [])
        .map(a => a.embriao_id)
        .filter((eid): eid is string => !!eid)));

      const { data: receptorasAnimaisData } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome')
        .in('id', receptoraIdsAnimais.length > 0 ? receptoraIdsAnimais : ['00000000-0000-0000-0000-000000000000']);
      const receptoraMap = new Map((receptorasAnimaisData || []).map(r => [r.id, r]));

      const { data: embrioesAnimaisData } = await supabase
        .from('embrioes')
        .select('id, identificacao, lote_fiv_acasalamento_id')
        .in('id', embriaoIdsAnimais.length > 0 ? embriaoIdsAnimais : ['00000000-0000-0000-0000-000000000000']);
      const embriaoMap = new Map((embrioesAnimaisData || []).map(e => [e.id, e]));

      const acasalamentoIds = Array.from(new Set((embrioesAnimaisData || [])
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((aid): aid is string => !!aid)));
      const { data: acasalamentosData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIds.length > 0 ? acasalamentoIds : ['00000000-0000-0000-0000-000000000000']);
      const acasalamentoMap = new Map((acasalamentosData || []).map(a => [a.id, a]));

      const aspiracaoIds = Array.from(new Set((acasalamentosData || [])
        .map(a => a.aspiracao_doadora_id)
        .filter((aid): aid is string => !!aid)));
      const doseIds = Array.from(new Set((acasalamentosData || [])
        .map(a => a.dose_semen_id)
        .filter((did): did is string => !!did)));

      const { data: aspiracoesAnimaisData } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id')
        .in('id', aspiracaoIds.length > 0 ? aspiracaoIds : ['00000000-0000-0000-0000-000000000000']);
      const aspiracaoMap = new Map((aspiracoesAnimaisData || []).map(a => [a.id, a.doadora_id]));

      const doadoraIds = Array.from(new Set((aspiracoesAnimaisData || [])
        .map(a => a.doadora_id)
        .filter((did): did is string => !!did)));
      const { data: doadorasAnimaisData } = await supabase
        .from('doadoras')
        .select('id, registro, nome')
        .in('id', doadoraIds.length > 0 ? doadoraIds : ['00000000-0000-0000-0000-000000000000']);
      const doadoraMap = new Map((doadorasAnimaisData || []).map(d => [d.id, d]));

      const { data: dosesData } = await supabase
        .from('doses_semen')
        .select('id, touro:touros(id, nome, registro)')
        .in('id', doseIds.length > 0 ? doseIds : ['00000000-0000-0000-0000-000000000000']);
      const doseMap = new Map((dosesData || []).map(d => [d.id, d]));

      const animaisFormatados: AnimalNascido[] = (animaisData || []).map((a) => {
        const receptora = a.receptora_id ? receptoraMap.get(a.receptora_id) : null;
        const embriao = a.embriao_id ? embriaoMap.get(a.embriao_id) : null;
        const acasalamento = embriao?.lote_fiv_acasalamento_id ? acasalamentoMap.get(embriao.lote_fiv_acasalamento_id) : null;
        const doadoraId = acasalamento?.aspiracao_doadora_id ? aspiracaoMap.get(acasalamento.aspiracao_doadora_id) : null;
        const doadora = doadoraId ? doadoraMap.get(doadoraId) : null;
        const dose = acasalamento?.dose_semen_id ? doseMap.get(acasalamento.dose_semen_id) as DoseComTouroQuery | undefined : null;
        const touroRaw = dose?.touro;
        const touro = Array.isArray(touroRaw) ? touroRaw[0] : touroRaw;
        const doadoraLabel = doadora ? `${doadora.registro || ''}${doadora.nome ? ` - ${doadora.nome}` : ''}`.trim() : (a.mae_nome || null);
        const touroLabel = touro?.nome || a.pai_nome || null;

        return {
          id: a.id,
          data_nascimento: a.data_nascimento,
          sexo: a.sexo,
          raca: a.raca,
          receptora_id: a.receptora_id,
          receptora_brinco: receptora?.identificacao,
          receptora_nome: receptora?.nome,
          embriao_id: a.embriao_id,
          embriao_identificacao: embriao?.identificacao || null,
          doadora: doadoraLabel || null,
          touro: touroLabel || null,
        };
      });

      setAnimaisNascidos(animaisFormatados);

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

  const handleNavigate = () => {
    if (!fazenda) return;

    if (fazenda.latitude && fazenda.longitude) {
      // Abre Google Maps com as coordenadas (funciona em qualquer dispositivo)
      const mapsUrl = getGoogleMapsUrl(fazenda.latitude, fazenda.longitude);
      window.open(mapsUrl, '_blank');
    } else if (fazenda.localizacao) {
      // Fallback para busca por endereço
      const mapsUrl = getGoogleMapsSearchUrl(fazenda.localizacao);
      window.open(mapsUrl, '_blank');
    }
  };

  const hasLocation = () => {
    if (!fazenda) return false;
    return (fazenda.latitude && fazenda.longitude) || fazenda.localizacao;
  };

  const formatDateBR = (date?: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!fazenda) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Fazenda não encontrada"
          description="Volte para a lista e selecione outra fazenda."
          action={(
            <Button onClick={() => navigate('/fazendas')} variant="outline">
              Voltar para Fazendas
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={fazenda.nome}
        description={`Cliente: ${clienteNome}`}
        actions={(
          <Button variant="outline" size="icon" onClick={() => navigate('/fazendas')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      />

      {/* Informações da Fazenda */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Fazenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Nome</p>
              <p className="text-base text-slate-900">{fazenda.nome}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Sigla</p>
              <p className="text-base text-slate-900">{fazenda.sigla || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Cliente</p>
              <p className="text-base text-slate-900">{clienteNome}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Localização</p>
              <p className="text-base text-slate-900">{fazenda.localizacao || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Coordenadas</p>
              <p className="text-base text-slate-900">
                {fazenda.latitude && fazenda.longitude
                  ? `${fazenda.latitude}, ${fazenda.longitude}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Responsável</p>
              <p className="text-base text-slate-900">{fazenda.responsavel || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Contato</p>
              <p className="text-base text-slate-900">{fazenda.contato_responsavel || '-'}</p>
            </div>
          </div>
          {hasLocation() && (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleNavigate}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navegar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="animais">Animais nascidos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          {/* Pendências */}
          <Card>
            <CardHeader>
              <CardTitle>Serviços pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">2º passo a fazer</span>
                      </div>
                      <Badge variant="outline">{pendencias.passo2Pendente}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">Protocolos com 1º passo fechado</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/protocolos')}>
                      Abrir protocolos
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Syringe className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">TE a fazer</span>
                      </div>
                      <Badge variant="outline">{pendencias.tePendente}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">Protocolos sincronizados</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/transferencia')}>
                      Abrir TE
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">DG a fazer</span>
                      </div>
                      <Badge variant="outline">{pendencias.dgPendente}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">TE realizada sem DG</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/dg')}>
                      Abrir DG
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">Sexagem a fazer</span>
                      </div>
                      <Badge variant="outline">{pendencias.sexagemPendente}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">Prenhes com DG sem sexagem</p>
                    <Button size="sm" variant="outline" onClick={() => navigate('/sexagem')}>
                      Abrir Sexagem
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-dashed md:col-span-2">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-slate-500" />
                        <span className="text-sm font-medium">Receptoras prenhes</span>
                      </div>
                      <Badge variant="outline">{pendencias.prenhesTotal}</Badge>
                    </div>
                    {!pendencias.prenhesDataMaisProxima ? (
                      <p className="text-xs text-slate-500">Nenhuma prenhe com data prevista</p>
                    ) : (
                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>Data mais próxima</span>
                          <span>{formatDateBR(pendencias.prenhesDataMaisProxima)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Receptoras nessa data</span>
                          <span>{pendencias.prenhesNaDataMaisProxima}</span>
                        </div>
                      </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => navigate('/receptoras')}>
                      Ver receptoras
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas de receptoras */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo de receptoras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-slate-200 p-4 flex items-center justify-between">
                <span className="text-sm text-slate-500">Total na fazenda</span>
                <span className="text-2xl font-semibold">{receptoraStats.total}</span>
              </div>
              {receptoraStats.porStatus.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma receptora cadastrada</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-3">
                  {receptoraStats.porStatus.map((item) => (
                    <div key={item.status} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 bg-slate-50">
                      <span className="text-sm font-medium">{formatStatusLabel(item.status)}</span>
                      <Badge variant="outline">{item.total}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo de doadoras */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo de doadoras</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Total de doadoras</p>
                  <p className="text-2xl font-semibold">{doadoraStats.total}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Oócitos (30 dias)</p>
                  <p className="text-2xl font-semibold">{doadoraStats.oocitos30d}</p>
                  <p className="text-xs text-slate-500">Média: {doadoraStats.mediaOocitos}</p>
                </div>
                <div className="rounded-md border border-slate-200 p-4">
                  <p className="text-sm text-slate-500">Aspirações (30 dias)</p>
                  <p className="text-2xl font-semibold">{doadoraStats.aspiracoes30d}</p>
                </div>
              </div>
              {doadoraStats.porRaca.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma doadora cadastrada</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {doadoraStats.porRaca.map((item) => (
                    <div key={item.raca} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-sm">{item.raca}</span>
                      <Badge variant="outline">{item.total}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="animais" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Animais nascidos</CardTitle>
            </CardHeader>
            <CardContent>
              {animaisNascidos.length === 0 ? (
                <EmptyState
                  title="Nenhum animal registrado"
                  description="Os nascimentos registrados aparecerão aqui."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Sexo</TableHead>
                      <TableHead>Raça</TableHead>
                      <TableHead>Receptora</TableHead>
                      <TableHead>Embrião</TableHead>
                      <TableHead>Acasalamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {animaisNascidos.map((animal) => (
                      <TableRow key={animal.id}>
                        <TableCell>{formatDateBR(animal.data_nascimento)}</TableCell>
                        <TableCell>{animal.sexo}</TableCell>
                        <TableCell>{animal.raca || '-'}</TableCell>
                        <TableCell>
                          {animal.receptora_brinco || '-'}
                          {animal.receptora_nome ? ` - ${animal.receptora_nome}` : ''}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {animal.embriao_identificacao || animal.embriao_id?.substring(0, 8) || '-'}
                        </TableCell>
                        <TableCell>
                          {animal.doadora || '-'} x {animal.touro || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}