import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  Snowflake,
  Tag,
  Trash2,
  CheckSquare,
  Square,
  User,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { EmbrioCompleto, PacoteEmbrioes } from '@/hooks/embrioes';

interface PacoteEmbrioesTableProps {
  pacote: PacoteEmbrioes;
  embrioesSelecionados: Set<string>;
  paginaAtual: number;
  pageSize: number;
  totalSelecionados: number;
  getClassificacaoAtual: (e: EmbrioCompleto) => string;
  onToggleSelecionarEmbriao: (id: string) => void;
  onSelecionarTodosDaPagina: (embrioes: EmbrioCompleto[]) => void;
  onSetPagina: (p: number) => void;
  onClassificar: (e: EmbrioCompleto) => void;
  onCongelar: (e: EmbrioCompleto) => void;
  onDirecionar: (e: EmbrioCompleto) => void;
  onDescartar: (e: EmbrioCompleto) => void;
}

export function PacoteEmbrioesTable({
  pacote,
  embrioesSelecionados,
  paginaAtual,
  pageSize,
  totalSelecionados,
  getClassificacaoAtual,
  onToggleSelecionarEmbriao,
  onSelecionarTodosDaPagina,
  onSetPagina,
  onClassificar,
  onCongelar,
  onDirecionar,
  onDescartar,
}: PacoteEmbrioesTableProps) {
  const embrioesOrdenados = [...pacote.embrioes].sort((a, b) => {
    const idA = a.identificacao || '';
    const idB = b.identificacao || '';
    if (idA && idB) return idA.localeCompare(idB);
    if (idA && !idB) return -1;
    if (!idA && idB) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / pageSize));
  const pagina = Math.min(paginaAtual, totalPaginas);
  const inicio = (pagina - 1) * pageSize;
  const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + pageSize);
  const todosSelecionadosPagina = embrioesPagina.every((e) => embrioesSelecionados.has(e.id));
  const algunsSelecionadosPagina = embrioesPagina.some((e) => embrioesSelecionados.has(e.id));

  return (
    <div className="space-y-3">
      {/* Header com seleção e paginação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelecionarTodosDaPagina(embrioesPagina)}
            className="h-8 px-2"
          >
            {todosSelecionadosPagina ? (
              <CheckSquare className="w-4 h-4 text-green-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span className="ml-2 text-xs">
              {todosSelecionadosPagina ? 'Desmarcar' : 'Selecionar página'}
            </span>
          </Button>
          {(algunsSelecionadosPagina || totalSelecionados > 0) && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              {embrioesPagina.filter((e) => embrioesSelecionados.has(e.id)).length} selecionados
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>{embrioesOrdenados.length} embriões</span>
          <span className="mx-1">•</span>
          <span>Pág. {pagina}/{totalPaginas}</span>
        </div>
      </div>

      {/* Lista de embriões - Cards responsivos */}
      <div className="grid gap-2">
        {embrioesPagina.map((embriao, index) => {
          const selecionado = embrioesSelecionados.has(embriao.id);
          const classificacao = getClassificacaoAtual(embriao);
          const isFresco = embriao.status_atual === 'FRESCO';
          const isCongelado = embriao.status_atual === 'CONGELADO';

          return (
            <div
              key={embriao.id}
              className={`
                group relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all
                ${selecionado
                  ? 'bg-green-50 border-green-200 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }
              `}
            >
              {/* Checkbox + Código */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => onToggleSelecionarEmbriao(embriao.id)}
                  className="flex-shrink-0 p-1 rounded hover:bg-slate-100"
                >
                  {selecionado ? (
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400" />
                  )}
                </button>
                <div className="flex flex-col min-w-0">
                  {embriao.identificacao ? (
                    <span className="font-mono text-sm font-medium text-slate-800 truncate">
                      {embriao.identificacao}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 italic" title="Embrião sem código de rastreabilidade">
                      Sem código
                    </span>
                  )}
                  <span className="text-xs text-slate-500 sm:hidden">
                    {embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}
                  </span>
                </div>
              </div>

              {/* Info principal - Desktop */}
              <div className="hidden sm:flex flex-1 items-center gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600 truncate" title={embriao.doadora_registro || '-'}>
                      {embriao.doadora_registro || '-'}
                    </span>
                    <span className="text-slate-400">×</span>
                    <span className="text-slate-600 truncate" title={embriao.touro_nome || '-'}>
                      {embriao.touro_nome || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges e Status */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {classificacao ? (
                  <Badge
                    variant="outline"
                    className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
                  >
                    {classificacao}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400 border-dashed text-xs">
                    Sem classificação
                  </Badge>
                )}
                <StatusBadge status={embriao.status_atual} />
                {embriao.localizacao_atual && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs hidden lg:inline-flex">
                    {embriao.localizacao_atual}
                  </Badge>
                )}
              </div>

              {/* Menu de ações */}
              <div className="flex items-center gap-1 sm:ml-2">
                {/* Ações rápidas visíveis */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onClassificar(embriao)}
                  className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                  title="Classificar"
                >
                  <Tag className="w-4 h-4" />
                </Button>

                {isFresco && classificacao && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCongelar(embriao)}
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title="Congelar"
                  >
                    <Snowflake className="w-4 h-4" />
                  </Button>
                )}

                {/* Menu dropdown para mais ações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onClassificar(embriao)}>
                      <Tag className="w-4 h-4 mr-2 text-purple-600" />
                      Classificar
                    </DropdownMenuItem>

                    {isFresco && (
                      <DropdownMenuItem
                        onClick={() => onCongelar(embriao)}
                        disabled={!classificacao}
                        className={!classificacao ? 'opacity-50' : ''}
                      >
                        <Snowflake className="w-4 h-4 mr-2 text-blue-600" />
                        Congelar
                        {!classificacao && <span className="ml-auto text-xs text-slate-400">Classificar primeiro</span>}
                      </DropdownMenuItem>
                    )}

                    {isCongelado && !embriao.cliente_id && (
                      <DropdownMenuItem onClick={() => onDirecionar(embriao)}>
                        <User className="w-4 h-4 mr-2 text-green-600" />
                        Direcionar para cliente
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => onDescartar(embriao)}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Descartar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-xs text-slate-500">
            Mostrando {inicio + 1}-{Math.min(inicio + pageSize, embrioesOrdenados.length)} de {embrioesOrdenados.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetPagina(Math.max(1, pagina - 1))}
              disabled={pagina === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Números de página */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let pageNum: number;
                if (totalPaginas <= 5) {
                  pageNum = i + 1;
                } else if (pagina <= 3) {
                  pageNum = i + 1;
                } else if (pagina >= totalPaginas - 2) {
                  pageNum = totalPaginas - 4 + i;
                } else {
                  pageNum = pagina - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pagina === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSetPagina(pageNum)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina === totalPaginas}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
