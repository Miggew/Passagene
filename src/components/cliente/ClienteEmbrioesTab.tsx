import { useState, useMemo } from 'react';
import type { EmbriaoComRelacionamentos, DoseSemenComTouro } from '@/lib/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import { Search, Eye, Snowflake } from 'lucide-react';

interface ClienteEmbrioesTabProps {
  clienteId: string;
  clienteNome: string;
  embrioes: EmbriaoComRelacionamentos[];
}

export function ClienteEmbrioesTab({ clienteId, clienteNome, embrioes }: ClienteEmbrioesTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('todos');
  const [filtroDoadora, setFiltroDoadora] = useState<string>('todos');
  const [filtroTouro, setFiltroTouro] = useState<string>('todos');
  const [embriaoDetalhe, setEmbriaoDetalhe] = useState<EmbriaoComRelacionamentos | null>(null);

  // Extrair dados para filtros
  const { classificacoes, doadoras, touros } = useMemo(() => {
    const classSet = new Set<string>();
    const doadoraMap = new Map<string, string>();
    const touroMap = new Map<string, string>();

    embrioes.forEach((embriao) => {
      if (embriao.classificacao) {
        classSet.add(embriao.classificacao);
      }

      const acasalamento = embriao.acasalamento as EmbriaoComRelacionamentos['acasalamento'] & {
        dose_semen?: DoseSemenComTouro & { touro?: { id: string; nome?: string; registro?: string } };
        aspiracao?: { doadora?: { id: string; nome?: string; registro?: string } };
      };

      const doadora = acasalamento?.aspiracao?.doadora;
      if (doadora?.id) {
        doadoraMap.set(doadora.id, doadora.registro || doadora.nome || doadora.id);
      }

      const touro = acasalamento?.dose_semen?.touro;
      if (touro?.id) {
        touroMap.set(touro.id, touro.nome || touro.registro || touro.id);
      }
    });

    return {
      classificacoes: Array.from(classSet).sort(),
      doadoras: Array.from(doadoraMap.entries()).sort((a, b) => a[1].localeCompare(b[1])),
      touros: Array.from(touroMap.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    };
  }, [embrioes]);

  // Filtrar embriões
  const filteredEmbrioes = embrioes.filter((embriao) => {
    const acasalamento = embriao.acasalamento as EmbriaoComRelacionamentos['acasalamento'] & {
      dose_semen?: DoseSemenComTouro & { touro?: { id: string; nome?: string; registro?: string } };
      aspiracao?: { doadora?: { id: string; nome?: string; registro?: string } };
    };

    const doadora = acasalamento?.aspiracao?.doadora;
    const touro = acasalamento?.dose_semen?.touro;

    const matchesSearch = !searchTerm ||
      embriao.identificacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      embriao.localizacao_atual?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doadora?.registro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doadora?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      touro?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesClassificacao = filtroClassificacao === 'todos' ||
      embriao.classificacao === filtroClassificacao;

    const matchesDoadora = filtroDoadora === 'todos' ||
      doadora?.id === filtroDoadora;

    const matchesTouro = filtroTouro === 'todos' ||
      touro?.id === filtroTouro;

    return matchesSearch && matchesClassificacao && matchesDoadora && matchesTouro;
  });

  // Estatísticas
  const estatisticas = useMemo(() => {
    const porClassificacao = new Map<string, number>();

    embrioes.forEach((embriao) => {
      const classificacao = embriao.classificacao || 'Sem classificação';
      porClassificacao.set(classificacao, (porClassificacao.get(classificacao) || 0) + 1);
    });

    return {
      total: embrioes.length,
      porClassificacao: Array.from(porClassificacao.entries())
        .sort((a, b) => b[1] - a[1]),
    };
  }, [embrioes]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const DialogDetalheContent = ({ embriao }: { embriao: EmbriaoComRelacionamentos }) => {
    const acasalamento = embriao.acasalamento as EmbriaoComRelacionamentos['acasalamento'] & {
      dose_semen?: DoseSemenComTouro & { touro?: { nome?: string; registro?: string; raca?: string } };
      aspiracao?: { data_aspiracao?: string; horario_aspiracao?: string; doadora?: { nome?: string; registro?: string } };
    };
    const dose = acasalamento?.dose_semen;
    const touro = dose?.touro;
    const aspiracao = acasalamento?.aspiracao;
    const doadora = aspiracao?.doadora;
    const loteFiv = embriao.lote_fiv;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Identificação</p>
          <p className="font-medium">{embriao.identificacao || '-'}</p>
        </div>
        <div>
          <p className="text-slate-500">Classificação</p>
          <p className="font-medium">
            {embriao.classificacao ? (
              <Badge variant="secondary">{embriao.classificacao}</Badge>
            ) : '-'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Status</p>
          <p className="font-medium">
            <Badge className="bg-cyan-100 text-cyan-800">
              <Snowflake className="w-3 h-3 mr-1" />
              {embriao.status_atual || 'CONGELADO'}
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-slate-500">Data de Congelamento</p>
          <p className="font-medium">{formatDate(embriao.data_congelamento)}</p>
        </div>
        <div>
          <p className="text-slate-500">Localização</p>
          <p className="font-medium">{embriao.localizacao_atual || '-'}</p>
        </div>
        <div>
          <p className="text-slate-500">Tipo</p>
          <p className="font-medium">{embriao.tipo_embriao || '-'}</p>
        </div>

        <div className="col-span-2 border-t pt-4 mt-2">
          <p className="text-slate-500 font-medium mb-2">Origem</p>
        </div>

        <div>
          <p className="text-slate-500">Doadora</p>
          <p className="font-medium">
            {doadora?.registro || doadora?.nome || '-'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Touro</p>
          <p className="font-medium">
            {touro?.nome || '-'}
            {touro?.registro && <span className="text-slate-500 ml-1">({touro.registro})</span>}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Raça do Touro</p>
          <p className="font-medium">{touro?.raca || '-'}</p>
        </div>
        <div>
          <p className="text-slate-500">Data D0 (Lote FIV)</p>
          <p className="font-medium">{formatDate(loteFiv?.data_abertura)}</p>
        </div>
        <div>
          <p className="text-slate-500">Data de Aspiração</p>
          <p className="font-medium">{formatDate(aspiracao?.data_aspiracao)}</p>
        </div>
        <div>
          <p className="text-slate-500">Hora de Aspiração</p>
          <p className="font-medium">{aspiracao?.horario_aspiracao || '-'}</p>
        </div>

        {embriao.observacoes && (
          <div className="col-span-2 border-t pt-4 mt-2">
            <p className="text-slate-500">Observações</p>
            <p className="font-medium">{embriao.observacoes}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Total Congelados</p>
            <p className="text-2xl font-bold">{estatisticas.total}</p>
          </CardContent>
        </Card>
        {estatisticas.porClassificacao.slice(0, 3).map(([classificacao, quantidade]) => (
          <Card key={classificacao}>
            <CardContent className="pt-4">
              <p className="text-sm text-slate-500">{classificacao}</p>
              <p className="text-2xl font-bold">{quantidade}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {classificacoes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroDoadora} onValueChange={setFiltroDoadora}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Doadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {doadoras.map(([id, nome]) => (
              <SelectItem key={id} value={id}>{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroTouro} onValueChange={setFiltroTouro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Touro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {touros.map(([id, nome]) => (
              <SelectItem key={id} value={id}>{nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Embriões Congelados ({filteredEmbrioes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmbrioes.length === 0 ? (
            <EmptyState
              title="Nenhum embrião encontrado"
              description={searchTerm || filtroClassificacao !== 'todos' || filtroDoadora !== 'todos' || filtroTouro !== 'todos'
                ? "Tente ajustar os filtros"
                : "Nenhum embrião congelado no estoque"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Identificação</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Touro</TableHead>
                  <TableHead>Data Cong.</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmbrioes.map((embriao) => {
                  const acasalamento = embriao.acasalamento as EmbriaoComRelacionamentos['acasalamento'] & {
                    dose_semen?: DoseSemenComTouro & { touro?: { nome?: string; registro?: string } };
                    aspiracao?: { doadora?: { nome?: string; registro?: string } };
                  };
                  const doadora = acasalamento?.aspiracao?.doadora;
                  const touro = acasalamento?.dose_semen?.touro;

                  return (
                    <TableRow key={embriao.id}>
                      <TableCell className="font-medium font-mono text-sm">
                        {embriao.identificacao || '-'}
                      </TableCell>
                      <TableCell>
                        {embriao.classificacao ? (
                          <Badge variant="secondary">{embriao.classificacao}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{doadora?.registro || doadora?.nome || '-'}</TableCell>
                      <TableCell>
                        {touro?.nome || '-'}
                        {touro?.registro && (
                          <span className="text-slate-500 text-xs ml-1">({touro.registro})</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(embriao.data_congelamento)}</TableCell>
                      <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEmbriaoDetalhe(embriao)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detalhar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={!!embriaoDetalhe} onOpenChange={(open) => !open && setEmbriaoDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Embrião</DialogTitle>
            <DialogDescription>
              Informações completas do embrião congelado
            </DialogDescription>
          </DialogHeader>
          {embriaoDetalhe && <DialogDetalheContent embriao={embriaoDetalhe} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
