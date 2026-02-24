import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { formatStatusLabel } from '@/lib/statusLabels';
import { todayISO as getTodayDateString, addDays } from '@/lib/dateUtils';
import { getGoogleMapsUrl, getGoogleMapsSearchUrl } from '@/lib/coordinates';
import type { Fazenda } from '@/lib/types';
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
import {
  ArrowLeft,
  Navigation,
  Calendar,
  Syringe,
  Activity,
  Baby,
  Beef,
  MapPin,
  User,
  Phone,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { FazendaReceptorasTab } from '@/components/fazenda/FazendaReceptorasTab';
import { FazendaDoadorasTab } from '@/components/fazenda/FazendaDoadorasTab';

interface PendenciasResumo {
  passo2Pendente: number;
  tePendente: number;
  dgPendente: number;
  sexagemPendente: number;
  prenhesTotal: number;
  prenhesProximoParto?: string;
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
}

interface AnimalNascido {
  id: string;
  data_nascimento: string;
  sexo: string;
  raca?: string | null;
  receptora_brinco?: string;
  doadora?: string | null;
  touro?: string | null;
}

export default function FazendaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [pendencias, setPendencias] = useState<PendenciasResumo>({
    passo2Pendente: 0,
    tePendente: 0,
    dgPendente: 0,
    sexagemPendente: 0,
    prenhesTotal: 0,
  });
  const [receptoraStats, setReceptoraStats] = useState<ReceptoraStats>({ total: 0, porStatus: [] });
  const [doadoraStats, setDoadoraStats] = useState<DoadoraStats>({ total: 0, porRaca: [], oocitos30d: 0, aspiracoes30d: 0 });
  const [animaisNascidos, setAnimaisNascidos] = useState<AnimalNascido[]>([]);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Carregar fazenda e cliente em paralelo
      const [fazendaResult, receptorasViewResult] = await Promise.all([
        supabase.from('fazendas').select('*, cliente:clientes(nome)').eq('id', id).single(),
        supabase.from('receptoras').select('id').eq('fazenda_atual_id', id),
      ]);

      if (fazendaResult.error) throw fazendaResult.error;

      const fazendaData = fazendaResult.data;
      setFazenda(fazendaData);
      setClienteNome((fazendaData.cliente as { nome: string } | null)?.nome || '');

      const receptoraIds = (receptorasViewResult.data || []).map(r => r.id);
      const receptorasDaFazenda = new Set(receptoraIds);

      // 2. Carregar dados em paralelo
      const [
        protocolosResult,
        receptorasResult,
        doadorasResult,
        aspiracoesResult,
        animaisResult,
      ] = await Promise.all([
        // Protocolos
        supabase
          .from('protocolos_sincronizacao')
          .select('id, status')
          .eq('fazenda_id', id)
          .in('status', ['PASSO1_FECHADO', 'SINCRONIZADO']),

        // Receptoras
        receptoraIds.length > 0
          ? supabase
            .from('receptoras')
            .select('id, status_reprodutivo, data_provavel_parto')
            .in('id', receptoraIds)
          : Promise.resolve({ data: [], error: null }),

        // Doadoras
        supabase
          .from('doadoras')
          .select('id, raca')
          .eq('fazenda_id', id),

        // Aspirações (30 dias)
        supabase
          .from('aspiracoes_doadoras')
          .select('id, total_oocitos')
          .eq('fazenda_id', id)
          .gte('data_aspiracao', addDays(getTodayDateString(), -30)),

        // Animais nascidos (últimos 50)
        supabase
          .from('animais')
          .select(`
            id, data_nascimento, sexo, raca, pai_nome, mae_nome,
            receptora:receptoras(identificacao),
            embriao:embrioes(
              lote_fiv_acasalamento:lote_fiv_acasalamentos(
                aspiracao:aspiracoes_doadoras(doadora:doadoras(registro)),
                dose:doses_semen(touro:touros(nome))
              )
            )
          `)
          .eq('fazenda_id', id)
          .order('data_nascimento', { ascending: false })
          .limit(50),
      ]);

      // Processar protocolos
      const protocolos = protocolosResult.data || [];
      const passo2Pendente = protocolos.filter(p =>
        p.status === 'PASSO1_FECHADO'
      ).length;
      const tePendente = protocolos.filter(p => p.status === 'SINCRONIZADO').length;

      // Processar receptoras
      const receptoras = receptorasResult.data || [];
      const statusMap = new Map<string, number>();
      let prenhesTotal = 0;
      let prenhesProximoParto: string | undefined;

      receptoras.forEach(r => {
        const status = r.status_reprodutivo || 'VAZIA';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);

        if (status.includes('PRENHE')) {
          prenhesTotal++;
          if (r.data_provavel_parto) {
            if (!prenhesProximoParto || r.data_provavel_parto < prenhesProximoParto) {
              prenhesProximoParto = r.data_provavel_parto;
            }
          }
        }
      });

      setReceptoraStats({
        total: receptoras.length,
        porStatus: Array.from(statusMap.entries())
          .map(([status, total]) => ({ status, total }))
          .sort((a, b) => b.total - a.total),
      });

      // Calcular DG e Sexagem pendentes
      let dgPendente = 0;
      let sexagemPendente = 0;

      if (receptoraIds.length > 0) {
        const [tesResult, dgsResult] = await Promise.all([
          supabase
            .from('transferencias_embrioes')
            .select('receptora_id')
            .in('receptora_id', receptoraIds)
            .eq('status_te', 'REALIZADA'),
          supabase
            .from('diagnosticos_gestacao')
            .select('receptora_id, tipo_diagnostico')
            .in('receptora_id', receptoraIds),
        ]);

        const teReceptoraIds = new Set((tesResult.data || []).map(t => t.receptora_id));
        const dgSet = new Set((dgsResult.data || []).filter(d => d.tipo_diagnostico === 'DG').map(d => d.receptora_id));
        const sexagemSet = new Set((dgsResult.data || []).filter(d => d.tipo_diagnostico === 'SEXAGEM').map(d => d.receptora_id));

        dgPendente = [...teReceptoraIds].filter(id => !dgSet.has(id)).length;

        const prenhesComDg = receptoras.filter(r =>
          (r.status_reprodutivo || '').includes('PRENHE') && dgSet.has(r.id)
        );
        sexagemPendente = prenhesComDg.filter(r => !sexagemSet.has(r.id)).length;
      }

      setPendencias({
        passo2Pendente,
        tePendente,
        dgPendente,
        sexagemPendente,
        prenhesTotal,
        prenhesProximoParto,
      });

      // Processar doadoras
      const doadoras = doadorasResult.data || [];
      const racaMap = new Map<string, number>();
      doadoras.forEach(d => {
        const raca = d.raca || 'Sem raça';
        racaMap.set(raca, (racaMap.get(raca) || 0) + 1);
      });

      const aspiracoes = aspiracoesResult.data || [];
      const oocitos30d = aspiracoes.reduce((sum, a) => sum + (a.total_oocitos || 0), 0);

      setDoadoraStats({
        total: doadoras.length,
        porRaca: Array.from(racaMap.entries())
          .map(([raca, total]) => ({ raca, total }))
          .sort((a, b) => b.total - a.total),
        oocitos30d,
        aspiracoes30d: aspiracoes.length,
      });

      // Processar animais
      const animais = (animaisResult.data || []).map((a: any) => {
        const acasalamento = a.embriao?.lote_fiv_acasalamento;
        const doadoraReg = acasalamento?.aspiracao?.doadora?.registro;
        const touroNome = acasalamento?.dose?.touro?.nome;

        return {
          id: a.id,
          data_nascimento: a.data_nascimento,
          sexo: a.sexo,
          raca: a.raca,
          receptora_brinco: a.receptora?.identificacao,
          doadora: doadoraReg || a.mae_nome || null,
          touro: touroNome || a.pai_nome || null,
        };
      });

      setAnimaisNascidos(animais);

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
      window.open(getGoogleMapsUrl(fazenda.latitude, fazenda.longitude), '_blank');
    } else if (fazenda.localizacao) {
      window.open(getGoogleMapsSearchUrl(fazenda.localizacao), '_blank');
    }
  };

  const formatDate = (date?: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const totalPendencias = pendencias.passo2Pendente + pendencias.tePendente + pendencias.dgPendente + pendencias.sexagemPendente;

  if (loading) return <LoadingSpinner />;

  if (!fazenda) {
    return (
      <EmptyState
        title="Fazenda não encontrada"
        description="Volte para a lista e selecione outra fazenda."
        action={<Button onClick={() => navigate('/fazendas')} variant="outline">Voltar</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={fazenda.nome}
        description={`Cliente: ${clienteNome}`}
        actions={
          <Button variant="outline" size="icon" onClick={() => navigate('/fazendas')} aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        }
      />

      {/* Info compacta da fazenda */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {fazenda.sigla && (
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sigla</p>
                <p className="font-semibold">{fazenda.sigla}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {fazenda.localizacao && (
          <Card className="cursor-pointer hover:bg-secondary" onClick={handleNavigate}>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Localização</p>
                <p className="font-medium truncate">{fazenda.localizacao}</p>
              </div>
              <Navigation className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        )}
        {fazenda.responsavel && (
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="font-medium">{fazenda.responsavel}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {fazenda.contato_responsavel && (
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Phone className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contato</p>
                <p className="font-medium">{fazenda.contato_responsavel}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
          <TabsTrigger value="resumo" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Activity className="w-4 h-4" />
            Resumo
            {totalPendencias > 0 && (
              <Badge variant="destructive" className="ml-0.5 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {totalPendencias}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="receptoras" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Beef className="w-4 h-4" />
            <span className="hidden md:inline">Receptoras</span>
            <span className="md:hidden">Recep.</span>
            <Badge variant="secondary" className="ml-0.5">{receptoraStats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="doadoras" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Dna className="w-4 h-4" />
            Doadoras
            <Badge variant="secondary" className="ml-0.5">{doadoraStats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="animais" className="flex items-center gap-1.5 text-xs md:text-sm">
            <Baby className="w-4 h-4" />
            <span className="hidden md:inline">Nascimentos</span>
            <span className="md:hidden">Nasc.</span>
            <Badge variant="secondary" className="ml-0.5">{animaisNascidos.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Aba Resumo */}
        <TabsContent value="resumo" className="space-y-4">
          {/* Pendências */}
          {totalPendencias > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-4 h-4" />
                  Serviços Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {pendencias.passo2Pendente > 0 && (
                    <Link to="/protocolos" className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-green-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">2º Passo</span>
                      </div>
                      <Badge>{pendencias.passo2Pendente}</Badge>
                    </Link>
                  )}
                  {pendencias.tePendente > 0 && (
                    <Link to="/transferencia" className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-green-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Syringe className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">TE</span>
                      </div>
                      <Badge>{pendencias.tePendente}</Badge>
                    </Link>
                  )}
                  {pendencias.dgPendente > 0 && (
                    <Link to="/dg" className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-green-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">DG</span>
                      </div>
                      <Badge>{pendencias.dgPendente}</Badge>
                    </Link>
                  )}
                  {pendencias.sexagemPendente > 0 && (
                    <Link to="/sexagem" className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-green-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <Baby className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Sexagem</span>
                      </div>
                      <Badge>{pendencias.sexagemPendente}</Badge>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Receptoras */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Beef className="w-4 h-4" />
                    Receptoras
                  </span>
                  <span className="text-2xl font-bold">{receptoraStats.total}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receptoraStats.porStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma receptora</p>
                ) : (
                  <div className="space-y-2">
                    {receptoraStats.porStatus.slice(0, 5).map(item => (
                      <div key={item.status} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{formatStatusLabel(item.status)}</span>
                        <Badge variant="outline">{item.total}</Badge>
                      </div>
                    ))}
                    {pendencias.prenhesProximoParto && (
                      <div className="pt-2 mt-2 border-t text-sm">
                        <span className="text-muted-foreground">Próximo parto: </span>
                        <span className="font-medium">{formatDate(pendencias.prenhesProximoParto)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Doadoras */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Doadoras</span>
                  <span className="text-2xl font-bold">{doadoraStats.total}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {doadoraStats.total === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma doadora</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-secondary rounded">
                        <p className="text-muted-foreground">Aspirações (30d)</p>
                        <p className="font-semibold">{doadoraStats.aspiracoes30d}</p>
                      </div>
                      <div className="p-2 bg-secondary rounded">
                        <p className="text-muted-foreground">Oócitos (30d)</p>
                        <p className="font-semibold">{doadoraStats.oocitos30d}</p>
                      </div>
                    </div>
                    {doadoraStats.porRaca.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {doadoraStats.porRaca.slice(0, 4).map(item => (
                          <Badge key={item.raca} variant="secondary" className="text-xs">
                            {item.raca}: {item.total}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aba Receptoras */}
        <TabsContent value="receptoras">
          <FazendaReceptorasTab fazendaId={id!} fazendaNome={fazenda.nome} />
        </TabsContent>

        {/* Aba Doadoras */}
        <TabsContent value="doadoras">
          <FazendaDoadorasTab fazendaId={id!} fazendaNome={fazenda.nome} />
        </TabsContent>

        {/* Aba Animais */}
        <TabsContent value="animais">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Animais Nascidos</CardTitle>
            </CardHeader>
            <CardContent>
              {animaisNascidos.length === 0 ? (
                <EmptyState
                  title="Nenhum animal registrado"
                  description="Os nascimentos registrados aparecerão aqui."
                />
              ) : (
                <>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {animaisNascidos.map(animal => (
                      <div key={animal.id} className="rounded-xl border border-border/60 glass-panel shadow-sm p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{formatDate(animal.data_nascimento)}</span>
                          <Badge variant={animal.sexo === 'FEMEA' ? 'default' : 'secondary'}>
                            {animal.sexo === 'FEMEA' ? 'Fêmea' : animal.sexo === 'MACHO' ? 'Macho' : '?'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                          {animal.raca && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase">Raça</span>
                              <span className="block text-foreground">{animal.raca}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase">Receptora</span>
                            <span className="block text-foreground">{animal.receptora_brinco || '-'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-muted-foreground uppercase">Doadora x Touro</span>
                            <span className="block text-foreground">{animal.doadora || '?'} x {animal.touro || '?'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Sexo</TableHead>
                          <TableHead>Raça</TableHead>
                          <TableHead>Receptora</TableHead>
                          <TableHead>Doadora x Touro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {animaisNascidos.map(animal => (
                          <TableRow key={animal.id}>
                            <TableCell>{formatDate(animal.data_nascimento)}</TableCell>
                            <TableCell>
                              <Badge variant={animal.sexo === 'FEMEA' ? 'default' : 'secondary'}>
                                {animal.sexo === 'FEMEA' ? 'F' : animal.sexo === 'MACHO' ? 'M' : '?'}
                              </Badge>
                            </TableCell>
                            <TableCell>{animal.raca || '-'}</TableCell>
                            <TableCell>{animal.receptora_brinco || '-'}</TableCell>
                            <TableCell className="text-sm">
                              {animal.doadora || '?'} x {animal.touro || '?'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
