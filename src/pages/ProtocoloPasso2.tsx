import { useEffect, useState, useRef } from 'react';
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
import { atualizarStatusReceptora, validarTransicaoStatus, calcularStatusReceptora } from '@/lib/receptoraStatus';
import { ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';

interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
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
  const [showConfirmarDialog, setShowConfirmarDialog] = useState(false);
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showResumoPasso2, setShowResumoPasso2] = useState(false);
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [selectedReceptoraId, setSelectedReceptoraId] = useState('');
  const [selectedReceptoraBrinco, setSelectedReceptoraBrinco] = useState('');
  const [isSavingConfirmar, setIsSavingConfirmar] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  
  // Form states (apenas para descartar)
  const [descartarForm, setDescartarForm] = useState({
    motivo_inapta: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // Verificar se há mudanças pendentes
  useEffect(() => {
    const pendentes = receptoras.filter(r => r.pr_status === 'INICIADA');
    setHasPendingChanges(pendentes.length > 0 && protocolo?.status !== 'PASSO2_FECHADO');
  }, [receptoras, protocolo]);

  // Ref para controlar navegação bloqueada
  const navigationBlockedRef = useRef(false);

  // Prevenir fechar aba/janela e navegação quando há mudanças pendentes
  useEffect(() => {
    if (!hasPendingChanges) {
      navigationBlockedRef.current = false;
      return;
    }

    navigationBlockedRef.current = true;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Você tem receptoras pendentes de revisão. Tem certeza que deseja sair?';
      return e.returnValue;
    };

    // Interceptar navegação do browser (botão voltar)
    const handlePopState = (e: PopStateEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setShowCancelarDialog(true);
      }
    };

    // Adicionar estado ao histórico para poder interceptar
    window.history.pushState(null, '', window.location.href);

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasPendingChanges]);

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

      // Validar apenas se o status é inválido para esta página
      // Permitir PASSO2_FECHADO pois pode ser visto após finalizar (antes de redirecionar)
      if (protocoloData.status !== 'PASSO1_FECHADO' && 
          protocoloData.status !== 'PRIMEIRO_PASSO_FECHADO' && 
          protocoloData.status !== 'PASSO2_FECHADO') {
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
      if (!id) {
        console.error('ID do protocolo não fornecido');
        toast({
          title: 'Erro',
          description: 'ID do protocolo não encontrado',
          variant: 'destructive',
        });
        return;
      }

      // Buscar receptoras do protocolo
      const { data: finalPrData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('*')
        .eq('protocolo_id', id);

      if (prError) {
        console.error('Erro ao carregar receptoras do protocolo:', prError);
        console.error('Protocolo ID:', id);
        console.error('Código do erro:', prError.code);
        console.error('Mensagem do erro:', prError.message);
        console.error('Detalhes:', prError.details);
        toast({
          title: 'Erro ao carregar receptoras',
          description: prError.message || 'Erro desconhecido ao carregar receptoras do protocolo',
          variant: 'destructive',
        });
        setReceptoras([]);
        return;
      }

      // Log para debug
      console.log('=== DEBUG loadReceptoras ===');
      console.log('Protocolo ID:', id);
      console.log('Receptoras retornadas:', finalPrData?.length || 0);
      if (finalPrData && finalPrData.length > 0) {
        console.log('Primeira receptora:', {
          id: finalPrData[0].id,
          protocolo_id: finalPrData[0].protocolo_id,
          receptora_id: finalPrData[0].receptora_id,
          status: finalPrData[0].status,
        });
      } else {
        console.warn('Nenhuma receptora retornada pela query');
      }

      // CRITICAL: Validar que há pelo menos 1 receptora vinculada
      if (!finalPrData || finalPrData.length === 0) {
        console.error('Protocolo sem receptoras vinculadas - inconsistência detectada');
        console.error('Protocolo ID:', id);
        
        // Tentar contar diretamente para confirmar
        const { count, error: countError } = await supabase
          .from('protocolo_receptoras')
          .select('*', { count: 'exact', head: true })
          .eq('protocolo_id', id);
        
        console.error('Tentativa de count direto - resultado:', count);
        if (countError) {
          console.error('Erro ao fazer count:', countError);
        }
        
        toast({
          title: 'Erro: Protocolo inconsistente',
          description: `Este protocolo não possui receptoras vinculadas (ID: ${id}). Verifique no banco de dados se há receptoras vinculadas a este protocolo.`,
          variant: 'destructive',
        });
        setReceptoras([]);
        return;
      }

      const receptorasWithStatus: ReceptoraWithStatus[] = [];

      for (const pr of finalPrData) {
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
          // Tratar campos opcionalmente (podem não existir se migration não foi executada)
          // Campos novos podem não existir ainda - tratar opcionalmente
          pr_ciclando_classificacao: ('ciclando_classificacao' in pr && (pr.ciclando_classificacao === 'CL' || pr.ciclando_classificacao === 'N'))
            ? pr.ciclando_classificacao as 'N' | 'CL'
            : null,
          pr_qualidade_semaforo: ('qualidade_semaforo' in pr && typeof pr.qualidade_semaforo === 'number' && pr.qualidade_semaforo >= 1 && pr.qualidade_semaforo <= 3)
            ? pr.qualidade_semaforo as 1 | 2 | 3
            : null,
        });
      }

      setReceptoras(receptorasWithStatus);
    } catch (error) {
      console.error('Error loading receptoras:', error);
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmarReceptora = async () => {
    // Proteção contra multi-clique
    if (isSavingConfirmar || submitting) {
      return;
    }

    try {
      setIsSavingConfirmar(true);

      const { error } = await supabase
        .from('protocolo_receptoras')
        .update({
          status: 'APTA',
          motivo_inapta: null,
        })
        .eq('protocolo_id', id)
        .eq('receptora_id', selectedReceptoraId);

      if (error) {
        console.error('Erro ao confirmar receptora:', error);
        throw error;
      }

      toast({
        title: 'Receptora confirmada',
        description: `${selectedReceptoraBrinco} foi confirmada e segue para TE`,
      });

      setShowConfirmarDialog(false);
      setSelectedReceptoraId('');
      setSelectedReceptoraBrinco('');
      loadData();
    } catch (error) {
      console.error('Erro ao confirmar receptora:', error);
      toast({
        title: 'Erro ao confirmar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSavingConfirmar(false);
    }
  };

  const handleDescartarReceptora = async () => {
    // Proteção contra multi-clique
    if (submitting) {
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('protocolo_receptoras')
        .update({
          status: 'INAPTA',
          motivo_inapta: descartarForm.motivo_inapta.trim() || null,
        })
        .eq('protocolo_id', id)
        .eq('receptora_id', selectedReceptoraId);

      if (error) {
        console.error('Erro ao descartar receptora:', error);
        throw error;
      }

      toast({
        title: 'Receptora descartada',
        description: `${selectedReceptoraBrinco} foi descartada do protocolo`,
      });

      setShowDescartarDialog(false);
      setSelectedReceptoraId('');
      setSelectedReceptoraBrinco('');
      setDescartarForm({ motivo_inapta: '' });
      loadData();
    } catch (error) {
      console.error('Erro ao descartar receptora:', error);
      toast({
        title: 'Erro ao descartar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizarPasso2 = async () => {
    // Proteção contra multi-clique
    if (submitting) {
      return;
    }

    const pendentes = receptoras.filter(r => r.pr_status === 'INICIADA');
    
    if (pendentes.length > 0) {
      toast({
        title: 'Erro',
        description: `Ainda há ${pendentes.length} receptora(s) pendente(s) de revisão`,
        variant: 'destructive',
      });
      return;
    }

    // Validação: deve haver pelo menos 1 receptora (mesmo que descartada)
    if (receptoras.length === 0) {
      toast({
        title: 'Erro',
        description: 'Não é possível finalizar protocolo sem receptoras vinculadas',
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

      if (error) {
        console.error('Erro ao finalizar 2º passo:', error);
        throw error;
      }

      // Atualizar estado local (não precisa recarregar tudo)
      setProtocolo({
        ...protocolo!,
        status: 'PASSO2_FECHADO',
        data_retirada: dataRetirada,
        responsavel_retirada: protocolo?.responsavel_inicio || null,
      });

      // Atualizar status das receptoras baseado no resultado do passo 2
      // Receptoras APTA → SINCRONIZADA
      // Receptoras INAPTA → VAZIA (descartadas)
      const receptorasConfirmadas = receptoras.filter(r => r.pr_status === 'APTA');
      const receptorasDescartadas = receptoras.filter(r => r.pr_status === 'INAPTA');

      const statusUpdatePromises = [
        // Atualizar receptoras confirmadas para SINCRONIZADA
        ...receptorasConfirmadas.map(async (r) => {
          const statusAtual = await calcularStatusReceptora(r.id);
          const validacao = validarTransicaoStatus(statusAtual, 'FINALIZAR_PASSO2');
          
          if (!validacao.valido) {
            console.warn(`Não foi possível atualizar status da receptora ${r.identificacao}: ${validacao.mensagem}`);
            return;
          }

          const { error: statusError } = await atualizarStatusReceptora(r.id, 'SINCRONIZADA');
          if (statusError) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao}:`, statusError);
          }
        }),
        // Atualizar receptoras descartadas para VAZIA
        ...receptorasDescartadas.map(async (r) => {
          const { error: statusError } = await atualizarStatusReceptora(r.id, 'VAZIA');
          if (statusError) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao}:`, statusError);
          }
        }),
      ];

      // Aguardar todos os updates de status (mas não falhar se algum der erro)
      await Promise.allSettled(statusUpdatePromises);

      // Resetar mudanças pendentes
      setHasPendingChanges(false);
      navigationBlockedRef.current = false;

      // Show summary modal
      setShowResumoPasso2(true);
    } catch (error) {
      console.error('Erro ao finalizar 2º passo:', error);
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

  const handleCancelarPasso2 = async () => {
    try {
      setSubmitting(true);

      // Reverter passo2_data e passo2_tecnico_responsavel
      const { error } = await supabase
        .from('protocolos_sincronizacao')
        .update({
          passo2_data: null,
          passo2_tecnico_responsavel: null,
          status: 'PASSO1_FECHADO', // Voltar para o status anterior
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: '2º passo cancelado',
        description: 'O protocolo voltou para o status de aguardando 2º passo',
      });

      setShowCancelarDialog(false);
      setHasPendingChanges(false);
      navigationBlockedRef.current = false;
      
      navigate('/protocolos');
    } catch (error) {
      console.error('Erro ao cancelar 2º passo:', error);
      toast({
        title: 'Erro ao cancelar 2º passo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoltarClick = () => {
    // Se houver mudanças pendentes, sempre mostrar dialog de cancelamento
    if (hasPendingChanges) {
      setShowCancelarDialog(true);
    } else {
      // Se não houver pendências, permitir voltar normalmente
      navigationBlockedRef.current = false;
      navigate('/protocolos');
    }
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

  // CRITICAL: Bloquear se não houver receptoras vinculadas
  if (receptoras.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleVoltarClick}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">2º Passo - {fazendaNome}</h1>
              <p className="text-slate-600 mt-1">Revisar e confirmar receptoras</p>
            </div>
          </div>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">⚠️ Protocolo Inconsistente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-800">
              Este protocolo não possui receptoras vinculadas. Não é possível prosseguir com o 2º passo.
            </p>
            <p className="text-sm text-red-700">
              Isso pode ter ocorrido devido a um erro durante a criação do protocolo ou exclusão acidental de dados.
            </p>
            <Button onClick={() => navigate('/protocolos')} variant="outline" className="mt-4">
              Voltar para Protocolos
            </Button>
          </CardContent>
        </Card>
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
          <Button variant="ghost" size="sm" onClick={handleVoltarClick}>
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
                <TableHead>Ciclando</TableHead>
                <TableHead>Qualidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Nenhuma receptora no protocolo
                  </TableCell>
                </TableRow>
              ) : (
                receptoras.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>
                      <CiclandoBadge
                        value={r.pr_ciclando_classificacao}
                        variant="display"
                        disabled={true}
                      />
                    </TableCell>
                    <TableCell>
                      <QualidadeSemaforo
                        value={r.pr_qualidade_semaforo}
                        variant="single"
                        disabled={true}
                      />
                    </TableCell>
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
                              setShowConfirmarDialog(true);
                            }}
                            disabled={isSavingConfirmar || submitting}
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
                              setDescartarForm({ motivo_inapta: '' });
                              setShowDescartarDialog(true);
                            }}
                            disabled={isSavingConfirmar || submitting}
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

      {/* Dialog de Confirmação Simples */}
      <Dialog 
        open={showConfirmarDialog} 
        onOpenChange={(open) => {
          if (!open && !isSavingConfirmar) {
            setShowConfirmarDialog(false);
            setSelectedReceptoraId('');
            setSelectedReceptoraBrinco('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Receptora</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja confirmar a receptora <strong>{selectedReceptoraBrinco}</strong>?
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            A receptora será marcada como <strong>APTA</strong> e seguirá para Transferência de Embriões.
          </p>
          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmarDialog(false);
                setSelectedReceptoraId('');
                setSelectedReceptoraBrinco('');
              }}
              disabled={isSavingConfirmar}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarReceptora}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isSavingConfirmar}
            >
              {isSavingConfirmar ? 'Confirmando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Descartar (com motivo opcional) */}
      <Dialog 
        open={showDescartarDialog} 
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setShowDescartarDialog(false);
            setSelectedReceptoraId('');
            setSelectedReceptoraBrinco('');
            setDescartarForm({ motivo_inapta: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar Receptora</DialogTitle>
            <DialogDescription>
              Descartar a receptora <strong>{selectedReceptoraBrinco}</strong> do protocolo?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo do descarte (opcional)</Label>
              <Select
                value={descartarForm.motivo_inapta || 'none'}
                onValueChange={(value) =>
                  setDescartarForm({ motivo_inapta: value === 'none' ? '' : value })
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
            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDescartarDialog(false);
                  setSelectedReceptoraId('');
                  setSelectedReceptoraBrinco('');
                  setDescartarForm({ motivo_inapta: '' });
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDescartarReceptora}
                variant="destructive"
                disabled={submitting}
              >
                {submitting ? 'Descartando...' : 'Descartar'}
              </Button>
            </div>
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

      {/* Dialog de Cancelamento do 2º Passo */}
      <Dialog open={showCancelarDialog} onOpenChange={(open) => {
        if (!open && !submitting) {
          setShowCancelarDialog(false);
          navigationBlockedRef.current = false;
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar 2º Passo?</DialogTitle>
            <DialogDescription>
              Você tem {receptorasPendentes.length} receptora(s) pendente(s) de revisão.
              <br />
              <br />
              Ao cancelar, o protocolo voltará para o status de "Aguardando 2º Passo" e você precisará iniciar o 2º passo novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelarDialog(false);
                navigationBlockedRef.current = false;
              }}
              disabled={submitting}
            >
              Não, continuar revisão
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelarPasso2}
              disabled={submitting}
            >
              {submitting ? 'Cancelando...' : 'Sim, cancelar 2º passo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}