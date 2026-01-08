import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { calcularStatusReceptora } from '@/lib/receptoraStatus';
import type { Fazenda, Receptora } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Plus, UserPlus, Lock, X } from 'lucide-react';

interface ReceptoraLocal {
  id?: string; // undefined se for nova (ainda não criada)
  identificacao: string;
  nome?: string;
  observacoes?: string;
  isNew?: boolean; // true se for criada neste wizard
}

export default function ProtocoloFormWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isFinalizingRef = useRef(false); // Proteção contra multi-clique
  const [currentStep, setCurrentStep] = useState<'form' | 'receptoras'>('form');
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [receptorasDisponiveis, setReceptorasDisponiveis] = useState<Receptora[]>([]);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [showAddReceptora, setShowAddReceptora] = useState(false);
  const [showCreateReceptora, setShowCreateReceptora] = useState(false);
  
  // Estado local do protocolo (não salvo no banco ainda)
  const [protocoloData, setProtocoloData] = useState({
    fazenda_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    veterinario: '',
    tecnico: '',
    observacoes: '',
  });
  
  const [receptorasLocais, setReceptorasLocais] = useState<ReceptoraLocal[]>([]);
  
  // Forms
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
    loadFazendas();
  }, []);

  useEffect(() => {
    if (currentStep === 'receptoras' && protocoloData.fazenda_id) {
      loadReceptorasDisponiveis(protocoloData.fazenda_id);
    }
  }, [currentStep, protocoloData.fazenda_id]);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const loadReceptorasDisponiveis = async (fazendaId: string) => {
    try {
      const { data: allReceptoras, error: allError } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome')
        .eq('fazenda_atual_id', fazendaId)
        .order('identificacao', { ascending: true });

      if (allError) throw allError;

      const receptorasJaAdicionadas = receptorasLocais
        .filter(r => r.id)
        .map(r => r.id!);

      const disponiveisPromises = (allReceptoras || [])
        .filter(r => !receptorasJaAdicionadas.includes(r.id))
        .map(async (r) => {
          const status = await calcularStatusReceptora(r.id);
          return status === 'VAZIA' ? r : null;
        });

      const disponiveisResults = await Promise.all(disponiveisPromises);
      const disponiveis = disponiveisResults.filter((r): r is Receptora => r !== null);

      setReceptorasDisponiveis(disponiveis);
    } catch (error) {
      console.error('Error loading receptoras disponiveis:', error);
    }
  };

  const handleContinueToReceptoras = () => {
    if (!protocoloData.fazenda_id || !protocoloData.data_inicio || 
        !protocoloData.veterinario.trim() || !protocoloData.tecnico.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Fazenda, data de início, veterinário e técnico são obrigatórios',
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep('receptoras');
  };

  const handleAddReceptora = () => {
    if (!addReceptoraForm.receptora_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma receptora',
        variant: 'destructive',
      });
      return;
    }

    const receptora = receptorasDisponiveis.find(r => r.id === addReceptoraForm.receptora_id);
    if (!receptora) return;

    // Verificar se já está na lista (proteção)
    if (receptorasLocais.some(r => r.id === receptora.id)) {
      toast({
        title: 'Receptora já adicionada',
        description: 'Esta receptora já está na lista',
        variant: 'destructive',
      });
      return;
    }

    setReceptorasLocais([
      ...receptorasLocais,
      {
        id: receptora.id,
        identificacao: receptora.identificacao,
        nome: receptora.nome,
        observacoes: addReceptoraForm.observacoes || undefined,
      },
    ]);

    setAddReceptoraForm({ receptora_id: '', observacoes: '' });
    setShowAddReceptora(false);
    
    // Recarregar receptoras disponíveis (remove a adicionada)
    loadReceptorasDisponiveis(protocoloData.fazenda_id);
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

      const receptoraData: Record<string, string> = {
        identificacao: createReceptoraForm.identificacao,
        fazenda_atual_id: protocoloData.fazenda_id,
      };

      if (createReceptoraForm.nome.trim()) {
        receptoraData.nome = createReceptoraForm.nome;
      }

      const { data: novaReceptora, error: receptoraError } = await supabase
        .from('receptoras')
        .insert([receptoraData])
        .select()
        .single();

      if (receptoraError) {
        if (receptoraError.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw receptoraError;
      }

      setReceptorasLocais([
        ...receptorasLocais,
        {
          id: novaReceptora.id,
          identificacao: novaReceptora.identificacao,
          nome: novaReceptora.nome,
          observacoes: createReceptoraForm.observacoes || undefined,
          isNew: true,
        },
      ]);

      setCreateReceptoraForm({
        identificacao: '',
        nome: '',
        observacoes: '',
      });
      setShowCreateReceptora(false);
      
      // Recarregar receptoras disponíveis
      loadReceptorasDisponiveis(protocoloData.fazenda_id);
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

  const handleRemoveReceptora = (index: number) => {
    const removida = receptorasLocais[index];
    setReceptorasLocais(receptorasLocais.filter((_, i) => i !== index));
    
    // Se era nova e ainda não foi salva, não precisa recarregar
    // Se já existia, recarregar disponíveis
    if (removida.id && !removida.isNew) {
      loadReceptorasDisponiveis(protocoloData.fazenda_id);
    }
  };

  const handleFinalizarPasso1 = async () => {
    // Proteção contra multi-clique
    if (isFinalizingRef.current || submitting) {
      return;
    }

    // Validação: deve ter pelo menos 1 receptora
    if (receptorasLocais.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Adicione pelo menos 1 receptora antes de finalizar o 1º passo',
        variant: 'destructive',
      });
      return;
    }

    // Validação: todos os IDs de receptoras devem ser válidos
    const receptorasIdsInvalidas = receptorasLocais.filter(
      r => !r.id || r.id === '' || r.id === null || r.id === undefined
    );

    if (receptorasIdsInvalidas.length > 0) {
      console.error('Receptoras com IDs inválidos:', receptorasIdsInvalidas);
      toast({
        title: 'Erro de validação',
        description: 'Seleção de receptora inválida. Refaça a seleção.',
        variant: 'destructive',
      });
      return;
    }

    // Extrair IDs válidos e observações correspondentes (mantendo ordem)
    const receptorasValidas = receptorasLocais.filter(
      r => r.id && r.id !== '' && r.id !== null && r.id !== undefined
    );

    if (receptorasValidas.length !== receptorasLocais.length || receptorasValidas.length === 0) {
      console.error('Receptoras inválidas ou nenhuma válida após validação');
      toast({
        title: 'Erro de validação',
        description: 'Seleção de receptora inválida. Refaça a seleção.',
        variant: 'destructive',
      });
      return;
    }

    const receptorasIds = receptorasValidas.map(r => r.id!);
    const receptorasObservacoes = receptorasValidas.map(r => r.observacoes || null);

    try {
      isFinalizingRef.current = true;
      setSubmitting(true);

      // Usar RPC atômica para criar protocolo + vínculos em transação
      const responsavel_inicio = `VET: ${protocoloData.veterinario.trim()} | TEC: ${protocoloData.tecnico.trim()}`;
      
      const { data: protocoloId, error: rpcError } = await supabase.rpc(
        'criar_protocolo_passo1_atomico',
        {
          p_fazenda_id: protocoloData.fazenda_id,
          p_data_inicio: protocoloData.data_inicio,
          p_responsavel_inicio: responsavel_inicio,
          p_receptoras_ids: receptorasIds,
          p_fazenda_atual_id: protocoloData.fazenda_id,
          p_data_inclusao: protocoloData.data_inicio,
          p_observacoes: protocoloData.observacoes.trim() || null,
          p_receptoras_observacoes: receptorasObservacoes,
        }
      );

      if (rpcError) {
        console.error('Erro ao criar protocolo (RPC):', rpcError);
        throw rpcError;
      }

      if (!protocoloId) {
        throw new Error('Protocolo criado mas ID não retornado');
      }

      toast({
        title: 'Protocolo criado com sucesso',
        description: `${receptorasLocais.length} receptoras adicionadas ao protocolo`,
      });

      // Navegar após sucesso
      navigate('/protocolos');
    } catch (error) {
      console.error('Erro ao finalizar protocolo:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Erro desconhecido ao finalizar protocolo';
      
      toast({
        title: 'Erro ao finalizar protocolo',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isFinalizingRef.current = false;
    }
  };

  const handleVoltar = () => {
    if (currentStep === 'form') {
      // Se está no primeiro passo, apenas volta
      navigate('/protocolos');
    } else {
      // Se está no passo de receptoras, volta para o formulário
      setCurrentStep('form');
    }
  };

  const handleSair = () => {
    if (protocoloData.fazenda_id || receptorasLocais.length > 0) {
      setShowConfirmExit(true);
    } else {
      navigate('/protocolos');
    }
  };

  const handleConfirmExit = () => {
    setShowConfirmExit(false);
    navigate('/protocolos');
  };

  if (currentStep === 'form') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleSair}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Novo Protocolo</h1>
              <p className="text-slate-600 mt-1">Primeira visita - Cadastrar novo protocolo de sincronização</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Protocolo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">Fazenda *</Label>
                <Select
                  value={protocoloData.fazenda_id}
                  onValueChange={(value) => setProtocoloData({ ...protocoloData, fazenda_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {fazendas.map((fazenda) => (
                      <SelectItem key={fazenda.id} value={fazenda.id}>
                        {fazenda.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data de Início *</Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={protocoloData.data_inicio}
                  onChange={(e) => setProtocoloData({ ...protocoloData, data_inicio: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="veterinario">Veterinário Responsável *</Label>
                <Input
                  id="veterinario"
                  value={protocoloData.veterinario}
                  onChange={(e) =>
                    setProtocoloData({ ...protocoloData, veterinario: e.target.value })
                  }
                  placeholder="Nome do veterinário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tecnico">Técnico Responsável *</Label>
                <Input
                  id="tecnico"
                  value={protocoloData.tecnico}
                  onChange={(e) =>
                    setProtocoloData({ ...protocoloData, tecnico: e.target.value })
                  }
                  placeholder="Nome do técnico/funcionário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={protocoloData.observacoes}
                  onChange={(e) => setProtocoloData({ ...protocoloData, observacoes: e.target.value })}
                  placeholder="Observações sobre o protocolo"
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleContinueToReceptoras}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  Continuar para Receptoras
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSair}
                  disabled={loading}
                >
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair sem finalizar?</AlertDialogTitle>
              <AlertDialogDescription>
                Se você sair agora, nenhum protocolo será criado. Todos os dados preenchidos serão perdidos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmExit}>Sim, sair</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Step 2: Receptoras
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleVoltar}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Adicionar Receptoras</h1>
            <p className="text-slate-600 mt-1">Selecione as receptoras para este protocolo</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleSair}>
          <X className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Fazenda</p>
            <p className="text-base text-slate-900">
              {fazendas.find(f => f.id === protocoloData.fazenda_id)?.nome || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Data Início</p>
            <p className="text-base text-slate-900">{protocoloData.data_inicio}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Veterinário</p>
            <p className="text-base text-slate-900">{protocoloData.veterinario}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Técnico</p>
            <p className="text-base text-slate-900">{protocoloData.tecnico}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Receptoras do Protocolo ({receptorasLocais.length})</CardTitle>
            <div className="flex gap-2">
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
                      Selecione uma receptora VAZIA da fazenda ou cadastre uma nova
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
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
                            receptorasDisponiveis
                              .filter(r => r.id && r.id !== '' && r.id !== null && r.id !== undefined)
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id!}>
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
                      disabled={receptorasDisponiveis.length === 0}
                    >
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showCreateReceptora} onOpenChange={setShowCreateReceptora}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Cadastrar Nova
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Nova Receptora</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
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
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {receptorasLocais.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma receptora adicionada. Adicione pelo menos uma antes de finalizar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receptorasLocais.map((r, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell>{r.nome || '-'}</TableCell>
                    <TableCell>{r.observacoes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReceptora(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          onClick={handleFinalizarPasso1}
          disabled={receptorasLocais.length === 0 || submitting || isFinalizingRef.current}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Lock className="w-4 h-4 mr-2" />
          {submitting || isFinalizingRef.current ? 'Finalizando...' : 'Finalizar 1º Passo'}
        </Button>
        <Button variant="outline" onClick={handleVoltar} disabled={submitting || isFinalizingRef.current}>
          Voltar
        </Button>
      </div>

      <AlertDialog open={showConfirmExit} onOpenChange={setShowConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem finalizar?</AlertDialogTitle>
            <AlertDialogDescription>
              Se você sair agora, nenhum protocolo será criado. Todos os dados preenchidos serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExit}>Sim, sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
