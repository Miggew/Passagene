/**
 * Componente para exibir a aba de histórico de Lotes FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { Fazenda } from '@/lib/types';
import { LoteHistorico, DetalhesLoteHistorico } from '@/lib/types/lotesFiv';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { Search, X, ChevronDown, ChevronUp, Package, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface LotesHistoricoTabProps {
  // Dados
  lotesHistoricos: LoteHistorico[];
  fazendas: Fazenda[];
  detalhesLoteExpandido: DetalhesLoteHistorico | null;
  loteExpandido: string | null;

  // Estados de loading
  loadingHistorico: boolean;
  loadingDetalhes: boolean;

  // Filtros
  filtroHistoricoDataInicio: string;
  setFiltroHistoricoDataInicio: (value: string) => void;
  filtroHistoricoDataFim: string;
  setFiltroHistoricoDataFim: (value: string) => void;
  filtroHistoricoFazenda: string;
  setFiltroHistoricoFazenda: (value: string) => void;
  filtroHistoricoFazendaBusca: string;
  setFiltroHistoricoFazendaBusca: (value: string) => void;
  showFazendaBuscaHistorico: boolean;
  setShowFazendaBuscaHistorico: (value: boolean) => void;

  // Paginação
  historicoPage: number;
  setHistoricoPage: (value: number) => void;
  HISTORICO_PAGE_SIZE: number;

  // Callbacks
  onLoadHistorico: () => void;
  onExpandirLote: (loteId: string) => void;
}

export function LotesHistoricoTab({
  lotesHistoricos,
  fazendas,
  detalhesLoteExpandido,
  loteExpandido,
  loadingHistorico,
  loadingDetalhes,
  filtroHistoricoDataInicio,
  setFiltroHistoricoDataInicio,
  filtroHistoricoDataFim,
  setFiltroHistoricoDataFim,
  filtroHistoricoFazenda,
  setFiltroHistoricoFazenda,
  filtroHistoricoFazendaBusca,
  setFiltroHistoricoFazendaBusca,
  showFazendaBuscaHistorico,
  setShowFazendaBuscaHistorico,
  historicoPage,
  setHistoricoPage,
  HISTORICO_PAGE_SIZE,
  onLoadHistorico,
  onExpandirLote,
}: LotesHistoricoTabProps) {
  const totalPaginas = Math.max(1, Math.ceil(lotesHistoricos.length / HISTORICO_PAGE_SIZE));

  const handleLimparFiltros = () => {
    setFiltroHistoricoDataInicio('');
    setFiltroHistoricoDataFim('');
    setFiltroHistoricoFazenda('');
    setFiltroHistoricoFazendaBusca('');
    setShowFazendaBuscaHistorico(false);
    onLoadHistorico();
  };

  return (
    <div className="mt-0">
      {/* Filtros do Histórico */}
      <div className="flex gap-4 mb-6 flex-wrap items-end">
        <div className="flex-1 min-w-[280px]">
          <div className="mb-2">
            <Label className="text-sm font-medium text-slate-700">Período de Busca</Label>
            <p className="text-xs text-slate-500 mt-0.5">Filtro pela data D0 (Fecundação) do lote</p>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="filtro-historico-data-inicio" className="text-xs text-slate-500 font-normal">
                Data Início
              </Label>
              <DatePickerBR
                value={filtroHistoricoDataInicio}
                onChange={(date) => setFiltroHistoricoDataInicio(date || '')}
                placeholder="Data inicial"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="filtro-historico-data-fim" className="text-xs text-slate-500 font-normal">
                Data Fim
              </Label>
              <DatePickerBR
                value={filtroHistoricoDataFim}
                onChange={(date) => setFiltroHistoricoDataFim(date || '')}
                placeholder="Data final"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-[250px] relative fazenda-busca-historico-container">
          <Label htmlFor="filtro-historico-fazenda">Fazenda de Origem</Label>
          <div className="relative">
            <Input
              id="filtro-historico-fazenda"
              placeholder="Digite para buscar fazenda..."
              value={filtroHistoricoFazendaBusca}
              onChange={(e) => {
                setFiltroHistoricoFazendaBusca(e.target.value);
                setShowFazendaBuscaHistorico(true);
                if (!e.target.value) {
                  setFiltroHistoricoFazenda('');
                }
              }}
              onFocus={() => setShowFazendaBuscaHistorico(true)}
            />
            {filtroHistoricoFazenda && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => {
                  setFiltroHistoricoFazenda('');
                  setFiltroHistoricoFazendaBusca('');
                  setShowFazendaBuscaHistorico(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {showFazendaBuscaHistorico && fazendas.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                {fazendas
                  .filter((f) => f.nome.toLowerCase().includes(filtroHistoricoFazendaBusca.toLowerCase()))
                  .map((fazenda) => (
                    <div
                      key={fazenda.id}
                      className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                      onClick={() => {
                        setFiltroHistoricoFazenda(fazenda.id);
                        setFiltroHistoricoFazendaBusca(fazenda.nome);
                        setShowFazendaBuscaHistorico(false);
                      }}
                    >
                      {fazenda.nome}
                    </div>
                  ))}
              </div>
            )}
            {showFazendaBuscaHistorico && filtroHistoricoFazendaBusca && fazendas.filter((f) => f.nome.toLowerCase().includes(filtroHistoricoFazendaBusca.toLowerCase())).length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-sm text-slate-500">
                Nenhuma fazenda encontrada
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onLoadHistorico}
            disabled={loadingHistorico}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Search className="w-4 h-4 mr-2" />
            Buscar
          </Button>
          {(filtroHistoricoDataInicio || filtroHistoricoDataFim || filtroHistoricoFazenda) && (
            <Button variant="outline" onClick={handleLimparFiltros}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {loadingHistorico ? (
        <div className="py-8">
          <LoadingSpinner />
        </div>
      ) : lotesHistoricos.length === 0 ? (
        <EmptyState
          title="Nenhum lote histórico encontrado"
          description="Ajuste os filtros ou tente outro período."
        />
      ) : (
        <div className="space-y-4">
          {lotesHistoricos
            .slice(
              (historicoPage - 1) * HISTORICO_PAGE_SIZE,
              historicoPage * HISTORICO_PAGE_SIZE
            )
            .map((lote) => (
              <LoteHistoricoCard
                key={lote.id}
                lote={lote}
                isExpanded={loteExpandido === lote.id}
                detalhes={loteExpandido === lote.id ? detalhesLoteExpandido : null}
                loadingDetalhes={loadingDetalhes && loteExpandido === lote.id}
                onExpandir={() => onExpandirLote(lote.id)}
              />
            ))}

          {/* Paginação */}
          <div className="flex items-center justify-between pt-2 text-sm text-slate-600">
            <div>{lotesHistoricos.length} lotes no histórico</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoricoPage(Math.max(1, historicoPage - 1))}
                disabled={historicoPage === 1}
              >
                Anterior
              </Button>
              <span>
                Página {Math.min(historicoPage, totalPaginas)} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoricoPage(Math.min(totalPaginas, historicoPage + 1))}
                disabled={historicoPage >= totalPaginas}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente para cada card de lote histórico
interface LoteHistoricoCardProps {
  lote: LoteHistorico;
  isExpanded: boolean;
  detalhes: DetalhesLoteHistorico | null;
  loadingDetalhes: boolean;
  onExpandir: () => void;
}

function LoteHistoricoCard({
  lote,
  isExpanded,
  detalhes,
  loadingDetalhes,
  onExpandir,
}: LoteHistoricoCardProps) {
  return (
    <Card className="border-l-4 border-l-slate-400">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Lote FIV - {formatDate(lote.data_abertura)}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandir}
            disabled={loadingDetalhes}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Recolher
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Ver Detalhes Completos
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Informações Básicas */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Informações Básicas</h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Data da Aspiração:</span> {lote.pacote_data ? formatDate(lote.pacote_data) : '-'}</p>
              <p><span className="font-medium">Fazenda Origem:</span> {lote.fazenda_origem_nome || '-'}</p>
              <p><span className="font-medium">Data de Abertura:</span> {formatDate(lote.data_abertura)}</p>
              <p><span className="font-medium">Status:</span> <Badge variant="outline">{lote.status}</Badge></p>
            </div>
          </div>

          {/* Fazendas Destino */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Fazendas Destino</h3>
            <div className="flex flex-wrap gap-1">
              {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0 ? (
                lote.fazendas_destino_nomes.map((nome, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {nome}
                  </Badge>
                ))
              ) : (
                <span className="text-slate-400 text-sm">-</span>
              )}
            </div>
          </div>

          {/* Estatísticas de Produção */}
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Estatísticas</h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Acasalamentos:</span> {lote.quantidade_acasalamentos || 0}</p>
              <p><span className="font-medium">Total de Embriões:</span> {lote.total_embrioes_produzidos || 0}</p>
              <p><span className="font-medium">Total Transferidos:</span> <span className="text-green-700 font-semibold">{lote.total_embrioes_transferidos || 0}</span></p>
              <p><span className="font-medium">Total Congelados:</span> <span className="text-blue-700 font-semibold">{lote.total_embrioes_congelados || 0}</span></p>
              <p><span className="font-medium">Total Descartados:</span> <span className="text-red-700 font-semibold">{lote.total_embrioes_descartados || 0}</span></p>
              {lote.total_oocitos && (
                <p className="mt-2 pt-2 border-t border-slate-200"><span className="font-medium">Total de Oócitos:</span> {lote.total_oocitos}</p>
              )}
              {lote.total_viaveis && (
                <p><span className="font-medium">Oócitos Viáveis:</span> {lote.total_viaveis}</p>
              )}
            </div>
          </div>

          {/* Classificação dos Embriões */}
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <h3 className="font-semibold text-lg">Embriões por Classificação</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {lote.embrioes_por_classificacao.BE && (
                <div className="bg-green-50 p-2 rounded border">
                  <p className="text-xs font-medium text-green-800">BE</p>
                  <p className="text-lg font-bold text-green-900">{lote.embrioes_por_classificacao.BE}</p>
                </div>
              )}
              {lote.embrioes_por_classificacao.BN && (
                <div className="bg-blue-50 p-2 rounded border">
                  <p className="text-xs font-medium text-blue-800">BN</p>
                  <p className="text-lg font-bold text-blue-900">{lote.embrioes_por_classificacao.BN}</p>
                </div>
              )}
              {lote.embrioes_por_classificacao.BX && (
                <div className="bg-yellow-50 p-2 rounded border">
                  <p className="text-xs font-medium text-yellow-800">BX</p>
                  <p className="text-lg font-bold text-yellow-900">{lote.embrioes_por_classificacao.BX}</p>
                </div>
              )}
              {lote.embrioes_por_classificacao.BL && (
                <div className="bg-orange-50 p-2 rounded border">
                  <p className="text-xs font-medium text-orange-800">BL</p>
                  <p className="text-lg font-bold text-orange-900">{lote.embrioes_por_classificacao.BL}</p>
                </div>
              )}
              {lote.embrioes_por_classificacao.BI && (
                <div className="bg-red-50 p-2 rounded border">
                  <p className="text-xs font-medium text-red-800">BI</p>
                  <p className="text-lg font-bold text-red-900">{lote.embrioes_por_classificacao.BI}</p>
                </div>
              )}
              {lote.embrioes_por_classificacao.sem_classificacao && (
                <div className="bg-slate-50 p-2 rounded border">
                  <p className="text-xs font-medium text-slate-800">Sem Classificação</p>
                  <p className="text-lg font-bold text-slate-900">{lote.embrioes_por_classificacao.sem_classificacao}</p>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          {lote.observacoes && (
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <h3 className="font-semibold text-lg">Observações</h3>
              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border">{lote.observacoes}</p>
            </div>
          )}
        </div>

        {/* Seção Expandida - Detalhes Completos */}
        {isExpanded && (
          <LoteDetalhesExpandido
            detalhes={detalhes}
            loadingDetalhes={loadingDetalhes}
          />
        )}
      </CardContent>
    </Card>
  );
}

// Subcomponente para detalhes expandidos
interface LoteDetalhesExpandidoProps {
  detalhes: DetalhesLoteHistorico | null;
  loadingDetalhes: boolean;
}

function LoteDetalhesExpandido({ detalhes, loadingDetalhes }: LoteDetalhesExpandidoProps) {
  if (loadingDetalhes) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-200 py-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!detalhes) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-200 text-center text-slate-500 py-4 text-sm">
        Erro ao carregar detalhes
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
      {/* Informações do Pacote de Aspiração - Compacto */}
      {detalhes.pacote && (
        <div className="bg-slate-50 p-3 rounded border text-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-slate-600" />
            <span className="font-semibold">Pacote de Aspiração</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-1">
            {detalhes.pacote.data_aspiracao && (
              <div><span className="text-slate-600">Data:</span> <span className="font-medium">{formatDate(detalhes.pacote.data_aspiracao)}</span></div>
            )}
            {detalhes.pacote.horario_inicio && (
              <div><span className="text-slate-600">Hora Início:</span> <span className="font-medium">{detalhes.pacote.horario_inicio}</span></div>
            )}
            {detalhes.pacote.horario_final && (
              <div><span className="text-slate-600">Hora Fim Aspiração:</span> <span className="font-medium">{detalhes.pacote.horario_final}</span></div>
            )}
            {detalhes.pacote.veterinario_responsavel && (
              <div><span className="text-slate-600">Vet:</span> <span className="font-medium">{detalhes.pacote.veterinario_responsavel}</span></div>
            )}
            {detalhes.pacote.tecnico_responsavel && (
              <div><span className="text-slate-600">Técnico:</span> <span className="font-medium">{detalhes.pacote.tecnico_responsavel}</span></div>
            )}
            {detalhes.pacote.total_oocitos && (
              <div><span className="text-slate-600">Oócitos Totais:</span> <span className="font-medium">{detalhes.pacote.total_oocitos}</span></div>
            )}
            {detalhes.pacote.observacoes && (
              <div className="col-span-full mt-1 pt-1 border-t border-slate-200">
                <span className="text-slate-600">Obs:</span> <span className="text-slate-700">{detalhes.pacote.observacoes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela Unificada de Acasalamentos e Embriões */}
      {detalhes.acasalamentos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-600" />
            <span className="font-semibold text-sm">Acasalamentos e Embriões ({detalhes.acasalamentos.length})</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="h-8 text-xs font-semibold">#</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Doadora</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Aspiração</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Oócitos</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Viáveis</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Sêmen</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Dose</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Embriões Prod.</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Total Emb.</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Transf.</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Cong.</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Desc.</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Outros</TableHead>
                  <TableHead className="h-8 text-xs font-semibold">Classificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhes.acasalamentos.map((acasalamento, index) => {
                  const resumo = acasalamento.resumo_embrioes;
                  const transferidos = resumo?.porStatus['TRANSFERIDO'] || 0;
                  const congelados = resumo?.porStatus['CONGELADO'] || 0;
                  const descartados = resumo?.porStatus['DESCARTADO'] || 0;
                  const outros = resumo ? resumo.total - transferidos - congelados - descartados : 0;

                  const classificacoes = resumo ? Object.entries(resumo.porClassificacao)
                    .filter(([classif]) => classif !== 'sem_classificacao')
                    .sort((a, b) => b[1] - a[1])
                    .map(([classif, qty]) => `${classif}(${qty})`)
                    .join(', ') || '-' : '-';

                  // Verificar se é a mesma aspiração do acasalamento anterior
                  const acasalamentoAnterior = index > 0 ? detalhes.acasalamentos[index - 1] : null;
                  const mesmaAspiracao = acasalamentoAnterior &&
                    acasalamento.aspiracao_id &&
                    acasalamento.aspiracao_id === acasalamentoAnterior.aspiracao_id;

                  return (
                    <TableRow key={acasalamento.id} className={`text-xs ${mesmaAspiracao ? 'bg-slate-50/50' : ''}`}>
                      <TableCell className="py-2 font-medium">{index + 1}</TableCell>
                      <TableCell className="py-2">
                        {mesmaAspiracao ? (
                          <div className="text-slate-400 italic text-[10px]">↳</div>
                        ) : (
                          <>
                            <div className="font-medium">{acasalamento.doadora?.registro || '-'}</div>
                            {acasalamento.doadora?.nome && (
                              <div className="text-slate-500 text-[11px]">{acasalamento.doadora.nome}</div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {mesmaAspiracao ? (
                          <div className="text-slate-400 italic text-[10px]">↳</div>
                        ) : (
                          <>
                            {acasalamento.aspiracao?.data_aspiracao && (
                              <div>{formatDate(acasalamento.aspiracao.data_aspiracao)}</div>
                            )}
                            {acasalamento.aspiracao?.horario_aspiracao && (
                              <div className="text-slate-500 text-[11px]">{acasalamento.aspiracao.horario_aspiracao}</div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {mesmaAspiracao ? (
                          <div className="text-slate-400 italic text-[10px]">↳ (mesma aspiração)</div>
                        ) : (
                          <>
                            <div className="font-medium">{acasalamento.aspiracao?.total_oocitos ?? '-'}</div>
                            {acasalamento.aspiracao && (
                              <div className="text-[10px] text-slate-500 space-x-1">
                                {acasalamento.aspiracao.expandidos !== undefined && <span>Exp:{acasalamento.aspiracao.expandidos}</span>}
                                {acasalamento.aspiracao.atresicos !== undefined && <span>At:{acasalamento.aspiracao.atresicos}</span>}
                                {acasalamento.aspiracao.degenerados !== undefined && <span>Deg:{acasalamento.aspiracao.degenerados}</span>}
                                {acasalamento.aspiracao.desnudos !== undefined && <span>Des:{acasalamento.aspiracao.desnudos}</span>}
                              </div>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        {mesmaAspiracao ? (
                          <div className="text-slate-400 italic text-[10px]">↳</div>
                        ) : (
                          <span className="font-medium text-green-700">{acasalamento.aspiracao?.viaveis ?? '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium">{acasalamento.dose_semen?.nome || '-'}</div>
                        <div className="text-[10px] text-slate-500 space-x-1">
                          {acasalamento.dose_semen?.raca && <span>{acasalamento.dose_semen.raca}</span>}
                          {acasalamento.dose_semen?.tipo_semen && <span>• {acasalamento.dose_semen.tipo_semen}</span>}
                        </div>
                        {acasalamento.dose_semen?.cliente && (
                          <div className="text-[10px] text-slate-500">{acasalamento.dose_semen.cliente}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className="font-medium">{acasalamento.quantidade_fracionada}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <span className="font-medium text-blue-700">{acasalamento.quantidade_embrioes ?? '-'}</span>
                        {acasalamento.quantidade_oocitos !== undefined && (
                          <div className="text-[10px] text-slate-500">Usados: {acasalamento.quantidade_oocitos}</div>
                        )}
                      </TableCell>
                      {/* Resumo de Embriões */}
                      <TableCell className="py-2 text-center">
                        {resumo && resumo.total > 0 ? (
                          <span className="font-semibold">{resumo.total}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {transferidos > 0 ? (
                          <span className="text-green-700 font-medium">{transferidos}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {congelados > 0 ? (
                          <span className="text-blue-700 font-medium">{congelados}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {descartados > 0 ? (
                          <span className="text-red-700 font-medium">{descartados}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {outros > 0 ? (
                          <span className="text-slate-600 font-medium">{outros}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-[11px] text-slate-700">
                        {resumo && classificacoes !== '-' ? (
                          <div className="flex flex-wrap gap-1">
                            {classificacoes.split(', ').map((item, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] px-1 py-0 border-slate-300"
                              >
                                {item}
                              </Badge>
                            ))}
                            {resumo.porClassificacao['sem_classificacao'] && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 border-slate-300 text-slate-500"
                              >
                                Sem class.({resumo.porClassificacao['sem_classificacao']})
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Observações dos Acasalamentos (se houver) */}
      {detalhes.acasalamentos.some(a => a.observacoes) && (
        <div className="bg-amber-50 p-2 rounded border border-amber-200 text-xs">
          <div className="font-semibold mb-1 text-amber-900">Observações dos Acasalamentos:</div>
          {detalhes.acasalamentos.filter(a => a.observacoes).map((acasalamento, index) => (
            <div key={acasalamento.id} className="mb-1">
              <span className="font-medium">#{index + 1} ({acasalamento.doadora?.registro || 'N/A'}):</span> {acasalamento.observacoes}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
