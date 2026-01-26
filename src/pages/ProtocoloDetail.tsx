import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora, ProtocoloReceptoraQuery } from '@/lib/types';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Plus, UserPlus, CheckCircle, Lock, Trash2 } from 'lucide-react';

interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
}

export default function ProtocoloDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptoras, setReceptoras] = useState<ReceptoraWithStatus[]>([]);
  const [receptorasDisponiveis, setReceptorasDisponiveis] = useState<Receptora[]>([]);
  const isAddingReceptoraRef = useRef(false); // Proteção contra múltiplas chamadas
  
  // Dialog states
  const [showAddReceptora, setShowAddReceptora] = useState(false);
  const [showCreateReceptora, setShowCreateReceptora] = useState(false);
  const [showResumoPasso1, setShowResumoPasso1] = useState(false);
  
  // Form states
  const [addReceptoraForm, setAddReceptoraForm] = useState({
    receptora_id: '',
    observacoes: '',
  });
  const [createReceptoraForm, setCreateReceptoraForm] = useState({
    identificacao: '',
    nome: '',
    observacoes: '',
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

      // Load available receptoras from protocol's fazenda
      await loadReceptorasDisponiveis(protocoloData.fazenda_id);
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

      if (!prData || prData.length === 0) {
        setReceptoras([]);
        return;
      }

      // Buscar todas as receptoras de uma vez (otimização: 1 query ao invés de N)
      const receptoraIds = prData.map(pr => pr.receptora_id);
      const { data: receptorasData, error: receptorasError } = await supabase
        .from('receptoras')
        .select('*')
        .in('id', receptoraIds);

      if (receptorasError) throw receptorasError;

      // Criar mapa para lookup rápido
      const receptorasMap = new Map(receptorasData?.map(r => [r.id, r]) || []);

      // Combinar dados
      const receptorasWithStatus: ReceptoraWithStatus[] = prData
        .map(pr => {
          const receptoraData = receptorasMap.get(pr.receptora_id);
          if (!receptoraData) {
            return null;
          }
          return {
            ...receptoraData,
            pr_id: pr.id,
            pr_status: pr.status,
            pr_motivo_inapta: pr.motivo_inapta,
            pr_observacoes: pr.observacoes,
          };
        })
        .filter((r): r is ReceptoraWithStatus => r !== null);

      setReceptoras(receptorasWithStatus);
    } catch {
      // Erro silencioso - lista fica vazia
    }
  };

  const loadReceptorasDisponiveis = async (fazendaId: string) => {
    try {
      // Usar view vw_receptoras_fazenda_atual para filtrar por fazenda atual
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) {
        setReceptorasDisponiveis([]);
        return;
      }

      // Buscar dados completos das receptoras usando os IDs da view
      const { data, error } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });
      
      if (error) throw error;
      
      const allReceptoras = data || [];

      // Get receptoras already in this protocol
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id')
        .eq('protocolo_id', id);

      if (prError) throw prError;

      const receptorasJaAdicionadas = prData?.map(pr => pr.receptora_id) || [];

      // Filter: exclude already added AND check status for VAZIA only
      const disponiveisPromises = (allReceptoras || [])
        .filter(r => !receptorasJaAdicionadas.includes(r.id))
        .map(async (r) => {
          const status = r.status_reprodutivo || 'VAZIA';
          return status === 'VAZIA' ? r : null;
        });

      const disponiveisResults = await Promise.all(disponiveisPromises);
      const disponiveis = disponiveisResults.filter((r): r is Receptora => r !== null);

      setReceptorasDisponiveis(disponiveis);
    } catch {
      // Erro silencioso - lista fica vazia
    }
  };

  const handleAddReceptora = async () => {
    // Proteção dupla contra múltiplas chamadas
    if (submitting || isAddingReceptoraRef.current) return;
    
    if (!addReceptoraForm.receptora_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma receptora',
        variant: 'destructive',
      });
      return;
    }

    try {
      isAddingReceptoraRef.current = true;
      setSubmitting(true);

      // Buscar informações da receptora que está sendo adicionada
      const { data: receptoraData, error: receptoraDataError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .eq('id', addReceptoraForm.receptora_id)
        .single();

      if (receptoraDataError) throw receptoraDataError;

      // Verificar se já existe receptora com o mesmo brinco no protocolo
      // (pode ser a mesma receptora ou outra com o mesmo brinco)
      const { data: prData, error: prDataError } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id')
        .eq('protocolo_id', id);

      if (prDataError) {
        // Continua execução mesmo com erro de verificação
      }

      if (prData && prData.length > 0) {
        const receptoraIdsNoProtocolo = prData.map(pr => pr.receptora_id);
        
        // Verificar se a mesma receptora já está no protocolo
        if (receptoraIdsNoProtocolo.includes(addReceptoraForm.receptora_id)) {
          toast({
            title: 'Receptora já está no protocolo',
            description: 'Essa receptora já está adicionada a este protocolo.',
            variant: 'destructive',
          });
          setSubmitting(false);
          isAddingReceptoraRef.current = false;
          return;
        }

        // Buscar dados das receptoras no protocolo para verificar por brinco
        const { data: receptorasNoProtocolo, error: receptorasError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIdsNoProtocolo);

        // Continua mesmo se erro ao buscar receptoras

        // Verificar se já existe outra receptora com o mesmo brinco no protocolo
        const mesmoBrinco = receptorasNoProtocolo?.find(
          (r) => r.identificacao === receptoraData.identificacao
        );

        if (mesmoBrinco) {
          toast({
            title: 'Brinco já está no protocolo',
            description: `Já existe uma receptora com o brinco "${receptoraData.identificacao}" neste protocolo. Não é possível adicionar outra receptora com o mesmo brinco.`,
            variant: 'destructive',
          });
          setSubmitting(false);
          isAddingReceptoraRef.current = false;
          return;
        }
      }

      // Verificar se a receptora está em algum protocolo ATIVO (não fechado)
      // A constraint unq_receptora_protocolo_ativo impede múltiplos protocolos ativos
      // IMPORTANTE: Receptoras descartadas (INAPTA) em protocolos fechados ou aguardando 2º passo
      // NÃO devem bloquear o reuso em novo protocolo
      const { data: protocolosAtivos, error: protocolosAtivosError } = await supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          protocolo_id,
          status,
          motivo_inapta,
          protocolos_sincronizacao!inner (
            id,
            status,
            data_inicio
          )
        `)
        .eq('receptora_id', addReceptoraForm.receptora_id)
        .neq('protocolos_sincronizacao.status', 'SINCRONIZADO');

      // Continua mesmo se erro ao verificar protocolos

      if (protocolosAtivos && protocolosAtivos.length > 0) {
        // Verificar se está no protocolo atual
        const noProtocoloAtual = protocolosAtivos.find(
          (pr: ProtocoloReceptoraQuery) => pr.protocolo_id === id
        );

        if (noProtocoloAtual) {
          toast({
            title: 'Receptora já está no protocolo',
            description: `Esta receptora já foi adicionada a este protocolo anteriormente (Status: ${noProtocoloAtual.status}). Recarregue a página para ver a lista atualizada.`,
            variant: 'destructive',
          });
          setSubmitting(false);
          isAddingReceptoraRef.current = false;
          loadData();
          return;
        }

        // Filtrar protocolos que realmente bloqueiam:
        // - Receptoras com status APTA ou INICIADA em protocolos ativos (não fechados)
        // - Receptoras descartadas (INAPTA) NÃO bloqueiam se o protocolo estiver fechado ou aguardando 2º passo
        const protocolosBloqueantes = protocolosAtivos.filter((pr: ProtocoloReceptoraQuery) => {
          const protocoloStatus = pr.protocolos_sincronizacao?.status;
          const receptoraStatus = pr.status;
          
          // Se foi descartada (INAPTA), não bloqueia (pode ser reutilizada)
          if (receptoraStatus === 'INAPTA') {
            return false;
          }
          
          // Se está APTA ou INICIADA e o protocolo não está sincronizado/fechado, bloqueia
          if ((receptoraStatus === 'APTA' || receptoraStatus === 'INICIADA') && 
              protocoloStatus !== 'SINCRONIZADO' && protocoloStatus !== 'FECHADO') {
            return true;
          }
          
          return false;
        });

        if (protocolosBloqueantes.length > 0) {
          const outroProtocolo = protocolosBloqueantes[0];
          const protocoloInfo = outroProtocolo.protocolos_sincronizacao;
          const idProtocolo = protocoloInfo?.id?.substring(0, 8) || 'N/A';
          const statusProtocolo = protocoloInfo?.status || 'N/A';
          const receptoraStatus = outroProtocolo.status;
          
          toast({
            title: 'Receptora em outro protocolo ativo',
            description: `Esta receptora está vinculada a outro protocolo ativo (ID: ${idProtocolo}, Status do protocolo: ${statusProtocolo}, Status da receptora: ${receptoraStatus}). Uma receptora só pode estar em um protocolo ativo por vez. Finalize ou feche o protocolo anterior antes de adicionar a um novo.`,
            variant: 'destructive',
          });
          setSubmitting(false);
          isAddingReceptoraRef.current = false;
          return;
        }
      }

      // Check receptora status
      const status = receptoraData?.status_reprodutivo || 'VAZIA';
      
      if (status !== 'VAZIA') {
        const motivoMap: Record<string, string> = {
          'EM SINCRONIZAÇÃO': 'Já está em protocolo em andamento.',
          'SINCRONIZADA': 'Já está sincronizada aguardando TE.',
          'SERVIDA': 'Já recebeu embrião e aguarda diagnóstico/sexagem.',
          'PRENHE': 'Está prenhe.',
          'PRENHE_RETOQUE': 'Está prenhe, mas precisa de retoque/confirmação.',
          'PRENHE (RETOQUE)': 'Está prenhe, mas precisa de retoque/confirmação.',
          'PRENHE_FEMEA': 'Está prenhe de fêmea.',
          'PRENHE (FÊMEA)': 'Está prenhe de fêmea.',
          'PRENHE_MACHO': 'Está prenhe de macho.',
          'PRENHE (MACHO)': 'Está prenhe de macho.',
          'PRENHE_SEM_SEXO': 'Está prenhe, sem sexo definido.',
          'PRENHE (SEM SEXO)': 'Está prenhe, sem sexo definido.',
        };
        
        toast({
          title: 'Receptora não disponível',
          description: motivoMap[status] || 'Receptora não está disponível.',
          variant: 'destructive',
        });
        setSubmitting(false);
        isAddingReceptoraRef.current = false;
        return;
      }

      const insertData = {
        protocolo_id: id,
        receptora_id: addReceptoraForm.receptora_id,
        evento_fazenda_id: protocolo?.fazenda_id, // Renomeado de fazenda_atual_id: apenas para auditoria
        data_inclusao: protocolo?.data_inicio,
        status: 'INICIADA',
        observacoes: addReceptoraForm.observacoes || null,
      };

      const { error, data: insertedData } = await supabase
        .from('protocolo_receptoras')
        .insert([insertData])
        .select();

      if (error) {
        // Tratar erro de constraint única (receptora já no protocolo)
        if (error.code === '409' || error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          // Buscar TODOS os registros dessa receptora (em qualquer protocolo)
          const { data: allReceptoraProtocols, error: searchError } = await supabase
            .from('protocolo_receptoras')
            .select(`
              id,
              protocolo_id,
              receptora_id,
              status,
              data_inclusao,
              protocolos_sincronizacao!inner (
                id,
                status,
                data_inicio,
                fazenda_id
              )
            `)
            .eq('receptora_id', addReceptoraForm.receptora_id);

          // Continua mesmo se erro na busca

          // Verificar se está no protocolo atual
          const noProtocoloAtual = allReceptoraProtocols?.find(
            (pr: ProtocoloReceptoraQuery) => pr.protocolo_id === id
          );

          if (noProtocoloAtual) {
            toast({
              title: 'Receptora já está no protocolo',
              description: `Esta receptora já foi adicionada a este protocolo anteriormente (Status: ${noProtocoloAtual.status}). Recarregue a página para ver a lista atualizada.`,
              variant: 'destructive',
            });
          } else {
            // Está em outro protocolo - listar todos
            const outrosProtocolos = allReceptoraProtocols?.filter(
              (pr: ProtocoloReceptoraQuery) => pr.protocolo_id !== id
            ) || [];

            if (outrosProtocolos.length > 0) {
              const protocolosList = outrosProtocolos
                .map((pr: ProtocoloReceptoraQuery) => `Protocolo ${pr.protocolos_sincronizacao?.id?.substring(0, 8)} (${pr.protocolos_sincronizacao?.status || 'N/A'})`)
                .join(', ');

              toast({
                title: 'Receptora vinculada a outro(s) protocolo(s)',
                description: `Esta receptora está vinculada a outro(s) protocolo(s): ${protocolosList}. Ela precisa estar disponível (sem vínculos ativos) para ser adicionada a um novo protocolo.`,
                variant: 'destructive',
              });
            } else {
              // Erro inesperado - pode ser constraint de banco
              toast({
                title: 'Erro ao adicionar receptora',
                description: `Não foi possível adicionar esta receptora. Código de erro: ${error.code || 'DESCONHECIDO'}. Verifique o histórico da receptora ou entre em contato com o suporte.`,
                variant: 'destructive',
              });
            }
          }
          
          setSubmitting(false);
          isAddingReceptoraRef.current = false;
          return;
        }
        throw error;
      }

      toast({
        title: 'Receptora adicionada',
        description: 'Receptora adicionada ao protocolo com sucesso',
      });

      setShowAddReceptora(false);
      setAddReceptoraForm({ receptora_id: '', observacoes: '' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isAddingReceptoraRef.current = false;
    }
  };

  const handleCreateReceptora = async () => {
    if (!createReceptoraForm.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Verificar se já existe receptora com esse brinco na fazenda do protocolo
      // Primeiro, buscar todas as receptoras com esse brinco
      const { data: receptorasComBrinco, error: brincoCheckError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .ilike('identificacao', createReceptoraForm.identificacao.trim());

      // Continua mesmo se erro ao verificar brinco

      // Se encontrou receptoras com esse brinco, verificar status e protocolos
      if (receptorasComBrinco && receptorasComBrinco.length > 0) {
        const receptoraIds = receptorasComBrinco.map(r => r.id);
        
        // PRIMEIRO: Verificar se alguma receptora com esse brinco já está no protocolo atual
        const { data: prData, error: prDataError } = await supabase
          .from('protocolo_receptoras')
          .select('receptora_id, status')
          .eq('protocolo_id', id);

        // Continua mesmo se erro ao verificar

        if (prData && prData.length > 0) {
          const receptoraIdsNoProtocolo = prData.map(pr => pr.receptora_id);
          
          // Verificar se alguma dessas receptoras específicas já está no protocolo
          const prJaNoProtocolo = prData.find(pr => receptoraIds.includes(pr.receptora_id));
          
          if (prJaNoProtocolo) {
            toast({
              title: 'Receptora já está no protocolo',
              description: `Esta receptora já foi adicionada a este protocolo (Status: ${prJaNoProtocolo.status}).`,
              variant: 'destructive',
            });
            setSubmitting(false);
            return;
          }

          // Buscar dados das receptoras no protocolo para verificar por brinco
          const { data: receptorasNoProtocolo, error: receptorasError } = await supabase
            .from('receptoras')
            .select('id, identificacao')
            .in('id', receptoraIdsNoProtocolo);

          // Continua mesmo se erro ao buscar

          // Verificar se alguma receptora com esse brinco já está no protocolo
          const brincoParaVerificar = createReceptoraForm.identificacao.trim();
          const mesmoBrincoNoProtocolo = receptorasNoProtocolo?.find(
            (r) => r.identificacao === brincoParaVerificar
          );

          if (mesmoBrincoNoProtocolo) {
            // Buscar o status dessa receptora no protocolo
            const prComMesmoBrinco = prData.find(pr => pr.receptora_id === mesmoBrincoNoProtocolo.id);
            const status = prComMesmoBrinco?.status || 'N/A';
            
            toast({
              title: 'Brinco já está no protocolo',
              description: `Já existe uma receptora com o brinco "${brincoParaVerificar}" neste protocolo (Status: ${status}). Não é possível criar ou adicionar outra receptora com o mesmo brinco.`,
              variant: 'destructive',
            });
            setSubmitting(false);
            return;
          }
        }
        
        // SEGUNDO: Verificar status de cada receptora existente com esse brinco
        // Se alguma estiver em protocolo ativo ou sincronizada, bloquear criação
        for (const receptoraExistente of receptorasComBrinco) {
          const status = receptoraExistente.status_reprodutivo || 'VAZIA';
          
          if (status !== 'VAZIA') {
            const motivoMap: Record<string, string> = {
              'EM SINCRONIZAÇÃO': 'Já está em protocolo em andamento.',
              'SINCRONIZADA': 'Já está sincronizada aguardando TE.',
              'SERVIDA': 'Já recebeu embrião e aguarda diagnóstico/sexagem.',
              'PRENHE': 'Está prenhe.',
              'PRENHE_RETOQUE': 'Está prenhe, mas precisa de retoque/confirmação.',
              'PRENHE (RETOQUE)': 'Está prenhe, mas precisa de retoque/confirmação.',
              'PRENHE_FEMEA': 'Está prenhe de fêmea.',
              'PRENHE (FÊMEA)': 'Está prenhe de fêmea.',
              'PRENHE_MACHO': 'Está prenhe de macho.',
              'PRENHE (MACHO)': 'Está prenhe de macho.',
              'PRENHE_SEM_SEXO': 'Está prenhe, sem sexo definido.',
              'PRENHE (SEM SEXO)': 'Está prenhe, sem sexo definido.',
            };
            
            const motivo = motivoMap[status] || `Status: ${status}`;
            
            toast({
              title: 'Receptora não disponível',
              description: `Já existe uma receptora com esse brinco que está ${motivo} Não é possível criar uma nova receptora com o mesmo brinco.`,
              variant: 'destructive',
            });
            setSubmitting(false);
            return;
          }
        }
        
        // TERCEIRO: Verificar histórico de fazendas para ver se alguma está na fazenda do protocolo
        const { data: historicoFazendas, error: historicoError } = await supabase
          .from('receptora_fazenda_historico')
          .select('receptora_id, fazenda_id')
          .in('receptora_id', receptoraIds)
          .eq('fazenda_id', protocolo!.fazenda_id)
          .is('data_fim', null); // Apenas vínculos ativos

        // Continua mesmo se erro ao verificar histórico

        if (historicoFazendas && historicoFazendas.length > 0) {
          // Receptora com mesmo brinco já existe na fazenda e está VAZIA
          const receptoraIdNaFazenda = historicoFazendas[0].receptora_id;
          const receptoraExistente = receptorasComBrinco.find(r => r.id === receptoraIdNaFazenda);
          
          if (receptoraExistente) {
            // Receptora existe na fazenda mas não está no protocolo - usar a existente
            const protocoloReceptoraData = {
              protocolo_id: id,
              receptora_id: receptoraExistente.id,
              evento_fazenda_id: protocolo?.fazenda_id,
              data_inclusao: protocolo?.data_inicio,
              status: 'INICIADA',
              observacoes: createReceptoraForm.observacoes || null,
            };

            const { error: protocoloError } = await supabase
              .from('protocolo_receptoras')
              .insert([protocoloReceptoraData]);

            if (protocoloError) {
              // Se for erro de duplicata, verificar novamente
              if (protocoloError.code === '23505') {
                toast({
                  title: 'Receptora já está no protocolo',
                  description: 'Esta receptora já foi adicionada a este protocolo.',
                  variant: 'destructive',
                });
                setSubmitting(false);
                await loadData();
                return;
              }
              throw protocoloError;
            }

            toast({
              title: 'Receptora adicionada',
              description: 'Receptora existente foi adicionada ao protocolo com sucesso',
            });

            setShowCreateReceptora(false);
            setCreateReceptoraForm({
              identificacao: '',
              nome: '',
              observacoes: '',
            });
            
            await loadData();
            setSubmitting(false);
            return;
          }
        }
      }

      // Create receptora in protocol's fazenda
      const receptoraData: Record<string, string> = {
        identificacao: createReceptoraForm.identificacao.trim(),
      };

      if (createReceptoraForm.nome.trim()) {
        receptoraData.nome = createReceptoraForm.nome.trim();
      }

      const { data: novaReceptora, error: receptoraError } = await supabase
        .from('receptoras')
        .insert([receptoraData])
        .select()
        .single();

      if (receptoraError) {
        if (receptoraError.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco. Verifique se ela já está na fazenda.');
        }
        throw receptoraError;
      }

      // Inserir no histórico de fazendas (fonte oficial da fazenda atual)
      // Verificar primeiro se já não tem histórico ativo (por segurança)
      const { data: historicoExistente, error: checkHistoricoError } = await supabase
        .from('receptora_fazenda_historico')
        .select('id')
        .eq('receptora_id', novaReceptora.id)
        .eq('fazenda_id', protocolo!.fazenda_id)
        .is('data_fim', null)
        .maybeSingle();

      // Continua mesmo se erro ao verificar histórico

      // Só criar histórico se não existir
      if (!historicoExistente) {
        const { error: historicoError } = await supabase
          .from('receptora_fazenda_historico')
          .insert([{
            receptora_id: novaReceptora.id,
            fazenda_id: protocolo!.fazenda_id,
            data_inicio: new Date().toISOString().split('T')[0],
            data_fim: null, // vínculo ativo
          }]);

        if (historicoError) {
          // Se o erro for de duplicata (trigger), significa que a validação falhou
          // Mas a receptora já foi criada, então precisamos removê-la e usar a existente
          if (historicoError.message?.includes('brinco') || historicoError.code === 'P0001') {
            // Remover a receptora que acabamos de criar
            await supabase
              .from('receptoras')
              .delete()
              .eq('id', novaReceptora.id);
            
            // Buscar a receptora existente e adicionar ao protocolo
            const { data: receptorasComBrinco } = await supabase
              .from('receptoras')
              .select('id')
              .eq('identificacao', createReceptoraForm.identificacao.trim())
              .neq('id', novaReceptora.id); // Excluir a que acabamos de criar (já deletada)
            
            if (receptorasComBrinco && receptorasComBrinco.length > 0) {
              const receptoraExistenteId = receptorasComBrinco[0].id;
              
              // Verificar se já está no protocolo
              const { data: prExistente } = await supabase
                .from('protocolo_receptoras')
                .select('id, status')
                .eq('protocolo_id', id)
                .eq('receptora_id', receptoraExistenteId)
                .maybeSingle();
              
              if (prExistente) {
                // Já está no protocolo - não fazer nada, apenas informar
                toast({
                  title: 'Receptora já está no protocolo',
                  description: `Esta receptora já foi adicionada a este protocolo (Status: ${prExistente.status}).`,
                });
              } else {
                // Adicionar ao protocolo
                const { error: protocoloError } = await supabase
                  .from('protocolo_receptoras')
                  .insert([{
                    protocolo_id: id,
                    receptora_id: receptoraExistenteId,
                    evento_fazenda_id: protocolo?.fazenda_id,
                    data_inclusao: protocolo?.data_inicio,
                    status: 'INICIADA',
                    observacoes: createReceptoraForm.observacoes || null,
                  }]);
                
                if (protocoloError) throw protocoloError;
                
                toast({
                  title: 'Receptora adicionada',
                  description: 'Receptora existente foi adicionada ao protocolo com sucesso',
                });
              }
              
              setShowCreateReceptora(false);
              setCreateReceptoraForm({
                identificacao: '',
                nome: '',
                observacoes: '',
              });
              
              await loadData();
              setSubmitting(false);
              return;
            }
            
            throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
          }
          throw historicoError;
        }
      }

      // Verificar se o histórico foi criado com sucesso antes de adicionar ao protocolo
      // Se não foi criado, não adicionar ao protocolo
      const { data: historicoVerificado, error: verificarHistoricoError } = await supabase
        .from('receptora_fazenda_historico')
        .select('id')
        .eq('receptora_id', novaReceptora.id)
        .eq('fazenda_id', protocolo!.fazenda_id)
        .is('data_fim', null)
        .maybeSingle();

      // Continua mesmo se erro na verificação

      if (!historicoVerificado) {
        // Histórico não foi criado - remover a receptora criada
        await supabase
          .from('receptoras')
          .delete()
          .eq('id', novaReceptora.id);
        
        toast({
          title: 'Erro ao criar receptora',
          description: 'Não foi possível vincular a receptora à fazenda. Verifique se já existe uma receptora com esse brinco.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      // Add to protocol
      const protocoloReceptoraData = {
        protocolo_id: id,
        receptora_id: novaReceptora.id,
        evento_fazenda_id: protocolo?.fazenda_id, // Renomeado de fazenda_atual_id: apenas para auditoria
        data_inclusao: protocolo?.data_inicio,
        status: 'INICIADA',
        observacoes: createReceptoraForm.observacoes || null,
      };

      const { error: protocoloError } = await supabase
        .from('protocolo_receptoras')
        .insert([protocoloReceptoraData]);

      if (protocoloError) {
        // Se falhar ao adicionar ao protocolo, remover a receptora criada
        await supabase
          .from('receptoras')
          .delete()
          .eq('id', novaReceptora.id);
        
        // Se for erro de duplicata (constraint unique), verificar novamente
        if (protocoloError.code === '23505') {
          toast({
            title: 'Receptora já está no protocolo',
            description: 'Esta receptora já foi adicionada a este protocolo.',
            variant: 'destructive',
          });
          setSubmitting(false);
          await loadData();
          return;
        }
        throw protocoloError;
      }

      toast({
        title: 'Receptora criada e adicionada',
        description: 'Receptora criada e adicionada ao protocolo com sucesso',
      });

      setShowCreateReceptora(false);
      setCreateReceptoraForm({
        identificacao: '',
        nome: '',
        observacoes: '',
      });
      
      // Reload data
      await loadData();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizarPasso1 = async () => {
    // Validate
    if (!protocolo?.fazenda_id || !protocolo?.data_inicio || !protocolo?.responsavel_inicio) {
      toast({
        title: 'Erro de validação',
        description: 'Protocolo incompleto: faltam dados obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (receptoras.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Adicione pelo menos 1 receptora antes de finalizar o 1º passo',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Update protocol status to PASSO1_FECHADO
      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .update({ status: 'PASSO1_FECHADO' })
        .eq('id', id);

      if (protocoloError) throw protocoloError;

      // Keep receptoras status as INICIADA (will be updated in 2nd step)
      // No need to update here

      // Reload data to show updated status
      await loadData();

      // Show summary modal
      setShowResumoPasso1(true);
    } catch (error) {
      toast({
        title: 'Erro ao finalizar 1º passo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelarProtocolo = async () => {
    try {
      setSubmitting(true);

      // Delete protocolo_receptoras
      const { error: prError } = await supabase
        .from('protocolo_receptoras')
        .delete()
        .eq('protocolo_id', id);

      if (prError) throw prError;

      // Delete protocolo
      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .delete()
        .eq('id', id);

      if (protocoloError) throw protocoloError;

      toast({
        title: 'Protocolo cancelado',
        description: 'Protocolo cancelado com sucesso',
      });

      navigate('/protocolos');
    } catch (error) {
      toast({
        title: 'Erro ao cancelar protocolo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseResumoPasso1 = () => {
    setShowResumoPasso1(false);
    toast({
      title: '1º passo concluído com sucesso',
      description: `${receptoras.length} receptoras em sincronização`,
    });
    navigate('/protocolos');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!protocolo) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Protocolo não encontrado"
          description="Volte para a lista e selecione outro protocolo."
          action={(
            <Button onClick={() => navigate('/protocolos')} variant="outline">
              Voltar para Protocolos
            </Button>
          )}
        />
      </div>
    );
  }

  // Nota: Status 'ABERTO' e 'PASSO1_ABERTO' foram removidos - protocolos são criados já com PASSO1_FECHADO
  // Portanto, protocolos não podem mais ser editados após criação (sempre false)
  const isPasso1Aberto = false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Protocolo - ${fazendaNome}`}
        description={isPasso1Aberto ? 'Gerenciar receptoras do 1º passo' : 'Protocolo finalizado'}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('/protocolos')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          {isPasso1Aberto && (
            <>
              <Dialog open={showAddReceptora} onOpenChange={setShowAddReceptora}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Receptora
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Adicionar Receptora ao Protocolo</DialogTitle>
                    <DialogDescription>
                      Selecione uma receptora VAZIA da fazenda {fazendaNome} ou cadastre uma nova
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing">Receptora Existente</TabsTrigger>
                      <TabsTrigger value="new">Cadastrar Nova</TabsTrigger>
                    </TabsList>
                    <TabsContent value="existing" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Receptora *</Label>
                        <Select
                          value={addReceptoraForm.receptora_id}
                          onValueChange={(value) =>
                            setAddReceptoraForm({ ...addReceptoraForm, receptora_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma receptora VAZIA" />
                          </SelectTrigger>
                          <SelectContent>
                            {receptorasDisponiveis.length === 0 ? (
                              <div className="p-2 text-sm text-slate-500">
                                Nenhuma receptora VAZIA disponível nesta fazenda
                              </div>
                            ) : (
                              receptorasDisponiveis.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.identificacao} {r.nome ? `- ${r.nome}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={addReceptoraForm.observacoes}
                          onChange={(e) =>
                            setAddReceptoraForm({ ...addReceptoraForm, observacoes: e.target.value })
                          }
                          placeholder="Observações sobre a inclusão"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={handleAddReceptora}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={submitting || receptorasDisponiveis.length === 0}
                      >
                        {submitting ? 'Adicionando...' : 'Adicionar'}
                      </Button>
                    </TabsContent>
                    <TabsContent value="new" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Identificação (Brinco) *</Label>
                        <Input
                          value={createReceptoraForm.identificacao}
                          onChange={(e) =>
                            setCreateReceptoraForm({
                              ...createReceptoraForm,
                              identificacao: e.target.value,
                            })
                          }
                          placeholder="Número do brinco"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                          value={createReceptoraForm.nome}
                          onChange={(e) =>
                            setCreateReceptoraForm({ ...createReceptoraForm, nome: e.target.value })
                          }
                          placeholder="Nome da receptora (opcional)"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={createReceptoraForm.observacoes}
                          onChange={(e) =>
                            setCreateReceptoraForm({
                              ...createReceptoraForm,
                              observacoes: e.target.value,
                            })
                          }
                          placeholder="Observações sobre a receptora"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={handleCreateReceptora}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={submitting}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        {submitting ? 'Criando...' : 'Criar e Adicionar'}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>

              <Button 
                onClick={handleFinalizarPasso1}
                disabled={receptoras.length === 0 || submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                {submitting ? 'Finalizando...' : 'Finalizar 1º Passo'}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar Protocolo</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar este protocolo? Esta ação não pode ser desfeita.
                      Todas as receptoras vinculadas serão removidas do protocolo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Não, manter protocolo</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelarProtocolo}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Sim, cancelar protocolo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          </div>
        )}
      />

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
            <p className="text-sm font-medium text-slate-500">Responsável</p>
            <p className="text-base text-slate-900">{protocolo.responsavel_inicio}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Status</p>
            <div className="text-base text-slate-900">
              {isPasso1Aberto ? (
                <Badge variant="default">1º Passo</Badge>
              ) : (
                <Badge variant="secondary">1º Passo Concluído</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receptoras do Protocolo ({receptoras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brinco</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500">
                    Nenhuma receptora adicionada ao protocolo
                  </TableCell>
                </TableRow>
              ) : (
                receptoras.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.pr_status === 'INICIADA' ? 'Em Sincronização' : r.pr_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{r.pr_observacoes || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo do 1º Passo Modal */}
      <Dialog open={showResumoPasso1} onOpenChange={setShowResumoPasso1}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Resumo do 1º Passo
            </DialogTitle>
            <DialogDescription>
              1º passo concluído com sucesso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-500">Fazenda</p>
                <p className="text-base text-slate-900">{fazendaNome}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Data do 1º Passo</p>
                <p className="text-base text-slate-900">
                  {protocolo && formatDate(protocolo.data_inicio)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Responsável</p>
                <p className="text-base text-slate-900">{protocolo?.responsavel_inicio}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total de Receptoras</p>
                <p className="text-base text-slate-900 font-bold">{receptoras.length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Receptoras em Sincronização:</p>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Nome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptoras.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.identificacao}</TableCell>
                        <TableCell>{r.nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Próximo passo:</strong> Acesse a aba "2º Passo (para confirmar)" na tela de Protocolos e clique em "INICIAR 2º PASSO" para revisar e confirmar as receptoras.
              </p>
            </div>

            <Button
              onClick={handleCloseResumoPasso1}
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