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
import { Plus, Pencil, History, Star, Gem } from 'lucide-react';
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
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar por nome ou registro..."
              />
            </div>
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
        <Badge variant={doadora.disponivel_aspiracao ? 'default' : 'secondary'}>
          {doadora.disponivel_aspiracao ? 'Disponivel' : 'Indisponivel'}
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
