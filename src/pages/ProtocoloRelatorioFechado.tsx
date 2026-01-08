import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora, ProtocoloReceptora } from '@/lib/types';
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
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Printer, Calendar, User, Home, CheckCircle, XCircle } from 'lucide-react';

interface ReceptoraComStatusFinal extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_data_inclusao?: string;
  pr_data_retirada?: string;
}

interface TimelineEvent {
  tipo: string;
  data: string;
  descricao: string;
  detalhes?: string;
}

export default function ProtocoloRelatorioFechado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptorasIniciaram, setReceptorasIniciaram] = useState<ReceptoraComStatusFinal[]>([]);
  const [receptorasFinal, setReceptorasFinal] = useState<ReceptoraComStatusFinal[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [resumo, setResumo] = useState({
    totalIniciaram: 0,
    totalConcluiram: 0,
    totalDescartadas: 0,
    totalConfirmadas: 0,
  });

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

      // Verificar se protocolo está fechado
      if (protocoloData.status !== 'PASSO2_FECHADO') {
        navigate('/protocolos');
        return;
      }

      setProtocolo(protocoloData);

      // Load fazenda nome
      const { data: fazendaData, error: fazendaError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', protocoloData.fazenda_id)
        .single();

      if (fazendaError) throw fazendaError;
      setFazendaNome(fazendaData.nome);

      // Load receptoras do protocolo
      await loadReceptoras(protocoloData);

      // Build timeline
      buildTimeline(protocoloData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
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
          console.error('Erro ao carregar receptora:', receptoraError);
          continue;
        }

        receptorasComStatus.push({
          ...receptoraData,
          pr_id: pr.id,
          pr_status: pr.status,
          pr_motivo_inapta: pr.motivo_inapta,
          pr_data_inclusao: pr.data_inclusao,
          pr_data_retirada: pr.data_retirada,
        });
      }

      // Receptoras que iniciaram = todas que foram adicionadas
      setReceptorasIniciaram(receptorasComStatus);

      // Receptoras finais = todas (mesmo conjunto, mas com status final)
      setReceptorasFinal(receptorasComStatus);

      // Calcular resumo
      const totalIniciaram = receptorasComStatus.length;
      const totalConfirmadas = receptorasComStatus.filter(r => r.pr_status === 'APTA').length;
      const totalDescartadas = receptorasComStatus.filter(r => r.pr_status === 'INAPTA').length;
      const totalConcluiram = totalConfirmadas; // Confirmadas = concluíram

      setResumo({
        totalIniciaram,
        totalConcluiram,
        totalDescartadas,
        totalConfirmadas,
      });
    } catch (error) {
      console.error('Erro ao carregar receptoras:', error);
    }
  };

  const buildTimeline = (protocolo: ProtocoloSincronizacao) => {
    const events: TimelineEvent[] = [];

    // Protocolo criado
    if (protocolo.created_at) {
      events.push({
        tipo: 'CRIACAO',
        data: protocolo.created_at,
        descricao: 'Protocolo criado',
        detalhes: `Responsável: ${protocolo.responsavel_inicio}`,
      });
    }

    // Data início
    if (protocolo.data_inicio) {
      events.push({
        tipo: 'INICIO',
        data: protocolo.data_inicio,
        descricao: '1º Passo iniciado',
        detalhes: `Data: ${formatDate(protocolo.data_inicio)}`,
      });
    }

    // Passo 2 iniciado
    if (protocolo.passo2_data) {
      events.push({
        tipo: 'PASSO2',
        data: protocolo.passo2_data,
        descricao: '2º Passo realizado',
        detalhes: protocolo.passo2_tecnico_responsavel
          ? `Técnico: ${protocolo.passo2_tecnico_responsavel}`
          : undefined,
      });
    }

    // Protocolo fechado
    if (protocolo.data_retirada) {
      events.push({
        tipo: 'FECHAMENTO',
        data: protocolo.data_retirada,
        descricao: 'Protocolo fechado',
        detalhes: protocolo.responsavel_retirada
          ? `Responsável: ${protocolo.responsavel_retirada}`
          : undefined,
      });
    }

    // Ordenar por data
    events.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

    setTimeline(events);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APTA') {
      return <Badge variant="default" className="bg-green-600">Confirmada</Badge>;
    }
    if (status === 'INAPTA') {
      return <Badge variant="destructive">Descartada</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!protocolo) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Protocolo não encontrado</p>
        <Button onClick={() => navigate('/protocolos')} className="mt-4">
          Voltar para Protocolos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header com botões */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/protocolos')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Relatório do Protocolo</h1>
            <p className="text-slate-600 mt-1">Visualização somente leitura</p>
          </div>
        </div>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Home className="w-4 h-4" />
              Fazenda
            </p>
            <p className="text-base text-slate-900 mt-1">{fazendaNome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data Início
            </p>
            <p className="text-base text-slate-900 mt-1">{formatDate(protocolo.data_inicio)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data 2º Passo
            </p>
            <p className="text-base text-slate-900 mt-1">
              {protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <User className="w-4 h-4" />
              Técnico 2º Passo
            </p>
            <p className="text-base text-slate-900 mt-1">
              {protocolo.passo2_tecnico_responsavel || '-'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Iniciaram</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{resumo.totalIniciaram}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{resumo.totalConfirmadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Descartadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{resumo.totalDescartadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {resumo.totalIniciaram > 0
                ? Math.round((resumo.totalConfirmadas / resumo.totalIniciaram) * 100)
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-slate-500 text-center py-4">
                Nenhum evento registrado na timeline
              </p>
            ) : (
              timeline.map((event, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-slate-200 min-h-[40px]"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-semibold text-slate-900">{event.descricao}</p>
                    <p className="text-sm text-slate-600">{formatDate(event.data)}</p>
                    {event.detalhes && (
                      <p className="text-sm text-slate-500 mt-1">{event.detalhes}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Receptoras que Iniciaram */}
      <Card>
        <CardHeader>
          <CardTitle>Receptoras que Iniciaram o Protocolo ({receptorasIniciaram.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {receptorasIniciaram.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma receptora iniciou este protocolo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data Inclusão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptorasIniciaram.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>{r.pr_data_inclusao ? formatDate(r.pr_data_inclusao) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resultado Final */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado Final das Receptoras</CardTitle>
        </CardHeader>
        <CardContent>
          {receptorasFinal.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma receptora no protocolo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status Final</TableHead>
                  <TableHead>Motivo (se descartada)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptorasFinal.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>{getStatusBadge(r.pr_status)}</TableCell>
                    <TableCell>{r.pr_motivo_inapta || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Observações */}
      {protocolo.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 whitespace-pre-wrap">{protocolo.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
