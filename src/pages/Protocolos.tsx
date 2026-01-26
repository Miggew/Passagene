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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import { Plus, PlayCircle, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';

// Hooks
import { useProtocolosData, type ProtocoloWithFazenda } from '@/hooks/protocolos';

export default function Protocolos() {
  const navigate = useNavigate();

  const {
    loading,
    loadingProtocolos,
    protocolos,
    fazendas,
    filtroStatus,
    setFiltroStatus,
    fazendaFilter,
    setFazendaFilter,
    filtroDataInicio,
    setFiltroDataInicio,
    filtroDataFim,
    setFiltroDataFim,
    protocolosPage,
    setProtocolosPage,
    pageSize,
    loadData,
    loadProtocolos,
    limparFiltros,
    aplicarAtalhoData,
  } = useProtocolosData();

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle search
  const handleBuscar = () => {
    setProtocolosPage(1);
    loadProtocolos(1, {
      fazendaFilter,
      filtroDataInicio,
      filtroDataFim,
      filtroStatus,
    });
  };

  // Handle clear filters
  const handleLimparFiltros = () => {
    limparFiltros();
    loadProtocolos(1, {
      fazendaFilter: '',
      filtroDataInicio: '',
      filtroDataFim: '',
      filtroStatus: 'all',
    });
  };

  // Handle pagination
  const handlePaginaAnterior = async () => {
    const newPage = Math.max(1, protocolosPage - 1);
    setProtocolosPage(newPage);
    await loadProtocolos(newPage);
  };

  const handleProximaPagina = async () => {
    const newPage = protocolosPage + 1;
    setProtocolosPage(newPage);
    await loadProtocolos(newPage);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocolos de Sincronização"
        description="Gerenciar protocolos em 2 passos"
        actions={
          <Button
            onClick={() => navigate('/protocolos/novo')}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Protocolo (1º Passo)
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Filtro Rápido</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os protocolos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os protocolos</SelectItem>
                  <SelectItem value="aguardando_2_passo">Aguardando 2º Passo</SelectItem>
                  <SelectItem value="sincronizado">Sincronizados</SelectItem>
                  <SelectItem value="fechado">Fechados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fazenda Filter */}
            <div className="space-y-2">
              <Label>Fazenda</Label>
              <Select
                value={fazendaFilter || 'all'}
                onValueChange={(value) => setFazendaFilter(value === 'all' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as fazendas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fazendas</SelectItem>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filters */}
            <div className="space-y-2">
              <Label>Data Início (de)</Label>
              <DatePickerBR value={filtroDataInicio} onChange={setFiltroDataInicio} />
            </div>

            <div className="space-y-2">
              <Label>Data Início (até)</Label>
              <DatePickerBR value={filtroDataFim} onChange={setFiltroDataFim} />
            </div>
          </div>

          {/* Date Shortcuts and Search Button */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-2 flex-1">
              <Label className="w-full text-sm font-medium text-slate-700">
                Atalhos rápidos:
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarAtalhoData(7)}
              >
                Últimos 7 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarAtalhoData(30)}
              >
                Últimos 30 dias
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => aplicarAtalhoData(90)}
              >
                Últimos 90 dias
              </Button>
            </div>
            <Button
              type="button"
              onClick={handleBuscar}
              disabled={loadingProtocolos}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protocols List */}
      <Card>
        <CardHeader>
          <CardTitle>Protocolos de Sincronização ({protocolos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProtocolos ? (
            <div className="py-8">
              <LoadingSpinner />
            </div>
          ) : protocolos.length === 0 ? (
            <EmptyState
              title="Nenhum protocolo encontrado"
              description="Ajuste os filtros ou adicione um novo protocolo."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleLimparFiltros}>
                    Limpar filtros
                  </Button>
                  <Button
                    onClick={() => navigate('/protocolos/novo')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Protocolo
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <ProtocolosTable protocolos={protocolos} navigate={navigate} />

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-slate-600">
                  Página {protocolosPage} - Mostrando {protocolos.length} protocolos
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePaginaAnterior}
                    disabled={protocolosPage === 1 || loadingProtocolos}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleProximaPagina}
                    disabled={protocolos.length < pageSize || loadingProtocolos}
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-components

interface ProtocolosTableProps {
  protocolos: ProtocoloWithFazenda[];
  navigate: ReturnType<typeof useNavigate>;
}

function ProtocolosTable({ protocolos, navigate }: ProtocolosTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fazenda</TableHead>
          <TableHead>Data Início</TableHead>
          <TableHead>Data 2º Passo</TableHead>
          <TableHead>Técnico 2º Passo</TableHead>
          <TableHead>Receptoras</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {protocolos.map((protocolo) => (
          <ProtocoloRow key={protocolo.id} protocolo={protocolo} navigate={navigate} />
        ))}
      </TableBody>
    </Table>
  );
}

interface ProtocoloRowProps {
  protocolo: ProtocoloWithFazenda;
  navigate: ReturnType<typeof useNavigate>;
}

function ProtocoloRow({ protocolo, navigate }: ProtocoloRowProps) {
  const isAguardando2Passo =
    protocolo.status === 'PASSO1_FECHADO' || protocolo.status === 'PRIMEIRO_PASSO_FECHADO';
  const isFechado = protocolo.status === 'FECHADO' || protocolo.status === 'EM_TE';
  const isSincronizado = protocolo.status === 'SINCRONIZADO' || protocolo.status === 'PASSO2_FECHADO';

  return (
    <TableRow>
      <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
      <TableCell>{formatDate(protocolo.data_inicio)}</TableCell>
      <TableCell>{protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}</TableCell>
      <TableCell>{protocolo.passo2_tecnico_responsavel || '-'}</TableCell>
      <TableCell>{protocolo.receptoras_count}</TableCell>
      <TableCell>
        <ProtocoloStatusBadge
          isFechado={isFechado}
          isSincronizado={isSincronizado}
          isAguardando2Passo={isAguardando2Passo}
          status={protocolo.status}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {isAguardando2Passo && (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate(`/protocolos/${protocolo.id}/passo2`)}
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Iniciar 2º Passo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/protocolos/${protocolo.id}/relatorio`)}
          >
            <FileText className="w-4 h-4 mr-2" />
            Ver Relatório
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface ProtocoloStatusBadgeProps {
  isFechado: boolean;
  isSincronizado: boolean;
  isAguardando2Passo: boolean;
  status: string | null;
}

function ProtocoloStatusBadge({
  isFechado,
  isSincronizado,
  isAguardando2Passo,
  status,
}: ProtocoloStatusBadgeProps) {
  if (isFechado) {
    return (
      <Badge variant="secondary" className="bg-slate-500 hover:bg-slate-600 text-white">
        Fechado
      </Badge>
    );
  }

  if (isSincronizado) {
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
        Sincronizado
      </Badge>
    );
  }

  if (isAguardando2Passo) {
    return (
      <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">
        Aguardando 2º Passo
      </Badge>
    );
  }

  return <Badge variant="default">{status || 'N/A'}</Badge>;
}
