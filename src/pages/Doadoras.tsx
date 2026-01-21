import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Doadora } from '@/lib/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Search, History, Star, Gem } from 'lucide-react';
import DoadoraHistoricoAspiracoes from '@/components/shared/DoadoraHistoricoAspiracoes';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Fazenda {
  id: string;
  nome: string;
}

interface DoadoraComAspiracao extends Doadora {
  ultima_aspiracao_total_oocitos?: number;
  ultima_aspiracao_data?: string;
}

export default function Doadoras() {
  const navigate = useNavigate();
  const [doadoras, setDoadoras] = useState<DoadoraComAspiracao[]>([]);
  const [filteredDoadoras, setFilteredDoadoras] = useState<DoadoraComAspiracao[]>([]);
  const [historicoDoadoraId, setHistoricoDoadoraId] = useState<string | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    registro: '',
    raca: '',
    racaCustom: '', // Para quando selecionar "Outra"
  });

  // Preparação para campos específicos por raça (será implementado depois)
  const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];
  const [racaSelecionada, setRacaSelecionada] = useState<string>('');

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (selectedFazendaId) {
      loadDoadoras();
    } else {
      setDoadoras([]);
      setFilteredDoadoras([]);
    }
  }, [selectedFazendaId]);

  useEffect(() => {
    filterDoadoras();
  }, [searchTerm, doadoras]);

  const filterDoadoras = () => {
    if (!searchTerm.trim()) {
      setFilteredDoadoras(doadoras);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = doadoras.filter(
      (d) =>
        d.nome?.toLowerCase().includes(term) ||
        d.registro?.toLowerCase().includes(term) ||
        d.raca?.toLowerCase().includes(term)
    );
    setFilteredDoadoras(filtered);
  };

  const loadFazendas = async () => {
    try {
      setLoading(true);
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDoadoras = async () => {
    try {
      setLoading(true);
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', selectedFazendaId)
        .order('created_at', { ascending: false });

      if (doadorasError) throw doadorasError;

      // Buscar últimas aspirações para cada doadora
      const doadorasComAspiracao: DoadoraComAspiracao[] = await Promise.all(
        (doadorasData || []).map(async (doadora) => {
          const { data: aspiracoesData, error } = await supabase
            .from('aspiracoes_doadoras')
            .select('total_oocitos, data_aspiracao')
            .eq('doadora_id', doadora.id)
            .order('data_aspiracao', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Se houver erro ou não houver dados, usar null
          if (error || !aspiracoesData) {
            return {
              ...doadora,
              ultima_aspiracao_total_oocitos: undefined,
              ultima_aspiracao_data: undefined,
            };
          }

          return {
            ...doadora,
            ultima_aspiracao_total_oocitos: aspiracoesData.total_oocitos,
            ultima_aspiracao_data: aspiracoesData.data_aspiracao,
          };
        })
      );

      setDoadoras(doadorasComAspiracao);
      setFilteredDoadoras(doadorasComAspiracao);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderClassificacaoGenetica = (classificacao?: string | null) => {
    if (!classificacao) return '-';
    
    switch (classificacao) {
      case '1_estrela':
        return (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </div>
        );
      case '2_estrelas':
        return (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </div>
        );
      case '3_estrelas':
        return (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          </div>
        );
      case 'diamante':
        return (
          <div className="flex items-center gap-1">
            <Gem className="w-4 h-4 fill-blue-500 text-blue-500" />
          </div>
        );
      default:
        return '-';
    }
  };

  const getCamposRaca = (doadora: DoadoraComAspiracao) => {
    if (doadora.raca === 'Gir') {
      const campos: string[] = [];
      if (doadora.gpta) campos.push(`GPTA: ${doadora.gpta}`);
      if (doadora.controle_leiteiro) campos.push(`Controle Leiteiro: ${doadora.controle_leiteiro}`);
      if (doadora.beta_caseina) campos.push(`Beta Caseína: ${doadora.beta_caseina}`);
      if (doadora.link_abcz) campos.push(`Link ABCZ`);
      return campos.length > 0 ? campos.join(', ') : null;
    }
    return null;
  };

  const resetForm = () => {
    setFormData({
      registro: '',
      raca: '',
      racaCustom: '',
    });
    setRacaSelecionada('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione a fazenda primeiro',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Validar raça: deve ter selecionado uma raça pré-definida ou digitado uma raça customizada
    const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
    if (!racaFinal) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Determinar raça final (pré-definida ou customizada)
      const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
      
      const doadoraData: Record<string, string | null> = {
        fazenda_id: selectedFazendaId,
        registro: formData.registro.trim(),
        raca: racaFinal, // Obrigatório
      };

      const { data, error } = await supabase.from('doadoras').insert([doadoraData]).select().single();

      if (error) throw error;

      toast({
        title: 'Doadora criada',
        description: 'Doadora criada com sucesso',
      });

      setShowDialog(false);
      resetForm();
      loadDoadoras();
      
      // Navegar para a página de detalhes da doadora criada
      if (data?.id) {
        navigate(`/doadoras/${data.id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar doadora',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      resetForm();
    }
  };

  if (loading && fazendas.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Doadoras" description="Gerenciar doadoras do sistema" />

      {/* Fazenda Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione a Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma fazenda para visualizar doadoras" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map((fazenda) => (
                <SelectItem key={fazenda.id} value={fazenda.id}>
                  {fazenda.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedFazendaId ? (
        <EmptyState
          title="Selecione uma fazenda"
          description="Escolha uma fazenda para visualizar e gerenciar doadoras."
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou registro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Dialog open={showDialog} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Doadora
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova Doadora</DialogTitle>
                  <DialogDescription>
                    Preencha os campos básicos. As informações detalhadas podem ser preenchidas após a criação.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registro">Registro *</Label>
                    <Input
                      id="registro"
                      value={formData.registro}
                      onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                      placeholder="Registro da doadora"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="raca">Raça *</Label>
                    <Select
                      value={racaSelecionada}
                      onValueChange={(value) => {
                        setRacaSelecionada(value);
                        if (value === 'Outra') {
                          setFormData({ ...formData, raca: '', racaCustom: '' });
                        } else {
                          setFormData({ ...formData, raca: value, racaCustom: '' });
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
                    {racaSelecionada === 'Outra' && (
                      <Input
                        id="raca_custom"
                        value={formData.racaCustom}
                        onChange={(e) => setFormData({ ...formData, racaCustom: e.target.value, raca: e.target.value })}
                        placeholder="Digite a raça"
                        className="mt-2"
                        required
                      />
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={submitting}
                    >
                      {submitting ? 'Salvando...' : 'Criar Doadora'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Doadoras</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registro</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Última Aspiração</TableHead>
                        <TableHead>Oócitos</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Raça (Campos Especiais)</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDoadoras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-slate-500">
                            {searchTerm ? 'Nenhuma doadora encontrada' : 'Nenhuma doadora cadastrada nesta fazenda'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDoadoras.map((doadora) => {
                          const camposRaca = getCamposRaca(doadora);
                          return (
                            <TableRow 
                              key={doadora.id}
                              className="cursor-pointer hover:bg-slate-50"
                              onClick={() => navigate(`/doadoras/${doadora.id}`)}
                            >
                              <TableCell className="font-medium">{doadora.registro}</TableCell>
                              <TableCell>{doadora.nome || '-'}</TableCell>
                              <TableCell>
                                {doadora.ultima_aspiracao_data 
                                  ? formatDate(doadora.ultima_aspiracao_data)
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {doadora.ultima_aspiracao_total_oocitos ?? '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={doadora.disponivel_aspiracao ? 'default' : 'secondary'}>
                                  {doadora.disponivel_aspiracao ? 'Disponível' : 'Indisponível'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span>{doadora.raca || '-'}</span>
                                  {camposRaca && (
                                    <span className="text-xs text-slate-500">{camposRaca}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {renderClassificacaoGenetica(doadora.classificacao_genetica)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setHistoricoDoadoraId(doadora.id);
                                    }}
                                    title="Ver histórico de aspirações"
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/doadoras/${doadora.id}`);
                                    }}
                                    title="Editar doadora"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Histórico de Aspirações */}
          {historicoDoadoraId && (
            <DoadoraHistoricoAspiracoes
              doadoraId={historicoDoadoraId}
              doadoraNome={filteredDoadoras.find(d => d.id === historicoDoadoraId)?.nome || 
                           filteredDoadoras.find(d => d.id === historicoDoadoraId)?.registro}
              open={!!historicoDoadoraId}
              onClose={() => setHistoricoDoadoraId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}