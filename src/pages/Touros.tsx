import { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Search, Eye, Filter, Dna, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CamposDinamicosPorRaca from '@/components/touros/CamposDinamicosPorRaca';
import type { Touro } from '@/lib/types';

// Hooks
import { useTourosData, useTourosForm, racasBovinas } from '@/hooks/touros';
import type { TouroFormData, ValorDinamico } from '@/hooks/touros';

export default function Touros() {
  const navigate = useNavigate();

  const {
    loading,
    filteredTouros,
    searchTerm,
    setSearchTerm,
    filtroRaca,
    setFiltroRaca,
    loadTouros,
  } = useTourosData();

  const {
    formData,
    setFormData,
    showDialog,
    setShowDialog,
    submitting,
    resetForm,
    handleCampoDinamicoChange,
    handleSubmit,
    getValoresDinamicos,
  } = useTourosForm({ onSuccess: loadTouros });

  // Load data on mount
  useEffect(() => {
    loadTouros();
  }, [loadTouros]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogo de Touros"
        description="Gerenciar catalogo de touros para FIV"
        actions={
          <TouroFormDialog
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            formData={formData}
            setFormData={setFormData}
            submitting={submitting}
            resetForm={resetForm}
            handleCampoDinamicoChange={handleCampoDinamicoChange}
            handleSubmit={handleSubmit}
            getValoresDinamicos={getValoresDinamicos}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Touros</CardTitle>
        </CardHeader>
        <CardContent>
          <TourosFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filtroRaca={filtroRaca}
            setFiltroRaca={setFiltroRaca}
          />

          <TourosTable touros={filteredTouros} navigate={navigate} />
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-components

interface TourosFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filtroRaca: string;
  setFiltroRaca: (raca: string) => void;
}

function TourosFilters({
  searchTerm,
  setSearchTerm,
  filtroRaca,
  setFiltroRaca,
}: TourosFiltersProps) {
  const hasFilters = searchTerm || filtroRaca;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
      <div className="flex flex-wrap items-end gap-6">
        {/* Grupo: Busca */}
        <div className="flex items-end gap-3">
          <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
            <Filter className="w-3.5 h-3.5" />
            <span>Busca</span>
          </div>
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, registro ou raça..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Separador */}
        <div className="h-10 w-px bg-border hidden lg:block" />

        {/* Grupo: Raça */}
        <div className="flex items-end gap-3">
          <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
            <Dna className="w-3.5 h-3.5" />
            <span>Raça</span>
          </div>
          <div className="w-[180px]">
            <Select
              value={filtroRaca || 'all'}
              onValueChange={(value) => setFiltroRaca(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todas as raças" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as raças</SelectItem>
                {racasBovinas.map((raca) => (
                  <SelectItem key={raca} value={raca}>
                    {raca}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botão Limpar */}
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setFiltroRaca('');
            }}
            className="h-9 ml-auto"
          >
            <X className="w-4 h-4 mr-2" />
            Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  );
}

interface TourosTableProps {
  touros: Touro[];
  navigate: ReturnType<typeof useNavigate>;
}

function TourosTable({ touros, navigate }: TourosTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Registro</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Raca</TableHead>
          <TableHead>NM$</TableHead>
          <TableHead>TPI</TableHead>
          <TableHead>PTAT</TableHead>
          <TableHead className="text-right">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {touros.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              <EmptyState
                title="Nenhum touro cadastrado"
                description="Cadastre o primeiro touro para comecar."
              />
            </TableCell>
          </TableRow>
        ) : (
          touros.map((touro) => <TouroRow key={touro.id} touro={touro} navigate={navigate} />)
        )}
      </TableBody>
    </Table>
  );
}

interface TouroRowProps {
  touro: Touro;
  navigate: ReturnType<typeof useNavigate>;
}

function TouroRow({ touro, navigate }: TouroRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{touro.registro}</TableCell>
      <TableCell>{touro.nome}</TableCell>
      <TableCell>
        {touro.raca ? <Badge variant="outline">{touro.raca}</Badge> : '-'}
      </TableCell>
      <TableCell>
        {touro.nm_dolares !== null && touro.nm_dolares !== undefined
          ? `+${touro.nm_dolares}`
          : '-'}
      </TableCell>
      <TableCell>
        {touro.tpi !== null && touro.tpi !== undefined ? `+${touro.tpi}` : '-'}
      </TableCell>
      <TableCell>
        {touro.ptat !== null && touro.ptat !== undefined ? `+${touro.ptat}` : '-'}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/touros/${touro.id}`)}>
          <Eye className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface TouroFormDialogProps {
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  formData: TouroFormData;
  setFormData: React.Dispatch<React.SetStateAction<TouroFormData>>;
  submitting: boolean;
  resetForm: () => void;
  handleCampoDinamicoChange: (campo: string, valor: ValorDinamico, categoria: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  getValoresDinamicos: () => Record<string, ValorDinamico>;
}

function TouroFormDialog({
  showDialog,
  setShowDialog,
  formData,
  setFormData,
  submitting,
  resetForm,
  handleCampoDinamicoChange,
  handleSubmit,
  getValoresDinamicos,
}: TouroFormDialogProps) {
  return (
    <Dialog
      open={showDialog}
      onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Touro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Touro</DialogTitle>
          <DialogDescription>
            Adicione um touro ao catalogo. Os clientes poderao ter doses deste touro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registro">Registro *</Label>
              <Input
                id="registro"
                value={formData.registro}
                onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                placeholder="Ex: 250HO14579"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: HANCOCK"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="raca">Raca</Label>
              <Select
                value={formData.raca}
                onValueChange={(value) => setFormData({ ...formData, raca: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a raca" />
                </SelectTrigger>
                <SelectContent>
                  {racasBovinas.map((raca) => (
                    <SelectItem key={raca} value={raca}>
                      {raca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>
          </div>

          {/* Owner and Farm */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proprietario">Proprietario</Label>
              <Input
                id="proprietario"
                value={formData.proprietario}
                onChange={(e) => setFormData({ ...formData, proprietario: e.target.value })}
                placeholder="Nome do proprietario"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fazenda_nome">Fazenda</Label>
              <Input
                id="fazenda_nome"
                value={formData.fazenda_nome}
                onChange={(e) => setFormData({ ...formData, fazenda_nome: e.target.value })}
                placeholder="Nome da fazenda"
              />
            </div>
          </div>

          {/* Dynamic Fields by Race */}
          {formData.raca && (
            <div className="border-t pt-4">
              <CamposDinamicosPorRaca
                raca={formData.raca}
                valores={getValoresDinamicos()}
                onChange={handleCampoDinamicoChange}
              />
            </div>
          )}

          {/* Pedigree */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Pedigree</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pai_registro">Registro do Pai</Label>
                <Input
                  id="pai_registro"
                  value={formData.pai_registro}
                  onChange={(e) => setFormData({ ...formData, pai_registro: e.target.value })}
                  placeholder="Registro do pai"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pai_nome">Nome do Pai</Label>
                <Input
                  id="pai_nome"
                  value={formData.pai_nome}
                  onChange={(e) => setFormData({ ...formData, pai_nome: e.target.value })}
                  placeholder="Nome do pai"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mae_registro">Registro da Mae</Label>
                <Input
                  id="mae_registro"
                  value={formData.mae_registro}
                  onChange={(e) => setFormData({ ...formData, mae_registro: e.target.value })}
                  placeholder="Registro da mae"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mae_nome">Nome da Mae</Label>
                <Input
                  id="mae_nome"
                  value={formData.mae_nome}
                  onChange={(e) => setFormData({ ...formData, mae_nome: e.target.value })}
                  placeholder="Nome da mae"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="genealogia_texto">Genealogia Completa (Texto)</Label>
              <Textarea
                id="genealogia_texto"
                value={formData.genealogia_texto}
                onChange={(e) => setFormData({ ...formData, genealogia_texto: e.target.value })}
                placeholder="Genealogia completa em formato texto"
                rows={3}
              />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="link_catalogo">Link do Catalogo</Label>
              <Input
                id="link_catalogo"
                type="url"
                value={formData.link_catalogo}
                onChange={(e) => setFormData({ ...formData, link_catalogo: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="foto_url">URL da Foto</Label>
              <Input
                id="foto_url"
                type="url"
                value={formData.foto_url}
                onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link_video">Link do Video (YouTube, etc.)</Label>
              <Input
                id="link_video"
                type="url"
                value={formData.link_video}
                onChange={(e) => setFormData({ ...formData, link_video: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observacoes</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observacoes adicionais sobre o touro"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Cadastrar Touro'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                resetForm();
              }}
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
