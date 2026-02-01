import { useState, useEffect, useCallback } from 'react';
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
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import DoadoraHistoricoAspiracoes from '@/components/shared/DoadoraHistoricoAspiracoes';
import { Plus, Pencil, Search, History, Star, Gem, Filter, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface DoadoraComAspiracao extends Doadora {
  ultima_aspiracao_total_oocitos?: number;
  ultima_aspiracao_data?: string;
}

interface FazendaDoadorasTabProps {
  fazendaId: string;
  fazendaNome: string;
}

const racasPredefinidas = [
  'Gir',
  'Gir Leiteiro',
  'Girolando',
  'Nelore',
  'Brahman',
  'Senepol',
  'Angus',
  'Holandês',
  'Jersey',
];

export function FazendaDoadorasTab({ fazendaId, fazendaNome }: FazendaDoadorasTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // States
  const [loading, setLoading] = useState(true);
  const [doadoras, setDoadoras] = useState<DoadoraComAspiracao[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historicoDoadoraId, setHistoricoDoadoraId] = useState<string | null>(null);

  // Form states
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ registro: '', raca: '', racaCustom: '' });
  const [racaSelecionada, setRacaSelecionada] = useState('');

  // Load doadoras
  const loadDoadoras = useCallback(async () => {
    try {
      setLoading(true);
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', fazendaId)
        .order('created_at', { ascending: false });

      if (doadorasError) throw doadorasError;

      // Fetch last aspiration for each doadora
      const doadorasComAspiracao: DoadoraComAspiracao[] = await Promise.all(
        (doadorasData || []).map(async (doadora) => {
          const { data: aspiracoesData } = await supabase
            .from('aspiracoes_doadoras')
            .select('total_oocitos, data_aspiracao')
            .eq('doadora_id', doadora.id)
            .order('data_aspiracao', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...doadora,
            ultima_aspiracao_total_oocitos: aspiracoesData?.total_oocitos,
            ultima_aspiracao_data: aspiracoesData?.data_aspiracao,
          };
        })
      );

      setDoadoras(doadorasComAspiracao);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [fazendaId, toast]);

  useEffect(() => {
    loadDoadoras();
  }, [loadDoadoras]);

  // Filter doadoras
  const filteredDoadoras = doadoras.filter((d) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.nome?.toLowerCase().includes(term) ||
      d.registro?.toLowerCase().includes(term) ||
      d.raca?.toLowerCase().includes(term)
    );
  });

  // Handle form
  const handleRacaChange = (value: string) => {
    setRacaSelecionada(value);
    if (value !== 'Outra') {
      setFormData({ ...formData, raca: value, racaCustom: '' });
    } else {
      setFormData({ ...formData, raca: '', racaCustom: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.registro.trim()) return;

    try {
      setSubmitting(true);
      const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom : formData.raca;

      const { error } = await supabase.from('doadoras').insert({
        fazenda_id: fazendaId,
        registro: formData.registro.trim(),
        raca: racaFinal,
      });

      if (error) throw error;

      toast({
        title: 'Doadora criada',
        description: 'Doadora cadastrada com sucesso.',
      });

      setShowDialog(false);
      setFormData({ registro: '', raca: '', racaCustom: '' });
      setRacaSelecionada('');
      loadDoadoras();
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter className="w-3.5 h-3.5" />
              <span>Busca</span>
            </div>
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou registro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="h-9"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Botão Nova Doadora */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Doadora
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Doadora</DialogTitle>
              <DialogDescription>
                Adicionar doadora em {fazendaNome}
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
                <Label htmlFor="raca">Raca *</Label>
                <Select value={racaSelecionada} onValueChange={handleRacaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a raca" />
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
                    onChange={(e) =>
                      setFormData({ ...formData, racaCustom: e.target.value, raca: e.target.value })
                    }
                    placeholder="Digite a raca"
                    className="mt-2"
                    required
                  />
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Criar Doadora'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Doadoras ({filteredDoadoras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDoadoras.length === 0 ? (
            <EmptyState
              title="Nenhuma doadora encontrada"
              description={searchTerm
                ? "Tente ajustar a busca"
                : "Cadastre a primeira doadora desta fazenda"
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registro</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raca</TableHead>
                    <TableHead>Classificacao</TableHead>
                    <TableHead>Ultima Aspiracao</TableHead>
                    <TableHead>Oocitos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDoadoras.map((doadora) => (
                    <TableRow
                      key={doadora.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/doadoras/${doadora.id}`)}
                    >
                      <TableCell className="font-medium">{doadora.registro}</TableCell>
                      <TableCell>{doadora.nome || '-'}</TableCell>
                      <TableCell>{doadora.raca || '-'}</TableCell>
                      <TableCell>{renderClassificacaoGenetica(doadora.classificacao_genetica)}</TableCell>
                      <TableCell>
                        {doadora.ultima_aspiracao_data ? formatDate(doadora.ultima_aspiracao_data) : '-'}
                      </TableCell>
                      <TableCell>{doadora.ultima_aspiracao_total_oocitos ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={doadora.disponivel_aspiracao ? 'default' : 'secondary'}>
                          {doadora.disponivel_aspiracao ? 'Disponivel' : 'Indisponivel'}
                        </Badge>
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
                            title="Ver historico de aspiracoes"
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Historico de Aspiracoes */}
      {historicoDoadoraId && (
        <DoadoraHistoricoAspiracoes
          doadoraId={historicoDoadoraId}
          doadoraNome={
            doadoras.find((d) => d.id === historicoDoadoraId)?.nome ||
            doadoras.find((d) => d.id === historicoDoadoraId)?.registro
          }
          open={!!historicoDoadoraId}
          onClose={() => setHistoricoDoadoraId(null)}
        />
      )}
    </div>
  );
}
