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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { atualizarStatusReceptora, validarTransicaoStatus, calcularStatusReceptora } from '@/lib/receptoraStatus';
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import DatePickerBR from '@/components/shared/DatePickerBR';

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
  const [showResumoPasso2, setShowResumoPasso2] = useState(false);
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Form states para passo2 (unificado)
  const [passo2Form, setPasso2Form] = useState({
    data: '',
    tecnico: '',
  });

  // Estado para armazenar motivo_inapta em memória (não salva até finalizar)
  const [motivosInapta, setMotivosInapta] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // Verificar se há mudanças pendentes (receptoras não avaliadas ou campos passo2 não preenchidos)
  useEffect(() => {
    const pendentes = receptoras.filter(r => r.pr_status === 'INICIADA');
    const camposPreenchidos = passo2Form.data && passo2Form.tecnico.trim();
    const temMudancas = pendentes.length > 0 || !camposPreenchidos;
    setHasPendingChanges(temMudancas && protocolo?.status !== 'SINCRONIZADO');
  }, [receptoras, protocolo, passo2Form]);

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
      // Permitir SINCRONIZADO pois pode ser visto após finalizar (antes de redirecionar)
      if (protocoloData.status !== 'PASSO1_FECHADO' && 
          protocoloData.status !== 'PRIMEIRO_PASSO_FECHADO' && 
          protocoloData.status !== 'SINCRONIZADO') {
        toast({
          title: 'Erro',
          description: 'Este protocolo não está aguardando o 2º passo',
          variant: 'destructive',
        });
        navigate('/protocolos');
        return;
      }

      setProtocolo(protocoloData);

      // Preencher campos do passo2 se já existirem (protocolos antigos ou em andamento)
      if (protocoloData.passo2_data || protocoloData.passo2_tecnico_responsavel) {
        setPasso2Form({
          data: protocoloData.passo2_data || new Date().toISOString().split('T')[0],
          tecnico: protocoloData.passo2_tecnico_responsavel || '',
        });
      } else {
        // Se não tem, inicializar com data atual
        setPasso2Form({
          data: new Date().toISOString().split('T')[0],
          tecnico: '',
        });
      }

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

      // Receptoras carregadas com sucesso

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

      // Carregar motivos_inapta em memória se houver receptoras INAPTA
      const motivosInaptaLocal: Record<string, string> = {};
      receptorasWithStatus
        .filter(r => r.pr_status === 'INAPTA' && r.pr_motivo_inapta)
        .forEach(r => {
          motivosInaptaLocal[r.id] = r.pr_motivo_inapta || '';
        });
      setMotivosInapta(motivosInaptaLocal);
    } catch (error) {
      console.error('Error loading receptoras:', error);
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleAptaChange = (receptoraId: string, checked: boolean) => {
    // Atualizar apenas o estado local (não salva no banco ainda)
    if (checked) {
      // Se marcou APTA, remover motivo_inapta e garantir que INAPTA está desmarcado
      setMotivosInapta(prev => {
        const updated = { ...prev };
        delete updated[receptoraId];
        return updated;
      });
      setReceptoras(prevReceptoras =>
        prevReceptoras.map(r =>
          r.id === receptoraId
            ? { ...r, pr_status: 'APTA', pr_motivo_inapta: undefined }
            : r
        )
      );
    } else {
      // Se desmarcou APTA, voltar para INICIADA
      setReceptoras(prevReceptoras =>
        prevReceptoras.map(r =>
          r.id === receptoraId
            ? { ...r, pr_status: 'INICIADA', pr_motivo_inapta: undefined }
            : r
        )
      );
    }
  };

  const handleInaptaChange = (receptoraId: string, checked: boolean) => {
    // Atualizar apenas o estado local (não salva no banco ainda)
    if (checked) {
      // Se marcou INAPTA, garantir que APTA está desmarcado
      setReceptoras(prevReceptoras =>
        prevReceptoras.map(r =>
          r.id === receptoraId
            ? { ...r, pr_status: 'INAPTA' }
            : r
        )
      );
    } else {
      // Se desmarcou INAPTA, voltar para INICIADA e limpar motivo
      setMotivosInapta(prev => {
        const updated = { ...prev };
        delete updated[receptoraId];
        return updated;
      });
      setReceptoras(prevReceptoras =>
        prevReceptoras.map(r =>
          r.id === receptoraId
            ? { ...r, pr_status: 'INICIADA', pr_motivo_inapta: undefined }
            : r
        )
      );
    }
  };

  const handleMotivoInaptaChange = (receptoraId: string, motivo: string) => {
    // Armazenar motivo_inapta em memória
    setMotivosInapta(prev => ({
      ...prev,
      [receptoraId]: motivo.trim(),
    }));

    // Atualizar também no estado das receptoras para exibição
    setReceptoras(prevReceptoras =>
      prevReceptoras.map(r =>
        r.id === receptoraId
          ? { ...r, pr_motivo_inapta: motivo.trim() || undefined }
          : r
      )
    );
  };

  const handleFinalizarPasso2 = async () => {
    // Proteção contra multi-clique
    if (submitting) {
      return;
    }

    // Validação: campos passo2_data e passo2_tecnico_responsavel obrigatórios
    if (!passo2Form.data || !passo2Form.tecnico.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Data de realização do 2º passo e técnico responsável são obrigatórios',
        variant: 'destructive',
      });
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

      // Usar data atual como string YYYY-MM-DD (sem conversão de timezone)
      const hoje = new Date();
      const dataRetirada = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      // Atualizar status das receptoras no protocolo_receptoras (salvar tudo de uma vez)
      const receptorasConfirmadas = receptoras.filter(r => r.pr_status === 'APTA');
      const receptorasDescartadas = receptoras.filter(r => r.pr_status === 'INAPTA');

      // IMPORTANTE: Se não houver receptoras APTA, o protocolo deve ser FECHADO ao invés de SINCRONIZADO
      const temReceptorasAptas = receptorasConfirmadas.length > 0;
      const novoStatusProtocolo = temReceptorasAptas ? 'SINCRONIZADO' : 'FECHADO';

      // Primeiro: Atualizar receptoras no banco de dados (protocolo_receptoras)
      const protocoloReceptorasPromises = [
        // Atualizar receptoras confirmadas (APTA)
        ...receptorasConfirmadas.map(async (r) => {
          const { error } = await supabase
            .from('protocolo_receptoras')
            .update({
              status: 'APTA',
              motivo_inapta: null,
            })
            .eq('protocolo_id', id)
            .eq('receptora_id', r.id);

          if (error) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao} no protocolo:`, error);
            throw error;
          }
        }),
        // Atualizar receptoras descartadas (INAPTA)
        ...receptorasDescartadas.map(async (r) => {
          const motivoInapta = motivosInapta[r.id] || r.pr_motivo_inapta || null;
          const { error } = await supabase
            .from('protocolo_receptoras')
            .update({
              status: 'INAPTA',
              motivo_inapta: motivoInapta || null,
            })
            .eq('protocolo_id', id)
            .eq('receptora_id', r.id);

          if (error) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao} no protocolo:`, error);
            throw error;
          }
        }),
      ];

      // Aguardar todas as atualizações de protocolo_receptoras
      await Promise.allSettled(protocoloReceptorasPromises);

      // Atualizar status do protocolo (SINCRONIZADO se tem receptoras APTA, FECHADO se não tem)
      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .update({ 
          status: novoStatusProtocolo,
          passo2_data: passo2Form.data,
          passo2_tecnico_responsavel: passo2Form.tecnico.trim(),
          data_retirada: dataRetirada,
          responsavel_retirada: protocolo?.responsavel_inicio || null,
        })
        .eq('id', id);

      if (protocoloError) {
        console.error('Erro ao atualizar status do protocolo:', protocoloError);
        throw protocoloError;
      }

      // Atualizar estado local
      setProtocolo({
        ...protocolo!,
        status: novoStatusProtocolo as 'SINCRONIZADO' | 'FECHADO',
        passo2_data: passo2Form.data,
        passo2_tecnico_responsavel: passo2Form.tecnico.trim(),
        data_retirada: dataRetirada,
        responsavel_retirada: protocolo?.responsavel_inicio || null,
      });

      // Segundo: Atualizar status_reprodutivo das receptoras
      // Receptoras APTA → SINCRONIZADA
      // Receptoras INAPTA → VAZIA (descartadas)
      const statusUpdatePromises = [
        // Atualizar receptoras confirmadas para SINCRONIZADA
        // Atualizar diretamente sem validação para garantir que sempre atualiza
        ...receptorasConfirmadas.map(async (r) => {
          const { error: statusError } = await supabase
            .from('receptoras')
            .update({ status_reprodutivo: 'SINCRONIZADA' })
            .eq('id', r.id);
          
          if (statusError) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao} para SINCRONIZADA:`, statusError);
          }
        }),
        // Atualizar receptoras descartadas para VAZIA
        ...receptorasDescartadas.map(async (r) => {
          // Atualizar diretamente sem validação para garantir que sempre atualiza
          const { error: statusError } = await supabase
            .from('receptoras')
            .update({ status_reprodutivo: 'VAZIA' })
            .eq('id', r.id);
          
          if (statusError) {
            console.error(`Erro ao atualizar status da receptora ${r.identificacao} para VAZIA:`, statusError);
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

  const handleCancelarPasso2 = () => {
    // Com a unificação, não precisamos salvar nada no banco ao cancelar
    // Os dados ficam em memória e não são salvos até finalizar
    setShowCancelarDialog(false);
    setHasPendingChanges(false);
    navigationBlockedRef.current = false;
    navigate('/protocolos');
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
        <div className="flex flex-col items-end gap-2">
          <Button 
            onClick={handleFinalizarPasso2}
            disabled={receptorasPendentes.length > 0 || !passo2Form.data || !passo2Form.tecnico.trim() || submitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Lock className="w-4 h-4 mr-2" />
            {submitting ? 'Finalizando...' : 'Finalizar 2º Passo'}
          </Button>
          {(receptorasPendentes.length > 0 || !passo2Form.data || !passo2Form.tecnico.trim()) && (
            <p className="text-xs text-slate-500 text-right">
              {!passo2Form.data || !passo2Form.tecnico.trim()
                ? 'Preencha a data e o técnico responsável'
                : receptorasPendentes.length > 0
                ? `${receptorasPendentes.length} receptora(s) aguardando avaliação`
                : ''}
            </p>
          )}
        </div>
      </div>

      {/* Campos para preencher passo2_data e passo2_tecnico_responsavel (unificado) */}
      {protocolo && protocolo.status !== 'SINCRONIZADO' && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do 2º Passo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="passo2_data">Data de Realização do 2º Passo *</Label>
              <DatePickerBR
                id="passo2_data"
                value={passo2Form.data}
                onChange={(value) => setPasso2Form({ ...passo2Form, data: value || '' })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passo2_tecnico">Técnico Responsável *</Label>
              <Input
                id="passo2_tecnico"
                value={passo2Form.tecnico}
                onChange={(e) => setPasso2Form({ ...passo2Form, tecnico: e.target.value })}
                placeholder="Nome do técnico responsável"
                required
              />
            </div>
          </CardContent>
        </Card>
      )}

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
              {protocolo.passo2_data ? formatDate(protocolo.passo2_data) : (passo2Form.data ? formatDate(passo2Form.data) : '-')}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Técnico 2º Passo</p>
            <p className="text-base text-slate-900">
              {protocolo.passo2_tecnico_responsavel || passo2Form.tecnico || '-'}
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
                <TableHead>Avaliação</TableHead>
                <TableHead>Motivo (se INAPTA)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
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
                    <TableCell>
                      {protocolo && protocolo.status !== 'SINCRONIZADO' ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`apta-${r.id}`}
                              checked={r.pr_status === 'APTA'}
                              onCheckedChange={(checked) => {
                                const newChecked = checked === true;
                                if (newChecked) {
                                  // Se marcou APTA, desmarcar INAPTA e limpar motivo
                                  setMotivosInapta(prev => {
                                    const updated = { ...prev };
                                    delete updated[r.id];
                                    return updated;
                                  });
                                  setReceptoras(prevReceptoras =>
                                    prevReceptoras.map(recept =>
                                      recept.id === r.id
                                        ? { ...recept, pr_status: 'APTA', pr_motivo_inapta: undefined }
                                        : recept
                                    )
                                  );
                                } else {
                                  // Se desmarcou APTA, voltar para INICIADA
                                  setReceptoras(prevReceptoras =>
                                    prevReceptoras.map(recept =>
                                      recept.id === r.id
                                        ? { ...recept, pr_status: 'INICIADA', pr_motivo_inapta: undefined }
                                        : recept
                                    )
                                  );
                                }
                              }}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white"
                            />
                            <Label
                              htmlFor={`apta-${r.id}`}
                              className="text-sm font-medium cursor-pointer text-green-700"
                            >
                              APTA
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`inapta-${r.id}`}
                              checked={r.pr_status === 'INAPTA'}
                              onCheckedChange={(checked) => {
                                const newChecked = checked === true;
                                if (newChecked) {
                                  // Se marcou INAPTA, desmarcar APTA
                                  setReceptoras(prevReceptoras =>
                                    prevReceptoras.map(recept =>
                                      recept.id === r.id
                                        ? { ...recept, pr_status: 'INAPTA' }
                                        : recept
                                    )
                                  );
                                } else {
                                  // Se desmarcou INAPTA, voltar para INICIADA e limpar motivo
                                  setMotivosInapta(prev => {
                                    const updated = { ...prev };
                                    delete updated[r.id];
                                    return updated;
                                  });
                                  setReceptoras(prevReceptoras =>
                                    prevReceptoras.map(recept =>
                                      recept.id === r.id
                                        ? { ...recept, pr_status: 'INICIADA', pr_motivo_inapta: undefined }
                                        : recept
                                    )
                                  );
                                }
                              }}
                              className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600 data-[state=checked]:text-white"
                            />
                            <Label
                              htmlFor={`inapta-${r.id}`}
                              className="text-sm font-medium cursor-pointer text-red-700"
                            >
                              INAPTA
                            </Label>
                          </div>
                        </div>
                      ) : (
                        getStatusBadge(r.pr_status)
                      )}
                    </TableCell>
                    <TableCell>
                      {r.pr_status === 'INAPTA' && protocolo && protocolo.status !== 'SINCRONIZADO' ? (
                        <Input
                          type="text"
                          placeholder="Justificativa (opcional)"
                          value={motivosInapta[r.id] || r.pr_motivo_inapta || ''}
                          onChange={(e) => handleMotivoInaptaChange(r.id, e.target.value)}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-slate-500">{r.pr_motivo_inapta || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
              Você tem mudanças pendentes (campos não preenchidos ou receptoras não avaliadas).
              <br />
              <br />
              Ao sair, as alterações não serão salvas e você precisará iniciar o 2º passo novamente.
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
            >
              Sim, sair sem salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}