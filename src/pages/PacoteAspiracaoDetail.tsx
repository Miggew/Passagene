import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, AspiracaoDoadora, Doadora, Fazenda } from '@/lib/types';
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
import { ArrowLeft, Plus, UserPlus, Lock, Edit } from 'lucide-react';

interface AspiracaoDoadoraComNome extends AspiracaoDoadora {
  doadora_nome?: string;
  doadora_registro?: string;
}

export default function PacoteAspiracaoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pacote, setPacote] = useState<PacoteAspiracao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [aspiracoes, setAspiracoes] = useState<AspiracaoDoadoraComNome[]>([]);
  const [doadorasDisponiveis, setDoadorasDisponiveis] = useState<Doadora[]>([]);
  const isAddingDoadoraRef = useRef(false);

  // Dialog states
  const [showAddDoadora, setShowAddDoadora] = useState(false);
  const [showCreateDoadora, setShowCreateDoadora] = useState(false);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [showEditAspiracao, setShowEditAspiracao] = useState(false);
  const [aspiracaoEditando, setAspiracaoEditando] = useState<AspiracaoDoadoraComNome | null>(null);
  const [showConfirmZeroOocitos, setShowConfirmZeroOocitos] = useState(false);
  const [pendingAddAction, setPendingAddAction] = useState<'add' | 'create' | null>(null);
  const [showEditPacote, setShowEditPacote] = useState(false);
  const [editPacoteForm, setEditPacoteForm] = useState({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Form states
  const [addDoadoraForm, setAddDoadoraForm] = useState({
    doadora_id: '',
    horario_aspiracao: '',
    hora_final: '',
    atresicos: '',
    degenerados: '',
    expandidos: '',
    desnudos: '',
    viaveis: '',
    recomendacao_touro: '',
    observacoes: '',
  });

  const [createDoadoraForm, setCreateDoadoraForm] = useState({
    registro: '',
    raca: '',
    racaCustom: '',
  });

  const [editAspiracaoForm, setEditAspiracaoForm] = useState({
    horario_aspiracao: '',
    hora_final: '',
    atresicos: '',
    degenerados: '',
    expandidos: '',
    desnudos: '',
    viaveis: '',
    recomendacao_touro: '',
    observacoes: '',
  });

  const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];
  const [racaSelecionada, setRacaSelecionada] = useState<string>('');

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacote
      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', id)
        .single();

      if (pacoteError) throw pacoteError;
      setPacote(pacoteData);
      setEditPacoteForm({
        veterinario_responsavel: pacoteData.veterinario_responsavel || '',
        tecnico_responsavel: pacoteData.tecnico_responsavel || '',
      });

      // Load fazenda da aspiração
      const { data: fazendaData, error: fazendaError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', pacoteData.fazenda_id)
        .single();

      if (fazendaError) throw fazendaError;
      setFazendaNome(fazendaData.nome);

      // Load múltiplas fazendas destino
      const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('fazenda_destino_id')
        .eq('pacote_aspiracao_id', id);

      if (fazendasDestinoError) {
        // Se der erro (tabela pode não existir), usar legacy
        console.warn('Erro ao carregar fazendas destino:', fazendasDestinoError);
      }

      // Se não houver na tabela de relacionamento, usar a fazenda_destino_id legacy
      if (!fazendasDestinoData || fazendasDestinoData.length === 0) {
        if (pacoteData.fazenda_destino_id) {
          const { data: fazendaDestinoLegacy, error: legacyError } = await supabase
            .from('fazendas')
            .select('nome')
            .eq('id', pacoteData.fazenda_destino_id)
            .single();
          if (!legacyError && fazendaDestinoLegacy) {
            setFazendasDestinoNomes([fazendaDestinoLegacy.nome]);
          }
        }
      } else {
        // Buscar nomes das fazendas destino
        const fazendaDestinoIds = fazendasDestinoData.map((item) => item.fazenda_destino_id);
        const { data: fazendasData, error: fazendasError } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaDestinoIds);

        if (!fazendasError && fazendasData) {
          const nomes = fazendasData.map((f) => f.nome).filter(Boolean);
          setFazendasDestinoNomes(nomes);
        }
      }

      // Load aspiracoes primeiro para poder filtrar doadoras
      await loadAspiracoes();

      // Load available doadoras from pacote's fazenda (após carregar aspirações para filtrar)
      if (pacoteData.status === 'EM_ANDAMENTO') {
        await loadDoadorasDisponiveis(pacoteData.fazenda_id);
      }
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

  const loadAspiracoes = async () => {
    try {
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('*')
        .eq('pacote_aspiracao_id', id)
        .order('created_at', { ascending: true });

      if (aspiracoesError) throw aspiracoesError;

      if (!aspiracoesData || aspiracoesData.length === 0) {
        setAspiracoes([]);
        return;
      }

      // Buscar dados das doadoras
      const doadoraIds = aspiracoesData.map(a => a.doadora_id);
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, registro, nome')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      const doadorasMap = new Map(doadorasData?.map(d => [d.id, d]) || []);

      const aspiracoesComNome: AspiracaoDoadoraComNome[] = aspiracoesData.map(a => {
        const doadora = doadorasMap.get(a.doadora_id);
        return {
          ...a,
          doadora_nome: doadora?.nome,
          doadora_registro: doadora?.registro,
        };
      });

      setAspiracoes(aspiracoesComNome);
    } catch (error) {
      console.error('Error loading aspiracoes:', error);
    }
  };

  const loadDoadorasDisponiveis = async (fazendaId: string) => {
    try {
      // Buscar aspirações diretamente do banco para garantir dados atualizados
      const { data: aspiracoesAtuais, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('doadora_id')
        .eq('pacote_aspiracao_id', id);

      if (aspiracoesError) {
        console.error('Error loading aspiracoes for filtering:', aspiracoesError);
      }

      const doadoraIdsJaAdicionadas = new Set(aspiracoesAtuais?.map(a => a.doadora_id) || []);

      const { data, error } = await supabase
        .from('doadoras')
        .select('id, registro, nome')
        .eq('fazenda_id', fazendaId)
        .order('registro', { ascending: true });

      if (error) throw error;

      // Filtrar doadoras já adicionadas
      const disponiveis = (data || []).filter(d => !doadoraIdsJaAdicionadas.has(d.id));

      setDoadorasDisponiveis(disponiveis);
    } catch (error) {
      console.error('Error loading doadoras disponiveis:', error);
    }
  };

  const calculateTotal = (data: { atresicos: string; degenerados: string; expandidos: string; desnudos: string; viaveis: string }) => {
    const atresicos = parseInt(data.atresicos) || 0;
    const degenerados = parseInt(data.degenerados) || 0;
    const expandidos = parseInt(data.expandidos) || 0;
    const desnudos = parseInt(data.desnudos) || 0;
    const viaveis = parseInt(data.viaveis) || 0;
    return atresicos + degenerados + expandidos + desnudos + viaveis;
  };

  const totalOocitos = aspiracoes.reduce((sum, a) => sum + (a.total_oocitos || 0), 0);

  // Função auxiliar para adicionar horas a um horário
  const adicionarHoras = (horario: string, horas: number): string => {
    if (!horario) return '';
    const [h, m] = horario.split(':').map(Number);
    const totalMinutos = h * 60 + m + horas * 60;
    const novaHora = Math.floor(totalMinutos / 60) % 24;
    const novoMinuto = totalMinutos % 60;
    return `${String(novaHora).padStart(2, '0')}:${String(novoMinuto).padStart(2, '0')}`;
  };

  // Efeito para recarregar doadoras disponíveis e definir horário automático quando abrir dialog de adicionar doadora
  useEffect(() => {
    if (showAddDoadora && pacote) {
      // Recarregar doadoras disponíveis sempre que abrir o dialog para garantir lista atualizada
      loadDoadorasDisponiveis(pacote.fazenda_id);
      
      if (aspiracoes.length > 0) {
        // Se já existem aspirações, usar horário final da última
        const ultimaAspiracao = aspiracoes[aspiracoes.length - 1];
        if (ultimaAspiracao.hora_final) {
          setAddDoadoraForm((prev) => ({
            ...prev,
            horario_aspiracao: ultimaAspiracao.hora_final || '',
            hora_final: adicionarHoras(ultimaAspiracao.hora_final || '', 1), // Pré-preenche +1 hora
          }));
        }
      } else {
        // Se for a primeira doadora, usar horário de início do pacote
        if (pacote?.horario_inicio) {
          setAddDoadoraForm((prev) => ({
            ...prev,
            horario_aspiracao: pacote.horario_inicio || '',
            hora_final: adicionarHoras(pacote.horario_inicio || '', 1), // Pré-preenche +1 hora
          }));
        }
      }
    }
  }, [showAddDoadora, aspiracoes, pacote]);

  const handleAddDoadora = async () => {
    if (submitting || isAddingDoadoraRef.current) return;

    if (!addDoadoraForm.doadora_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma doadora',
        variant: 'destructive',
      });
      return;
    }

    if (!addDoadoraForm.hora_final.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Hora final é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se o pacote tem veterinário e técnico preenchidos
    if (!pacote?.veterinario_responsavel || !pacote?.tecnico_responsavel) {
      toast({
        title: 'Erro de validação',
        description: 'A aspiração deve ter veterinário e técnico responsáveis preenchidos. Por favor, edite a aspiração primeiro.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se a doadora já está no pacote
    const doadoraJaNoPacote = aspiracoes.find((a) => a.doadora_id === addDoadoraForm.doadora_id);
    if (doadoraJaNoPacote) {
      toast({
        title: 'Erro',
        description: 'Esta doadora já foi aspirada nesta aspiração',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se total de oócitos é zero
    const total = calculateTotal(addDoadoraForm);
    if (total === 0) {
      setPendingAddAction('add');
      setShowConfirmZeroOocitos(true);
      return;
    }

    await executeAddDoadora();
  };

  const executeAddDoadora = async () => {
    if (submitting || isAddingDoadoraRef.current) return;

    try {
      isAddingDoadoraRef.current = true;
      setSubmitting(true);

      const total = calculateTotal(addDoadoraForm);

      const insertData = {
        pacote_aspiracao_id: id,
        doadora_id: addDoadoraForm.doadora_id,
        fazenda_id: pacote!.fazenda_id,
        data_aspiracao: pacote!.data_aspiracao,
        horario_aspiracao: addDoadoraForm.horario_aspiracao || null,
        hora_final: addDoadoraForm.hora_final,
        atresicos: parseInt(addDoadoraForm.atresicos) || 0,
        degenerados: parseInt(addDoadoraForm.degenerados) || 0,
        expandidos: parseInt(addDoadoraForm.expandidos) || 0,
        desnudos: parseInt(addDoadoraForm.desnudos) || 0,
        viaveis: parseInt(addDoadoraForm.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: pacote!.veterinario_responsavel!,
        tecnico_responsavel: pacote!.tecnico_responsavel!,
        recomendacao_touro: addDoadoraForm.recomendacao_touro.trim() || null,
        observacoes: addDoadoraForm.observacoes.trim() || null,
      };

      const { error } = await supabase.from('aspiracoes_doadoras').insert([insertData]);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Erro',
            description: 'Esta doadora já foi aspirada nesta aspiração',
            variant: 'destructive',
          });
          setSubmitting(false);
          isAddingDoadoraRef.current = false;
          loadData();
          return;
        }
        throw error;
      }

      // Atualizar total do pacote
      const novoTotal = totalOocitos + total;
      await supabase
        .from('pacotes_aspiracao')
        .update({ total_oocitos: novoTotal })
        .eq('id', id);

      toast({
        title: 'Doadora adicionada',
        description: 'Doadora adicionada à aspiração com sucesso',
      });

      setShowAddDoadora(false);
      setAddDoadoraForm({
        doadora_id: '',
        horario_aspiracao: '',
        hora_final: '',
        atresicos: '',
        degenerados: '',
        expandidos: '',
        desnudos: '',
        viaveis: '',
        recomendacao_touro: '',
        observacoes: '',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar doadora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isAddingDoadoraRef.current = false;
    }
  };

  const handleCreateDoadora = async () => {
    if (!createDoadoraForm.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    const racaFinal = racaSelecionada === 'Outra' ? createDoadoraForm.racaCustom.trim() : createDoadoraForm.raca.trim();
    if (!racaFinal) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return;
    }

      if (!addDoadoraForm.hora_final.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Hora final é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se o pacote tem veterinário e técnico preenchidos
    if (!pacote?.veterinario_responsavel || !pacote?.tecnico_responsavel) {
      toast({
        title: 'Erro de validação',
        description: 'A aspiração deve ter veterinário e técnico responsáveis preenchidos. Por favor, edite a aspiração primeiro.',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se total de oócitos é zero
    const total = calculateTotal(addDoadoraForm);
    if (total === 0) {
      setPendingAddAction('create');
      setShowConfirmZeroOocitos(true);
      return;
    }

    await executeCreateDoadora();
  };

  const executeCreateDoadora = async () => {
    try {
      setSubmitting(true);

      const racaFinal = racaSelecionada === 'Outra' ? createDoadoraForm.racaCustom.trim() : createDoadoraForm.raca.trim();

      // Verificar se já existe uma doadora com o mesmo registro (case-insensitive) e mesma raça (globalmente)
      const registroNormalizado = createDoadoraForm.registro.trim().toUpperCase();
      const { data: doadorasExistentes, error: checkError } = await supabase
        .from('doadoras')
        .select('id, registro, raca')
        .ilike('registro', registroNormalizado)
        .eq('raca', racaFinal);

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (doadorasExistentes && doadorasExistentes.length > 0) {
        toast({
          title: 'Erro',
          description: `Já existe uma doadora com o registro ${createDoadoraForm.registro.trim()} e raça ${racaFinal}`,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const doadoraData: Record<string, string> = {
        fazenda_id: pacote!.fazenda_id,
        registro: registroNormalizado, // Salvar normalizado em maiúsculas
        raca: racaFinal,
      };

      const { data: novaDoadora, error: doadoraError } = await supabase
        .from('doadoras')
        .insert([doadoraData])
        .select()
        .single();

      if (doadoraError) {
        if (doadoraError.code === '23505') {
          toast({
            title: 'Erro',
            description: `Já existe uma doadora com o registro ${createDoadoraForm.registro.trim()} nesta fazenda`,
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }
        throw doadoraError;
      }

      // Adicionar ao pacote imediatamente
      const total = calculateTotal(addDoadoraForm);

      const insertData = {
        pacote_aspiracao_id: id,
        doadora_id: novaDoadora.id,
        fazenda_id: pacote!.fazenda_id,
        data_aspiracao: pacote!.data_aspiracao,
        horario_aspiracao: addDoadoraForm.horario_aspiracao || null,
        hora_final: addDoadoraForm.hora_final,
        atresicos: parseInt(addDoadoraForm.atresicos) || 0,
        degenerados: parseInt(addDoadoraForm.degenerados) || 0,
        expandidos: parseInt(addDoadoraForm.expandidos) || 0,
        desnudos: parseInt(addDoadoraForm.desnudos) || 0,
        viaveis: parseInt(addDoadoraForm.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: pacote!.veterinario_responsavel!,
        tecnico_responsavel: pacote!.tecnico_responsavel!,
        recomendacao_touro: addDoadoraForm.recomendacao_touro.trim() || null,
        observacoes: addDoadoraForm.observacoes.trim() || null,
      };

      const { error: aspiracaoError } = await supabase.from('aspiracoes_doadoras').insert([insertData]);

      if (aspiracaoError) {
        if (aspiracaoError.code === '23505') {
          toast({
            title: 'Erro',
            description: 'Esta doadora já foi aspirada nesta aspiração',
            variant: 'destructive',
          });
          setSubmitting(false);
          loadData();
          return;
        }
        throw aspiracaoError;
      }

      // Atualizar total do pacote
      const novoTotal = totalOocitos + total;
      await supabase
        .from('pacotes_aspiracao')
        .update({ total_oocitos: novoTotal })
        .eq('id', id);

      toast({
        title: 'Doadora criada e adicionada',
        description: 'Doadora criada e adicionada à aspiração com sucesso',
      });

      setShowCreateDoadora(false);
      setCreateDoadoraForm({
        registro: '',
        raca: '',
        racaCustom: '',
      });
      setRacaSelecionada('');
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao criar doadora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAspiracao = (aspiracao: AspiracaoDoadoraComNome) => {
    setAspiracaoEditando(aspiracao);
    setEditAspiracaoForm({
      horario_aspiracao: aspiracao.horario_aspiracao || '',
      hora_final: aspiracao.hora_final || '',
      atresicos: aspiracao.atresicos?.toString() || '',
      degenerados: aspiracao.degenerados?.toString() || '',
      expandidos: aspiracao.expandidos?.toString() || '',
      desnudos: aspiracao.desnudos?.toString() || '',
      viaveis: aspiracao.viaveis?.toString() || '',
      recomendacao_touro: aspiracao.recomendacao_touro || '',
      observacoes: aspiracao.observacoes || '',
    });
    setShowEditAspiracao(true);
  };

  const handleSaveEditAspiracao = async () => {
    if (!aspiracaoEditando) return;

    if (!editAspiracaoForm.hora_final.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Hora final é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const total = calculateTotal(editAspiracaoForm);
      const totalAnterior = aspiracaoEditando.total_oocitos || 0;
      const diferencaTotal = total - totalAnterior;

      const updateData = {
        horario_aspiracao: editAspiracaoForm.horario_aspiracao || null,
        hora_final: editAspiracaoForm.hora_final,
        atresicos: parseInt(editAspiracaoForm.atresicos) || 0,
        degenerados: parseInt(editAspiracaoForm.degenerados) || 0,
        expandidos: parseInt(editAspiracaoForm.expandidos) || 0,
        desnudos: parseInt(editAspiracaoForm.desnudos) || 0,
        viaveis: parseInt(editAspiracaoForm.viaveis) || 0,
        total_oocitos: total,
        recomendacao_touro: editAspiracaoForm.recomendacao_touro.trim() || null,
        observacoes: editAspiracaoForm.observacoes.trim() || null,
      };

      const { error } = await supabase
        .from('aspiracoes_doadoras')
        .update(updateData)
        .eq('id', aspiracaoEditando.id);

      if (error) throw error;

      // Atualizar total do pacote
      const novoTotal = totalOocitos + diferencaTotal;
      await supabase
        .from('pacotes_aspiracao')
        .update({ total_oocitos: novoTotal })
        .eq('id', id);

      toast({
        title: 'Aspiração atualizada',
        description: 'Aspiração da doadora atualizada com sucesso',
      });

      setShowEditAspiracao(false);
      setAspiracaoEditando(null);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEditPacote = async () => {
    if (!editPacoteForm.veterinario_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!editPacoteForm.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Técnico responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('pacotes_aspiracao')
        .update({
          veterinario_responsavel: editPacoteForm.veterinario_responsavel.trim(),
          tecnico_responsavel: editPacoteForm.tecnico_responsavel.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Aspiração atualizada',
        description: 'Informações da aspiração atualizadas com sucesso',
      });

      setShowEditPacote(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizar = async () => {
    try {
      setSubmitting(true);

      // Atualizar status para FINALIZADO
      const { error } = await supabase
        .from('pacotes_aspiracao')
        .update({ status: 'FINALIZADO', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Aspiração finalizada',
        description: 'Aspiração finalizada com sucesso',
      });

      setShowFinalizarDialog(false);
      navigate('/aspiracoes');
    } catch (error) {
      toast({
        title: 'Erro ao finalizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!pacote) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Aspiração não encontrada"
          description="Volte para a lista e selecione outra aspiração."
          action={(
            <Button onClick={() => navigate('/aspiracoes')} variant="outline">
              Voltar para Aspirações
            </Button>
          )}
        />
      </div>
    );
  }

  const isFinalizado = pacote.status === 'FINALIZADO';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Aspiração - ${fazendaNome}`}
        description={isFinalizado ? 'Aspiração finalizada' : 'Gerenciar doadoras da aspiração'}
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('/aspiracoes')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {!isFinalizado && (
              <Button
                onClick={() => setShowFinalizarDialog(true)}
                disabled={submitting || aspiracoes.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Lock className="w-4 h-4 mr-2" />
                {submitting ? 'Finalizando...' : 'Finalizar Pacote'}
              </Button>
            )}
          </div>
        )}
      />

      {/* Informações da Aspiração */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informações da Aspiração</CardTitle>
            {!isFinalizado && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditPacote(true)}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-500">Fazenda da Aspiração</Label>
              <p className="font-medium">{fazendaNome}</p>
            </div>
            <div className="col-span-2">
              <Label className="text-slate-500">Fazendas Destino</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {fazendasDestinoNomes.length > 0 ? (
                  fazendasDestinoNomes.map((nome, index) => (
                    <Badge key={index} variant="outline" className="font-medium">
                      {nome}
                    </Badge>
                  ))
                ) : (
                  <p className="font-medium text-slate-400">-</p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-slate-500">Data da Aspiração</Label>
              <p className="font-medium">{formatDate(pacote.data_aspiracao)}</p>
            </div>
            <div>
              <Label className="text-slate-500">Horário de Início</Label>
              <p className="font-medium">{pacote.horario_inicio || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-500">Veterinário Responsável</Label>
              <p className="font-medium">{pacote.veterinario_responsavel || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-500">Técnico Responsável</Label>
              <p className="font-medium">{pacote.tecnico_responsavel || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-500">Status</Label>
              <div>
                <Badge variant={isFinalizado ? 'default' : 'secondary'}>
                  {isFinalizado ? 'FINALIZADO' : 'EM ANDAMENTO'}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-slate-500">Total de Oócitos</Label>
              <p className="font-medium text-lg">{totalOocitos}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Doadoras */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Doadoras Aspiradas ({aspiracoes.length})</CardTitle>
            {!isFinalizado && (
              <Dialog
                open={showAddDoadora}
                onOpenChange={(open) => {
                  setShowAddDoadora(open);
                  if (!open) {
                    // Resetar formulário ao fechar
                    setAddDoadoraForm({
                      doadora_id: '',
                      horario_aspiracao: '',
                      hora_final: '',
                      atresicos: '',
                      degenerados: '',
                      expandidos: '',
                      desnudos: '',
                      viaveis: '',
                      recomendacao_touro: '',
                      observacoes: '',
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Doadora
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Adicionar Doadora à Aspiração</DialogTitle>
                    <DialogDescription>
                      Selecione uma doadora existente ou cadastre uma nova
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing">Doadora Existente</TabsTrigger>
                      <TabsTrigger value="new">Cadastrar Nova</TabsTrigger>
                    </TabsList>
                    <TabsContent value="existing" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Doadora *</Label>
                        <Select
                          value={addDoadoraForm.doadora_id}
                          onValueChange={(value) => setAddDoadoraForm({ ...addDoadoraForm, doadora_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma doadora" />
                          </SelectTrigger>
                          <SelectContent>
                            {doadorasDisponiveis.length === 0 ? (
                              <div className="p-2 text-sm text-slate-500">
                                Nenhuma doadora disponível nesta fazenda
                              </div>
                            ) : (
                              doadorasDisponiveis.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.registro} {d.nome ? `- ${d.nome}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Horário de Aspiração</Label>
                          <Input
                            type="time"
                            value={addDoadoraForm.horario_aspiracao}
                            onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, horario_aspiracao: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Final *</Label>
                          <Input
                            type="time"
                            value={addDoadoraForm.hora_final}
                            onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, hora_final: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Atrésicos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.atresicos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, atresicos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Degenerados</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.degenerados}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, degenerados: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Expandidos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.expandidos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, expandidos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Desnudos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.desnudos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, desnudos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Viáveis</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.viaveis}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, viaveis: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <Input value={calculateTotal(addDoadoraForm)} disabled />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Recomendação de Touro</Label>
                        <Input
                          value={addDoadoraForm.recomendacao_touro}
                          onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, recomendacao_touro: e.target.value })}
                          placeholder="Recomendação de touro para esta doadora"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={addDoadoraForm.observacoes}
                          onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, observacoes: e.target.value })}
                          placeholder="Observações sobre esta aspiração"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={handleAddDoadora}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={submitting || doadorasDisponiveis.length === 0}
                      >
                        {submitting ? 'Adicionando...' : 'Adicionar'}
                      </Button>
                    </TabsContent>
                    <TabsContent value="new" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Registro *</Label>
                          <Input
                            value={createDoadoraForm.registro}
                            onChange={(e) => setCreateDoadoraForm({ ...createDoadoraForm, registro: e.target.value })}
                            placeholder="Registro da doadora"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Raça *</Label>
                          <Select
                            value={racaSelecionada}
                            onValueChange={(value) => {
                              setRacaSelecionada(value);
                              if (value === 'Outra') {
                                setCreateDoadoraForm({ ...createDoadoraForm, raca: '', racaCustom: '' });
                              } else {
                                setCreateDoadoraForm({ ...createDoadoraForm, raca: value, racaCustom: '' });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a raça" />
                            </SelectTrigger>
                            <SelectContent>
                              {racasPredefinidas.map((raca) => (
                                <SelectItem key={raca} value={raca}>
                                  {raca}
                                </SelectItem>
                              ))}
                              <SelectItem value="Outra">Outra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {racaSelecionada === 'Outra' && (
                          <div className="space-y-2">
                            <Label>Raça Customizada *</Label>
                            <Input
                              value={createDoadoraForm.racaCustom}
                              onChange={(e) => setCreateDoadoraForm({ ...createDoadoraForm, racaCustom: e.target.value })}
                              placeholder="Digite a raça"
                            />
                          </div>
                        )}
                      </div>

                      {/* Mesmos campos de oócitos, recomendação e observações */}
                      <div className="border-t pt-4">
                        <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Atrésicos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.atresicos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, atresicos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Degenerados</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.degenerados}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, degenerados: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Expandidos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.expandidos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, expandidos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Desnudos</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.desnudos}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, desnudos: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Viáveis</Label>
                            <Input
                              type="number"
                              min="0"
                              value={addDoadoraForm.viaveis}
                              onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, viaveis: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total</Label>
                            <Input value={calculateTotal(addDoadoraForm)} disabled />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Recomendação de Touro</Label>
                        <Input
                          value={addDoadoraForm.recomendacao_touro}
                          onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, recomendacao_touro: e.target.value })}
                          placeholder="Recomendação de touro para esta doadora"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Horário de Aspiração</Label>
                          <Input
                            type="time"
                            value={addDoadoraForm.horario_aspiracao}
                            onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, horario_aspiracao: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Final *</Label>
                          <Input
                            type="time"
                            value={addDoadoraForm.hora_final}
                            onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, hora_final: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={addDoadoraForm.observacoes}
                          onChange={(e) => setAddDoadoraForm({ ...addDoadoraForm, observacoes: e.target.value })}
                          placeholder="Observações sobre esta aspiração"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={handleCreateDoadora}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={submitting}
                      >
                        {submitting ? 'Criando...' : 'Criar e Adicionar'}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doadora</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Viáveis</TableHead>
                <TableHead>Total Oócitos</TableHead>
                <TableHead>Recomendação Touro</TableHead>
                <TableHead>Observações</TableHead>
                {!isFinalizado && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {aspiracoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isFinalizado ? 7 : 8} className="text-center text-slate-500">
                    Nenhuma doadora adicionada à aspiração
                  </TableCell>
                </TableRow>
              ) : (
                aspiracoes.map((aspiracao) => (
                  <TableRow key={aspiracao.id}>
                    <TableCell className="font-medium">
                      {aspiracao.doadora_nome || '-'}
                    </TableCell>
                    <TableCell>{aspiracao.doadora_registro || '-'}</TableCell>
                    <TableCell>
                      {aspiracao.horario_aspiracao
                        ? `${aspiracao.horario_aspiracao}${aspiracao.hora_final ? ` - ${aspiracao.hora_final}` : ''}`
                        : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{aspiracao.viaveis || 0}</TableCell>
                    <TableCell>{aspiracao.total_oocitos || 0}</TableCell>
                    <TableCell>{aspiracao.recomendacao_touro || '-'}</TableCell>
                    <TableCell>{aspiracao.observacoes || '-'}</TableCell>
                    {!isFinalizado && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAspiracao(aspiracao)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Edição de Aspiração */}
      <Dialog
        open={showEditAspiracao}
        onOpenChange={(open) => {
          setShowEditAspiracao(open);
          if (!open) {
            setAspiracaoEditando(null);
            setEditAspiracaoForm({
              horario_aspiracao: '',
              hora_final: '',
              atresicos: '',
              degenerados: '',
              expandidos: '',
              desnudos: '',
              viaveis: '',
              recomendacao_touro: '',
              observacoes: '',
            });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Aspiração - {aspiracaoEditando?.doadora_nome || aspiracaoEditando?.doadora_registro || 'Doadora'}
            </DialogTitle>
            <DialogDescription>
              Edite os dados da aspiração da doadora
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Aspiração</Label>
                <Input
                  type="time"
                  value={editAspiracaoForm.horario_aspiracao}
                  onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, horario_aspiracao: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Final *</Label>
                <Input
                  type="time"
                  value={editAspiracaoForm.hora_final}
                  onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, hora_final: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Atrésicos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editAspiracaoForm.atresicos}
                    onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, atresicos: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Degenerados</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editAspiracaoForm.degenerados}
                    onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, degenerados: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expandidos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editAspiracaoForm.expandidos}
                    onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, expandidos: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Desnudos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editAspiracaoForm.desnudos}
                    onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, desnudos: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Viáveis</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editAspiracaoForm.viaveis}
                    onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, viaveis: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input value={calculateTotal(editAspiracaoForm)} disabled />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Recomendação de Touro</Label>
              <Input
                value={editAspiracaoForm.recomendacao_touro}
                onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, recomendacao_touro: e.target.value })}
                placeholder="Recomendação de touro para esta doadora"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editAspiracaoForm.observacoes}
                onChange={(e) => setEditAspiracaoForm({ ...editAspiracaoForm, observacoes: e.target.value })}
                placeholder="Observações sobre esta aspiração"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditAspiracao(false);
                  setAspiracaoEditando(null);
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditAspiracao}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Zero Oócitos */}
      <AlertDialog open={showConfirmZeroOocitos} onOpenChange={setShowConfirmZeroOocitos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Adição de Doadora sem Oócitos</AlertDialogTitle>
            <AlertDialogDescription>
              Esta doadora não possui nenhum oócito (total = 0). Deseja realmente adicioná-la à aspiração?
              <br />
              <br />
              <strong>Atenção:</strong> Doadoras sem oócitos podem não ser úteis para o processo de FIV.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowConfirmZeroOocitos(false);
                if (pendingAddAction === 'add') {
                  await executeAddDoadora();
                } else if (pendingAddAction === 'create') {
                  await executeCreateDoadora();
                }
                setPendingAddAction(null);
              }}
              disabled={submitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? 'Adicionando...' : 'Sim, Adicionar Mesmo Assim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Edição da Aspiração */}
      <Dialog open={showEditPacote} onOpenChange={setShowEditPacote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Aspiração</DialogTitle>
            <DialogDescription>
              Atualize as informações da aspiração
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Veterinário Responsável *</Label>
              <Input
                value={editPacoteForm.veterinario_responsavel}
                onChange={(e) =>
                  setEditPacoteForm({ ...editPacoteForm, veterinario_responsavel: e.target.value })
                }
                placeholder="Nome do veterinário"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Técnico Responsável *</Label>
              <Input
                value={editPacoteForm.tecnico_responsavel}
                onChange={(e) =>
                  setEditPacoteForm({ ...editPacoteForm, tecnico_responsavel: e.target.value })
                }
                placeholder="Nome do técnico"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditPacote(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditPacote}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Finalização */}
      <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Aspiração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta aspiração? Esta ação não pode ser desfeita.
              <br />
              <br />
              <strong>Atenção:</strong> Após finalizar, a aspiração ficará apenas como histórico e não poderá ser editada.
              <br />
              <br />
              Total de oócitos na aspiração: <strong>{totalOocitos}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizar}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? 'Finalizando...' : 'Finalizar Aspiração'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
