import { useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import FazendaSelector from '@/components/shared/FazendaSelector';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Plus, Pencil, History, Star, Gem, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import SearchInput from '@/components/shared/SearchInput';
import DoadoraHistoricoAspiracoes from '@/components/shared/DoadoraHistoricoAspiracoes';
import { formatDateBR } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';

// Hooks
import {
  useDoadorasData,
  useDoadorasForm,
  racasPredefinidas,
  type DoadoraComAspiracao,
  type SortOrder,
} from '@/hooks/doadoras';

export default function Doadoras() {
  const navigate = useNavigate();

  const {
    loading,
    fazendas,
    filteredDoadoras,
    selectedFazendaId,
    setSelectedFazendaId,
    searchTerm,
    setSearchTerm,
    sortByDate,
    setSortByDate,
    clearFilters,
    hasActiveFilters,
    historicoDoadoraId,
    setHistoricoDoadoraId,
    loadFazendas,
    loadDoadoras,
  } = useDoadorasData();

  const {
    formData,
    setFormData,
    racaSelecionada,
    showDialog,
    submitting,
    handleSubmit,
    handleDialogClose,
    handleRacaChange,
  } = useDoadorasForm({
    selectedFazendaId,
    onSuccess: loadDoadoras,
  });

  // Load fazendas on mount
  useEffect(() => {
    loadFazendas();
  }, [loadFazendas]);

  if (loading && fazendas.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Doadoras" description="Gerenciar doadoras do sistema" />

      {/* Fazenda Selection */}
      <FazendaSelector
        fazendas={fazendas}
        selectedFazendaId={selectedFazendaId}
        onFazendaChange={setSelectedFazendaId}
        placeholder="Selecione uma fazenda para visualizar doadoras"
      />

      {!selectedFazendaId ? (
        <EmptyState
          title="Selecione uma fazenda"
          description="Escolha uma fazenda para visualizar e gerenciar doadoras."
        />
      ) : (
        <>
          {/* Barra de Filtros Premium */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-6">
                {/* Grupo: Busca */}
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full bg-primary/40" />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Busca</span>
                  </div>
                  <div className="w-full md:w-auto md:flex-1 md:min-w-[220px]">
                    <SearchInput
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Buscar por nome ou registro..."
                    />
                  </div>
                </div>

                {/* Separador */}
                <div className="h-10 w-px bg-border hidden md:block" />

                {/* Grupo: Ordenação por Data */}
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full bg-amber-500/40" />
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Última Aspiração</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={sortByDate === 'desc' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setSortByDate(sortByDate === 'desc' ? 'none' : 'desc')}
                      title="Mais recentes primeiro"
                    >
                      <ArrowDown className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Recentes</span>
                    </Button>
                    <Button
                      variant={sortByDate === 'asc' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setSortByDate(sortByDate === 'asc' ? 'none' : 'asc')}
                      title="Mais antigas primeiro"
                    >
                      <ArrowUp className="w-3.5 h-3.5 mr-1" />
                      <span className="text-xs">Antigas</span>
                    </Button>
                  </div>
                </div>

                {/* Botão Limpar */}
                {hasActiveFilters && (
                  <>
                    <div className="h-10 w-px bg-border hidden md:block" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar
                    </Button>
                  </>
                )}
              </div>

              {/* Botão Nova Doadora */}
              <DoadoraFormDialog
                showDialog={showDialog}
                handleDialogClose={handleDialogClose}
                formData={formData}
                setFormData={setFormData}
                racaSelecionada={racaSelecionada}
                handleRacaChange={handleRacaChange}
                submitting={submitting}
                handleSubmit={handleSubmit}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Doadoras</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton
                  columns={8}
                  rows={6}
                  headers={['Registro', 'Nome', 'Ultima Aspiracao', 'Oocitos', 'Estado', 'Raca', 'Classificacao', 'Acoes']}
                />
              ) : (
                <DoadorasTable
                  doadoras={filteredDoadoras}
                  searchTerm={searchTerm}
                  navigate={navigate}
                  setHistoricoDoadoraId={setHistoricoDoadoraId}
                />
              )}
            </CardContent>
          </Card>

          {/* Modal de Historico de Aspiracoes */}
          {historicoDoadoraId && (
            <DoadoraHistoricoAspiracoes
              doadoraId={historicoDoadoraId}
              doadoraNome={
                filteredDoadoras.find((d) => d.id === historicoDoadoraId)?.nome ||
                filteredDoadoras.find((d) => d.id === historicoDoadoraId)?.registro
              }
              open={!!historicoDoadoraId}
              onClose={() => setHistoricoDoadoraId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// Sub-components

interface DoadoraFormDialogProps {
  showDialog: boolean;
  handleDialogClose: (open: boolean) => void;
  formData: { registro: string; raca: string; racaCustom: string };
  setFormData: React.Dispatch<
    React.SetStateAction<{ registro: string; raca: string; racaCustom: string }>
  >;
  racaSelecionada: string;
  handleRacaChange: (value: string) => void;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

function DoadoraFormDialog({
  showDialog,
  handleDialogClose,
  formData,
  setFormData,
  racaSelecionada,
  handleRacaChange,
  submitting,
  handleSubmit,
}: DoadoraFormDialogProps) {
  return (
    <Dialog open={showDialog} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nova Doadora
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Doadora</DialogTitle>
          <DialogDescription>
            Preencha os campos basicos. As informacoes detalhadas podem ser preenchidas apos a
            criacao.
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
              onClick={() => handleDialogClose(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DoadorasTableProps {
  doadoras: DoadoraComAspiracao[];
  searchTerm: string;
  navigate: ReturnType<typeof useNavigate>;
  setHistoricoDoadoraId: (id: string | null) => void;
}

function DoadorasTable({
  doadoras,
  searchTerm,
  navigate,
  setHistoricoDoadoraId,
}: DoadorasTableProps) {
  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {doadoras.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            {searchTerm ? 'Nenhuma doadora encontrada' : 'Nenhuma doadora cadastrada nesta fazenda'}
          </p>
        ) : (
          doadoras.map((doadora) => (
            <div
              key={doadora.id}
              className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5 active:bg-muted/50"
              onClick={() => navigate(`/doadoras/${doadora.id}`)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-base truncate">{doadora.registro}</span>
                <Badge
                  variant="outline"
                  className={doadora.disponivel_aspiracao
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
                  }
                >
                  {doadora.disponivel_aspiracao ? 'Disponível' : 'Indisponível'}
                </Badge>
              </div>
              {doadora.nome && <p className="text-sm text-muted-foreground mb-2">{doadora.nome}</p>}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Raça</span>
                  <span className="font-medium">{doadora.raca || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Última Aspiração</span>
                  <span className="font-medium">{doadora.ultima_aspiracao_data ? formatDateBR(doadora.ultima_aspiracao_data) : '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Oócitos</span>
                  <span className="font-medium">{doadora.ultima_aspiracao_total_oocitos ?? '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase block">Classificação</span>
                  <span className="font-medium">{doadora.classificacao_genetica ? doadora.classificacao_genetica.replace('_', ' ') : '-'}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-11"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoricoDoadoraId(doadora.id);
                  }}
                >
                  <History className="w-4 h-4 mr-2" />
                  Histórico
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/doadoras/${doadora.id}`);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registro</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Ultima Aspiracao</TableHead>
                <TableHead>Oocitos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Raca (Campos Especiais)</TableHead>
                <TableHead>Classificacao</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doadoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {searchTerm
                      ? 'Nenhuma doadora encontrada'
                      : 'Nenhuma doadora cadastrada nesta fazenda'}
                  </TableCell>
                </TableRow>
              ) : (
                doadoras.map((doadora) => (
                  <DoadoraRow
                    key={doadora.id}
                    doadora={doadora}
                    navigate={navigate}
                    setHistoricoDoadoraId={setHistoricoDoadoraId}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}

interface DoadoraRowProps {
  doadora: DoadoraComAspiracao;
  navigate: ReturnType<typeof useNavigate>;
  setHistoricoDoadoraId: (id: string | null) => void;
}

// Memoized row component to prevent unnecessary re-renders
const DoadoraRow = memo(function DoadoraRow({ doadora, navigate, setHistoricoDoadoraId }: DoadoraRowProps) {
  const camposRaca = getCamposRaca(doadora);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted"
      onClick={() => navigate(`/doadoras/${doadora.id}`)}
    >
      <TableCell className="font-medium">{doadora.registro}</TableCell>
      <TableCell>{doadora.nome || '-'}</TableCell>
      <TableCell>
        {doadora.ultima_aspiracao_data ? formatDateBR(doadora.ultima_aspiracao_data) : '-'}
      </TableCell>
      <TableCell>{doadora.ultima_aspiracao_total_oocitos ?? '-'}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={doadora.disponivel_aspiracao
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
          }
        >
          {doadora.disponivel_aspiracao ? 'Disponível' : 'Indisponível'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span>{doadora.raca || '-'}</span>
          {camposRaca && <span className="text-xs text-muted-foreground">{camposRaca}</span>}
        </div>
      </TableCell>
      <TableCell>{renderClassificacaoGenetica(doadora.classificacao_genetica)}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setHistoricoDoadoraId(doadora.id);
            }}
          >
            <History className="w-4 h-4 mr-2" />
            Histórico
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
});

// Helper functions

function getCamposRaca(doadora: DoadoraComAspiracao): string | null {
  if (doadora.raca === 'Gir') {
    const campos: string[] = [];
    if (doadora.gpta) campos.push(`GPTA: ${doadora.gpta}`);
    if (doadora.controle_leiteiro) campos.push(`Controle Leiteiro: ${doadora.controle_leiteiro}`);
    if (doadora.beta_caseina) campos.push(`Beta Caseina: ${doadora.beta_caseina}`);
    if (doadora.link_abcz) campos.push(`Link ABCZ`);
    return campos.length > 0 ? campos.join(', ') : null;
  }
  return null;
}

function renderClassificacaoGenetica(classificacao?: string | null) {
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
}
