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
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Star,
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
  onDescartar: (e: EmbrioCompleto) => void;
  onToggleEstrela?: (e: EmbrioCompleto) => void;
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
  onDescartar,
  onToggleEstrela,
}: PacoteEmbrioesTableProps) {
  // Após despacho, só permite descarte
  const jaFoiDespachado = pacote.disponivel_para_transferencia === true;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelecionarTodosDaPagina(embrioesPagina)}
            className="h-8 px-2"
          >
            {todosSelecionadosPagina ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-xs">
              {todosSelecionadosPagina ? 'Desmarcar' : 'Selecionar página'}
            </span>
          </Button>
          {(algunsSelecionadosPagina || totalSelecionados > 0) && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {embrioesPagina.filter((e) => embrioesSelecionados.has(e.id)).length} selecionados
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
                  ? 'bg-primary-subtle border-primary/30 shadow-sm'
                  : 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
                }
              `}
            >
              {/* Checkbox + Código */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => onToggleSelecionarEmbriao(embriao.id)}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted"
                >
                  {selecionado ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  )}
                </button>
                <div className="flex flex-col min-w-0">
                  {embriao.identificacao ? (
                    <span className="font-mono text-sm font-medium text-foreground truncate">
                      {embriao.identificacao}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 dark:text-amber-400 italic" title="Embrião sem código de rastreabilidade">
                      Sem código
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground sm:hidden">
                    {embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}
                  </span>
                </div>
              </div>

              {/* Info principal - Desktop */}
              <div className="hidden sm:flex flex-1 items-center gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-foreground truncate" title={embriao.doadora_registro || '-'}>
                      {embriao.doadora_registro || '-'}
                    </span>
                    <span className="text-muted-foreground">×</span>
                    <span className="text-foreground truncate" title={embriao.touro_nome || '-'}>
                      {embriao.touro_nome || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges e Status */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {embriao.estrela && (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" title="Embrião Top" />
                )}
                {classificacao ? (
                  <Badge
                    variant="outline"
                    className="bg-primary-subtle text-primary-subtle-foreground border-primary/30 text-xs"
                  >
                    {classificacao}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-dashed text-xs">
                    Sem classificação
                  </Badge>
                )}
                <StatusBadge status={embriao.status_atual} />
                {embriao.localizacao_atual && (
                  <Badge variant="outline" className="bg-secondary text-secondary-foreground border-primary/20 text-xs hidden lg:inline-flex">
                    {embriao.localizacao_atual}
                  </Badge>
                )}
              </div>

              {/* Menu de ações */}
              <div className="flex items-center gap-1 sm:ml-2">
                {/* Ações rápidas visíveis - desabilitadas após despacho */}
                {!jaFoiDespachado && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onClassificar(embriao)}
                      className="h-8 w-8 p-0 text-primary hover:text-primary-dark hover:bg-primary-subtle"
                      title="Classificar"
                    >
                      <Tag className="w-4 h-4" />
                    </Button>

                    {isFresco && classificacao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCongelar(embriao)}
                        className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-secondary"
                        title="Congelar"
                      >
                        <Snowflake className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}

                {/* Menu dropdown para mais ações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {!jaFoiDespachado && (
                      <>
                        <DropdownMenuItem onClick={() => onClassificar(embriao)}>
                          <Tag className="w-4 h-4 mr-2 text-primary" />
                          Classificar
                        </DropdownMenuItem>

                        {isFresco && (
                          <DropdownMenuItem
                            onClick={() => onCongelar(embriao)}
                            disabled={!classificacao}
                            className={!classificacao ? 'opacity-50' : ''}
                          >
                            <Snowflake className="w-4 h-4 mr-2 text-blue-500" />
                            Congelar
                            {!classificacao && <span className="ml-auto text-xs text-muted-foreground">Classificar primeiro</span>}
                          </DropdownMenuItem>
                        )}

                        {onToggleEstrela && (
                          <DropdownMenuItem onClick={() => onToggleEstrela(embriao)}>
                            <Star className={`w-4 h-4 mr-2 ${embriao.estrela ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                            {embriao.estrela ? 'Remover estrela' : 'Marcar como Top'}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuItem
                      onClick={() => onDescartar(embriao)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
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
