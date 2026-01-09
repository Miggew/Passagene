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
import { ArrowLeft, Printer } from 'lucide-react';

interface ReceptoraComStatusFinal extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_data_inclusao?: string;
  pr_data_retirada?: string;
}

export default function ProtocoloRelatorioFechado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptorasFinal, setReceptorasFinal] = useState<ReceptoraComStatusFinal[]>([]);
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

      // Receptoras finais = todas com status final
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

      {/* Informações do Protocolo - Ordem Fixa */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1) Fazenda */}
          <div>
            <p className="text-sm font-medium text-slate-500">Fazenda</p>
            <p className="text-base text-slate-900 mt-1">{fazendaNome || '—'}</p>
          </div>
          {/* 2) Data início */}
          <div>
            <p className="text-sm font-medium text-slate-500">Data início</p>
            <p className="text-base text-slate-900 mt-1">
              {protocolo.data_inicio ? formatDate(protocolo.data_inicio) : '—'}
            </p>
          </div>
          {/* 3) Vet responsável pelo início */}
          <div>
            <p className="text-sm font-medium text-slate-500">Vet responsável pelo início</p>
            <p className="text-base text-slate-900 mt-1">
              {parseResponsavelInicio(protocolo.responsavel_inicio).veterinario || '—'}
            </p>
          </div>
          {/* 4) Tec responsável pelo início */}
          <div>
            <p className="text-sm font-medium text-slate-500">Tec responsável pelo início</p>
            <p className="text-base text-slate-900 mt-1">
              {parseResponsavelInicio(protocolo.responsavel_inicio).tecnico || '—'}
            </p>
          </div>
          {/* 5) Data segundo passo */}
          <div>
            <p className="text-sm font-medium text-slate-500">Data segundo passo</p>
            <p className="text-base text-slate-900 mt-1">
              {protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '—'}
            </p>
          </div>
          {/* 6) Responsável pelo segundo passo */}
          <div>
            <p className="text-sm font-medium text-slate-500">Responsável pelo segundo passo</p>
            <p className="text-base text-slate-900 mt-1">
              {protocolo.passo2_tecnico_responsavel || '—'}
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

      {/* Receptoras e Resultado Final */}
      <Card>
        <CardHeader>
          <CardTitle>Receptoras e Resultado Final</CardTitle>
        </CardHeader>
        <CardContent>
          {receptorasFinal.length === 0 ? (
            <p className="text-slate-500 text-center py-4">Nenhuma receptora no protocolo</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Resultado Final</TableHead>
                  <TableHead>Motivo do Descarte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptorasFinal.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.identificacao}
                      {r.nome ? ` - ${r.nome}` : ''}
                    </TableCell>
                    <TableCell>{getStatusBadge(r.pr_status)}</TableCell>
                    <TableCell>{r.pr_motivo_inapta || '—'}</TableCell>
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
