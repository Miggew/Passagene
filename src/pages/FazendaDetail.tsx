import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Fazenda, Doadora } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Navigation, Calendar, Beef, Dna } from 'lucide-react';

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
}

interface TransferenciaStats {
  total_ultimos_60_dias: number;
  sem_diagnostico: number;
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
      } catch (e) {
        // View doesn't exist, skip
        console.log('View v_protocolo_receptoras_status not available');
      }

      // Load transferencias stats
      // Primeiro, buscar receptoras da fazenda atual
      const { data: viewDataFazenda, error: viewErrorFazenda } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', id);

      if (viewErrorFazenda) throw viewErrorFazenda;

      const receptoraIdsNaFazenda = viewDataFazenda?.map(v => v.receptora_id) || [];

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
            .select('id, identificacao, nome, status_reprodutivo')
            .in('id', receptoraIds)
            .order('identificacao', { ascending: true });

          if (!receptorasError) {
            setReceptorasFazenda(receptorasData?.map(r => ({
              receptora_id: r.id,
              brinco: r.identificacao,
              nome: r.nome,
              status_reprodutivo: r.status_reprodutivo,
            })) || []);
          }
        } else {
          setReceptorasFazenda([]);
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

  const getMapsLink = () => {
    if (!fazenda) return null;
    if (fazenda.latitude && fazenda.longitude) {
      return `https://www.google.com/maps?q=${fazenda.latitude},${fazenda.longitude}`;
    } else if (fazenda.localizacao) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fazenda.localizacao)}`;
    }
    return null;
  };

  const getWazeLink = () => {
    if (!fazenda) return null;
    if (fazenda.latitude && fazenda.longitude) {
      return `https://waze.com/ul?ll=${fazenda.latitude},${fazenda.longitude}&navigate=yes`;
    } else if (fazenda.localizacao) {
      return getMapsLink();
    }
    return null;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!fazenda) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Fazenda não encontrada</p>
        <Button onClick={() => navigate('/fazendas')} className="mt-4">
          Voltar para Fazendas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/fazendas')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{fazenda.nome}</h1>
          <p className="text-slate-600 mt-1">Cliente: {clienteNome}</p>
        </div>
      </div>

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
          <div className="flex gap-2 pt-2">
            {getMapsLink() && (
              <Button
                variant="outline"
                onClick={() => window.open(getMapsLink()!, '_blank')}
              >
                <MapPin className="w-4 h-4 mr-2" />
                Abrir no Google Maps
              </Button>
            )}
            {getWazeLink() && (
              <Button
                variant="outline"
                onClick={() => window.open(getWazeLink()!, '_blank')}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Abrir no Waze
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Serviços Ativos */}
      <Card>
        <CardHeader>
          <CardTitle>Serviços Ativos na Fazenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Protocolos em andamento */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Protocolos em Andamento ({protocolos.length})
            </h3>
            {protocolos.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum protocolo ativo</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Data Retirada</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocolos.map((protocolo) => (
                    <TableRow key={protocolo.id}>
                      <TableCell className="font-mono text-xs">
                        {protocolo.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        {new Date(protocolo.data_inicio).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {protocolo.data_retirada
                          ? new Date(protocolo.data_retirada).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">{protocolo.status || 'N/A'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Receptoras sincronizadas */}
          {receptorasSincronizadas.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">
                Receptoras Sincronizadas Aguardando TE ({receptorasSincronizadas.length})
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brinco</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data TE Prevista</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receptorasSincronizadas.map((receptora, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{receptora.brinco}</TableCell>
                      <TableCell>{receptora.fase_ciclo || '-'}</TableCell>
                      <TableCell>{receptora.status_efetivo || '-'}</TableCell>
                      <TableCell>
                        {receptora.data_te_prevista
                          ? new Date(receptora.data_te_prevista).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Transferências recentes */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Transferências Recentes</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-2xl font-bold text-slate-900">
                    {transferenciaStats.total_ultimos_60_dias}
                  </p>
                  <p className="text-sm text-slate-500">Últimos 60 dias</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-2xl font-bold text-orange-600">
                    {transferenciaStats.sem_diagnostico}
                  </p>
                  <p className="text-sm text-slate-500">Aguardando diagnóstico</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receptoras da Fazenda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beef className="w-5 h-5" />
            Receptoras da Fazenda ({receptorasFazenda.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receptorasFazenda.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma receptora vinculada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status Reprodutivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptorasFazenda.map((receptora) => (
                  <TableRow key={receptora.receptora_id}>
                    <TableCell className="font-medium">{receptora.brinco}</TableCell>
                    <TableCell>{receptora.nome || '-'}</TableCell>
                    <TableCell>{receptora.status_reprodutivo || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Doadoras da Fazenda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dna className="w-5 h-5" />
            Doadoras da Fazenda ({doadoras.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doadoras.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma doadora cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registro</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Raça</TableHead>
                  <TableHead>GPTA</TableHead>
                  <TableHead>Controle Leiteiro</TableHead>
                  <TableHead>Beta Caseína</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doadoras.map((doadora) => (
                  <TableRow key={doadora.id}>
                    <TableCell className="font-medium">{doadora.registro}</TableCell>
                    <TableCell>{doadora.nome || '-'}</TableCell>
                    <TableCell>{doadora.raca || '-'}</TableCell>
                    <TableCell>{doadora.gpta || '-'}</TableCell>
                    <TableCell>{doadora.controle_leiteiro || '-'}</TableCell>
                    <TableCell>{doadora.beta_caseina || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}