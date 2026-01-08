import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora } from '@/lib/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';

interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
}

export default function ProtocoloPasso2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptoras, setReceptoras] = useState<ReceptoraWithStatus[]>([]);
  
  // Dialog states
  const [showMarcarStatus, setShowMarcarStatus] = useState(false);
  const [showResumoPasso2, setShowResumoPasso2] = useState(false);
  const [selectedReceptoraId, setSelectedReceptoraId] = useState('');
  const [selectedReceptoraBrinco, setSelectedReceptoraBrinco] = useState('');
  
  // Form states
  const [statusForm, setStatusForm] = useState({
    status: 'CONFIRMADA',
    motivo_inapta: '',
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

      if (protocoloData.status !== 'PASSO1_FECHADO' && protocoloData.status !== 'PRIMEIRO_PASSO_FECHADO') {
        toast({
          title: 'Erro',
          description: 'Este protocolo não está aguardando o 2º passo',
          variant: 'destructive',
        });
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

      // Load receptoras in this protocol
      await loadReceptoras();
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

  const loadReceptoras = async () => {
    try {
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('*')
        .eq('protocolo_id', id);

      if (prError) throw prError;

      const receptorasWithStatus: ReceptoraWithStatus[] = [];

      for (const pr of prData || []) {
        const { data: receptoraData, error: receptoraError } = await supabase
          .from('receptoras')
          .select('*')
          .eq('id', pr.receptora_id)
          .single();

        if (receptoraError) {
          console.error('Error loading receptora:', receptoraError);
          continue;
        }

        receptorasWithStatus.push({
          ...receptoraData,
          pr_id: pr.id,
          pr_status: pr.status,
          pr_motivo_inapta: pr.motivo_inapta,
          pr_observacoes: pr.observacoes,
        });
      }

      setReceptoras(receptorasWithStatus);
    } catch (error) {
      console.error('Error loading receptoras:', error);
    }
  };

  const handleMarcarStatus = async () => {
    try {
      const updateData: Record<string, string | null> = {
        status: statusForm.status === 'CONFIRMADA' ? 'APTA' : 'INAPTA',
      };

      if (statusForm.status === 'CONFIRMADA') {
        updateData.motivo_inapta = null;
      } else {
        // Motivo agora é opcional - pode ser vazio/null
        updateData.motivo_inapta = statusForm.motivo_inapta.trim() || null;
      }

      setSubmitting(true);

      const { error } = await supabase
        .from('protocolo_receptoras')
        .update(updateData)
        .eq('protocolo_id', id)
        .eq('receptora_id', selectedReceptoraId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: 'Status da receptora atualizado com sucesso',
      });

      setShowMarcarStatus(false);
      setStatusForm({ status: 'CONFIRMADA', motivo_inapta: '' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizarPasso2 = async () => {
    const pendentes = receptoras.filter(r => r.pr_status === 'INICIADA');
    
    if (pendentes.length > 0) {
      toast({
        title: 'Erro',
        description: `Ainda há ${pendentes.length} receptora(s) pendente(s) de revisão`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Update protocol status to PASSO2_FECHADO
      // Usar data atual como string YYYY-MM-DD (sem conversão de timezone)
      const hoje = new Date();
      const dataRetirada = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      
      const { error } = await supabase
        .from('protocolos_sincronizacao')
        .update({ 
          status: 'PASSO2_FECHADO',
          data_retirada: dataRetirada,
          responsavel_retirada: protocolo?.responsavel_inicio || null,
        })
        .eq('id', id);

      if (error) throw error;

      // Reload data
      await loadData();

      // Show summary modal
      setShowResumoPasso2(true);
    } catch (error) {
      toast({
        title: 'Erro ao finalizar 2º passo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseResumoPasso2 = () => {
    setShowResumoPasso2(false);
    toast({
      title: '2º passo concluído com sucesso',
      description: `${receptoras.filter(r => r.pr_status === 'APTA').length} receptoras confirmadas para TE`,
    });
    navigate('/protocolos');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'INICIADA': { label: 'Aguardando Revisão', variant: 'secondary' },
      'APTA': { label: 'Confirmada', variant: 'default' },
      'INAPTA': { label: 'Descartada', variant: 'destructive' },
    };

    const config = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  const receptorasPendentes = receptoras.filter(r => r.pr_status === 'INICIADA');
  const receptorasConfirmadas = receptoras.filter(r => r.pr_status === 'APTA');
  const receptorasDescartadas = receptoras.filter(r => r.pr_status === 'INAPTA');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/protocolos')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">2º Passo - {fazendaNome}</h1>
            <p className="text-slate-600 mt-1">Revisar e confirmar receptoras</p>
          </div>
        </div>
        <Button 
          onClick={handleFinalizarPasso2}
          disabled={receptorasPendentes.length > 0 || submitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Lock className="w-4 h-4 mr-2" />
          {submitting ? 'Finalizando...' : 'Finalizar 2º Passo'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Fazenda</p>
            <p className="text-base text-slate-900">{fazendaNome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Data Início</p>
            <p className="text-base text-slate-900">
              {formatDate(protocolo.data_inicio)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Data do 2º Passo</p>
            <p className="text-base text-slate-900">
              {protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Técnico 2º Passo</p>
            <p className="text-base text-slate-900">
              {protocolo.passo2_tecnico_responsavel || '-'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aguardando Revisão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{receptorasPendentes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Confirmadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{receptorasConfirmadas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Descartadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{receptorasDescartadas.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receptoras para Revisão ({receptoras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brinco</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    Nenhuma receptora no protocolo
                  </TableCell>
                </TableRow>
              ) : (
                receptoras.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>{getStatusBadge(r.pr_status)}</TableCell>
                    <TableCell>{r.pr_motivo_inapta || '-'}</TableCell>
                    <TableCell className="text-right">
                      {r.pr_status === 'INICIADA' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setSelectedReceptoraId(r.id);
                              setSelectedReceptoraBrinco(r.identificacao);
                              setStatusForm({ status: 'CONFIRMADA', motivo_inapta: '' });
                              setShowMarcarStatus(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirmar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedReceptoraId(r.id);
                              setSelectedReceptoraBrinco(r.identificacao);
                              setStatusForm({ status: 'DESCARTAR', motivo_inapta: '' });
                              setShowMarcarStatus(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Descartar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Marcar Status Modal */}
      <Dialog open={showMarcarStatus} onOpenChange={setShowMarcarStatus}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Status da Receptora</DialogTitle>
            <DialogDescription>
              Receptora: {selectedReceptoraBrinco}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={statusForm.status}
                onValueChange={(value) => setStatusForm({ ...statusForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMADA">Confirmada (segue para TE)</SelectItem>
                  <SelectItem value="DESCARTAR">Descartar (não segue para TE)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {statusForm.status === 'DESCARTAR' && (
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Select
                  value={statusForm.motivo_inapta || 'none'}
                  onValueChange={(value) =>
                    setStatusForm({ ...statusForm, motivo_inapta: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem motivo</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Morreu">Morreu</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Doente">Doente</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Sumiu">Sumiu</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Perdeu P4">Perdeu P4</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Não respondeu">Não respondeu</SelectItem>
                    <SelectItem value="Descartada no 2º passo: Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleMarcarStatus}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={submitting}
            >
              {submitting ? 'Atualizando...' : 'Atualizar Status'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo do 2º Passo Modal */}
      <Dialog open={showResumoPasso2} onOpenChange={setShowResumoPasso2}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Resumo do 2º Passo
            </DialogTitle>
            <DialogDescription>
              2º passo concluído com sucesso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-500">Fazenda</p>
                <p className="text-base text-slate-900">{fazendaNome}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Data do Protocolo</p>
                <p className="text-base text-slate-900">
                  {protocolo && formatDate(protocolo.data_inicio)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total de Receptoras</p>
                <p className="text-base text-slate-900 font-bold">{receptoras.length}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Confirmadas para TE</p>
                <p className="text-base text-green-600 font-bold">{receptorasConfirmadas.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-700 mb-2">Receptoras Confirmadas</p>
                <p className="text-2xl font-bold text-green-600">{receptorasConfirmadas.length}</p>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-2">Receptoras Descartadas</p>
                <p className="text-2xl font-bold text-red-600">{receptorasDescartadas.length}</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Protocolo concluído!</strong> As receptoras confirmadas (APTA) estão prontas para transferência de embriões.
              </p>
            </div>

            <Button
              onClick={handleCloseResumoPasso2}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              OK - Voltar para Protocolos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}