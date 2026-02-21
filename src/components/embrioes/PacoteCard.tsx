import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  AlertTriangle,
  Truck,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { PacoteEmbrioes, EmbrioCompleto } from '@/hooks/embrioes';
import { calcularDiaEmbriao } from '@/hooks/embrioes';
import { PacoteEmbrioesTable } from './PacoteEmbrioesTable';

interface ResumoPacote {
  total: number;
  classificados: number;
  semClassificacao: number;
  todosClassificados: boolean;
}

interface PacoteCardProps {
  pacote: PacoteEmbrioes;
  expandido: boolean;
  onToggleExpandir: () => void;
  onEditarFazendasDestino: () => void;
  onDespachar: () => void;
  resumoPacote: ResumoPacote;
  // Table props
  embrioesSelecionados: Set<string>;
  paginaAtual: number;
  pageSize: number;
  getClassificacaoAtual: (e: EmbrioCompleto) => string;
  onToggleSelecionarEmbriao: (id: string) => void;
  onSelecionarTodosDaPagina: (embrioes: EmbrioCompleto[]) => void;
  onSetPagina: (p: number) => void;
  onClassificar: (e: EmbrioCompleto) => void;
  onCongelar: (e: EmbrioCompleto) => void;
  onDescartar: (e: EmbrioCompleto) => void;
  onToggleEstrela?: (e: EmbrioCompleto) => void;
}

export function PacoteCard({
  pacote,
  expandido,
  onToggleExpandir,
  onEditarFazendasDestino,
  onDespachar,
  resumoPacote,
  embrioesSelecionados,
  paginaAtual,
  pageSize,
  getClassificacaoAtual,
  onToggleSelecionarEmbriao,
  onSelecionarTodosDaPagina,
  onSetPagina,
  onClassificar,
  onCongelar,
  onDescartar,
  onToggleEstrela,
}: PacoteCardProps) {
  const totalSelecionados = pacote.embrioes.filter((e) =>
    embrioesSelecionados.has(e.id)
  ).length;

  const diaEmbriao = calcularDiaEmbriao(pacote.data_fecundacao);
  const isD7 = diaEmbriao === 7;
  const isD8 = diaEmbriao === 8;
  const isVencido = diaEmbriao !== null && diaEmbriao > 8;

  // Determine urgency color
  let urgencyColor = 'from-green-500';
  let urgencyBg = 'bg-green-50 dark:bg-green-950';
  if (isD8) {
    urgencyColor = 'from-orange-500';
    urgencyBg = 'bg-orange-50 dark:bg-orange-950';
  }
  if (isVencido) {
    urgencyColor = 'from-red-500';
    urgencyBg = 'bg-red-50 dark:bg-red-950';
  }

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Indicator bar */}
      <div className={`h-1 bg-gradient-to-r ${urgencyColor} to-transparent`} />

      <CardHeader className="pb-0">
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          {/* Left section: Toggle + Info */}
          <div className="flex-1 min-w-0">
            {/* Fazenda origem e destino */}
            <div className="flex items-start gap-3">
              <button
                onClick={onToggleExpandir}
                className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors mt-0.5"
              >
                {expandido ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                {/* Origem → Destino */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">
                    {pacote.pacote_info.fazenda_nome || 'Fazenda não identificada'}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  {pacote.fazendas_destino_nomes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {pacote.fazendas_destino_nomes.map((nome, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          <MapPin className="w-3 h-3 mr-1" />
                          {nome}
                        </Badge>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEditarFazendasDestino}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        title="Editar fazendas destino"
                        aria-label="Editar fazendas destino"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-sm">Sem destino definido</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEditarFazendasDestino}
                        className="h-6 px-2 text-xs text-primary hover:text-primary-dark"
                      >
                        Definir
                      </Button>
                    </div>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                  {pacote.data_despacho && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Despacho: {formatDate(pacote.data_despacho)}
                    </span>
                  )}

                  {/* Dia do embrião badge */}
                  {diaEmbriao !== null && pacote.frescos > 0 && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${urgencyBg}`}>
                      {isD7 && (
                        <>
                          <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-green-700 dark:text-green-300 font-medium">D7 - Ideal</span>
                        </>
                      )}
                      {isD8 && (
                        <>
                          <AlertTriangle className="w-3 h-3 text-orange-600 dark:text-orange-400 animate-pulse" />
                          <span className="text-orange-700 dark:text-orange-300 font-medium">D8 - Último dia!</span>
                        </>
                      )}
                      {isVencido && (
                        <>
                          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                          <span className="text-red-700 dark:text-red-300 font-medium">D{diaEmbriao} - Vencido</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right section: Stats + Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 pl-9 lg:pl-0">
            {/* Stats */}
            <div className="flex items-center gap-4">
              {/* Total */}
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{pacote.total}</div>
                <div className="text-xs text-muted-foreground">embriões</div>
              </div>

              {/* Status breakdown */}
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-foreground">{pacote.frescos} frescos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-foreground">{pacote.congelados} congelados</span>
                </div>
                {resumoPacote.semClassificacao > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                    <span className="text-muted-foreground">{resumoPacote.semClassificacao} sem classif.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 min-w-[160px]">
              {resumoPacote.todosClassificados ? (
                <>
                  <Badge
                    variant="outline"
                    className="justify-center bg-primary-subtle dark:bg-primary/20 text-primary-dark dark:text-primary-light border-primary/30"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Todos classificados
                  </Badge>
                  {pacote.disponivel_para_transferencia ? (
                    <Badge
                      variant="outline"
                      className="justify-center bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    >
                      <Truck className="w-3 h-3 mr-1" />
                      Pronto para transferência
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={onDespachar}
                      className="h-8"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Despachar
                    </Button>
                  )}
                </>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-foreground px-1">
                    <span>Classificação</span>
                    <span className="font-medium">{resumoPacote.total - resumoPacote.semClassificacao}/{resumoPacote.total}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all"
                      style={{ width: `${((resumoPacote.total - resumoPacote.semClassificacao) / resumoPacote.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Expandable content */}
      {expandido && (
        <CardContent className="pt-4">
          <div className="border-t border-border pt-4">
            <PacoteEmbrioesTable
              pacote={pacote}
              embrioesSelecionados={embrioesSelecionados}
              paginaAtual={paginaAtual}
              pageSize={pageSize}
              totalSelecionados={totalSelecionados}
              getClassificacaoAtual={getClassificacaoAtual}
              onToggleSelecionarEmbriao={onToggleSelecionarEmbriao}
              onSelecionarTodosDaPagina={onSelecionarTodosDaPagina}
              onSetPagina={onSetPagina}
              onClassificar={onClassificar}
              onCongelar={onCongelar}
              onDescartar={onDescartar}
              onToggleEstrela={onToggleEstrela}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
