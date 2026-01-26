import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DoseSemen } from '@/lib/types';
import { AcasalamentoComNomes } from '@/lib/types/lotesFiv';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { useLotesFiltros } from '@/hooks/useLotesFiltros';
import { useLotesFIVData } from '@/hooks/useLotesFIVData';
import { Eye, X } from 'lucide-react';
import { formatDate, extractDateOnly, diffDays, getTodayDateString } from '@/lib/utils';
import { getNomeDia, getCorDia } from '@/lib/lotesFivUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NovoLoteDialog } from '@/components/lotes/NovoLoteDialog';
import { LoteDetailView, AcasalamentoForm } from '@/components/lotes/LoteDetailView';
import { LotesHistoricoTab } from '@/components/lotes/LotesHistoricoTab';

export default function LotesFIV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados locais (não movidos para o hook)
  const [submitting, setSubmitting] = useState(false);
  const [editQuantidadeEmbrioes, setEditQuantidadeEmbrioes] = useState<{ [key: string]: string }>({});

  // Hook de filtros (gerencia estados de filtros, persistência e lógica de filtragem)
  // Precisa ser declarado antes do hook de dados para passar setHistoricoPage
  const filtrosHook = useLotesFiltros({
    lotes: [],
    pacotesParaFiltro: [],
    fazendasAspiracaoUnicas: [],
    lotesHistoricos: [],
  });

  // Hook de dados (gerencia carregamento e estados de dados)
  const {
    lotes,
    pacotes,
    fazendas,
    doadoras,
    clientes,
    loading,
    selectedLote,
    setSelectedLote,
    showLoteDetail,
    setShowLoteDetail,
    acasalamentos,
    fazendasDestinoIds,
    historicoDespachos,
    setHistoricoDespachos,
    aspiracoesDisponiveis,
    dosesDisponiveis,
    fazendaOrigemNome,
    fazendasDestinoNomes,
    dosesDisponiveisNoLote,
    dataAspiracao,
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,
    lotesHistoricos,
    loadingHistorico,
    loteExpandido,
    detalhesLoteExpandido,
    loadingDetalhes,
    loadData,
    loadLoteDetail,
    loadLotesHistoricos,
    handleExpandirLote,
  } = useLotesFIVData({
    id,
    filtroHistoricoDataInicio: filtrosHook.filtroHistoricoDataInicio,
    filtroHistoricoDataFim: filtrosHook.filtroHistoricoDataFim,
    filtroHistoricoFazenda: filtrosHook.filtroHistoricoFazenda,
    setHistoricoPage: filtrosHook.setHistoricoPage,
  });

  // Reinicializar o hook de filtros com os dados carregados
  const {
    filtroFazendaAspiracao,
    setFiltroFazendaAspiracao,
    filtroFazendaAspiracaoBusca,
    setFiltroFazendaAspiracaoBusca,
    filtroDiaCultivo,
    setFiltroDiaCultivo,
    showFazendaBusca,
    setShowFazendaBusca,
    fazendasFiltradas,
    lotesFiltrados,
    limparFiltrosAtivos,
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
    abaAtiva,
    setAbaAtiva,
    historicoPage,
    setHistoricoPage,
    HISTORICO_PAGE_SIZE,
  } = useLotesFiltros({
    lotes,
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,
    lotesHistoricos,
  });

  // Despachar embriões no D7
  const despacharEmbrioes = async () => {
    if (!selectedLote) return;

    try {
      setSubmitting(true);

      // Calcular dia atual para validar se ainda está no período permitido (até D8)
      const pacote = pacotes.find(p => p.id === selectedLote.pacote_aspiracao_id);
      let dataAspiracaoStr = extractDateOnly(pacote?.data_aspiracao || null);

      if (!dataAspiracaoStr) {
        const dataAberturaStr = extractDateOnly(selectedLote.data_abertura);
        if (dataAberturaStr) {
          const [year, month, day] = dataAberturaStr.split('-').map(Number);
          const dataAberturaDate = new Date(year, month - 1, day);
          dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
          const yearStr = dataAberturaDate.getFullYear();
          const monthStr = String(dataAberturaDate.getMonth() + 1).padStart(2, '0');
          const dayStr = String(dataAberturaDate.getDate()).padStart(2, '0');
          dataAspiracaoStr = `${yearStr}-${monthStr}-${dayStr}`;
        }
      }

      const hojeStr = getTodayDateString();
      const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(hojeStr, dataAspiracaoStr)) : 0;

      if (diaAtual > 9) {
        toast({
          title: 'Prazo expirado',
          description: 'D8 é o último dia. Não é possível criar embriões após o D8. O lote será fechado e não aparecerá mais na lista.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const acasalamentosComQuantidade = acasalamentos.filter(ac => {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || ac.quantidade_embrioes?.toString() || '0');
        return quantidade > 0;
      });

      if (acasalamentosComQuantidade.length === 0) {
        toast({
          title: 'Nenhum embrião para despachar',
          description: 'Preencha a quantidade de embriões em pelo menos um acasalamento antes de despachar.',
          variant: 'destructive',
        });
        return;
      }

      for (const ac of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || ac.quantidade_embrioes?.toString() || '0');
        const quantidadeOocitos = ac.quantidade_oocitos ?? 0;

        if (quantidade > quantidadeOocitos) {
          const doadoraNome = ac.doadora_nome || ac.doadora_registro || 'Doadora desconhecida';
          toast({
            title: 'Validação de quantidade',
            description: `O acasalamento da doadora "${doadoraNome}" possui ${quantidade} embriões, mas apenas ${quantidadeOocitos} oócitos foram usados. A quantidade de embriões não pode exceder a quantidade de oócitos disponíveis.`,
            variant: 'destructive',
          });
          return;
        }
      }

      const nomePacote = `${fazendaOrigemNome} - ${fazendasDestinoNomes.join(', ')}`;
      const dataDespacho = new Date().toISOString().split('T')[0];

      if (!fazendasDestinoIds.length) {
        toast({
          title: 'Erro ao despachar',
          description: 'É necessário ter pelo menos uma fazenda destino configurada no lote.',
          variant: 'destructive',
        });
        return;
      }

      let siglaFazenda = '';
      let prefixoIdentificacao = '';

      if (pacote?.fazenda_id) {
        const { data: fazendaOrigem, error: fazendaError } = await supabase
          .from('fazendas')
          .select('sigla')
          .eq('id', pacote.fazenda_id)
          .single();

        if (!fazendaError && fazendaOrigem?.sigla) {
          siglaFazenda = fazendaOrigem.sigla;
          const dataAsp = dataAspiracaoStr || '';
          const ddmm = dataAsp.slice(8, 10) + dataAsp.slice(5, 7);
          prefixoIdentificacao = `${siglaFazenda}-${ddmm}`;
        }
      }

      let proximoNumero = 1;
      if (prefixoIdentificacao) {
        const { count, error: countError } = await supabase
          .from('embrioes')
          .select('*', { count: 'exact', head: true })
          .like('identificacao', `${prefixoIdentificacao}-%`);

        if (!countError && count !== null) {
          proximoNumero = count + 1;
        }
      }

      const embrioesParaCriar: Array<{
        lote_fiv_id: string;
        lote_fiv_acasalamento_id: string;
        status_atual: string;
        identificacao?: string;
      }> = [];
      const acasalamentosDespachados: Array<{ acasalamento_id: string; quantidade: number; doadora?: string; dose?: string }> = [];

      let contadorEmbriao = 0;
      for (const acasalamento of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || acasalamento.quantidade_embrioes?.toString() || '0');

        if (quantidade > 0) {
          for (let i = 0; i < quantidade; i++) {
            const embriao: {
              lote_fiv_id: string;
              lote_fiv_acasalamento_id: string;
              status_atual: string;
              identificacao?: string;
            } = {
              lote_fiv_id: selectedLote.id,
              lote_fiv_acasalamento_id: acasalamento.id,
              status_atual: 'FRESCO',
            };

            if (prefixoIdentificacao) {
              const numeroStr = String(proximoNumero + contadorEmbriao).padStart(3, '0');
              embriao.identificacao = `${prefixoIdentificacao}-${numeroStr}`;
            }

            embrioesParaCriar.push(embriao);
            contadorEmbriao++;
          }

          acasalamentosDespachados.push({
            acasalamento_id: acasalamento.id,
            quantidade,
            doadora: acasalamento.doadora_registro || acasalamento.doadora_nome,
            dose: acasalamento.dose_nome,
          });
        }
      }

      if (embrioesParaCriar.length > 0) {
        const { error: embrioesError } = await supabase
          .from('embrioes')
          .insert(embrioesParaCriar);

        if (embrioesError) {
          throw embrioesError;
        }
      }

      const historicoDespacho = {
        id: `${selectedLote.id}-${dataDespacho}`,
        data_despacho: dataDespacho,
        acasalamentos: acasalamentosDespachados,
      };

      setHistoricoDespachos([historicoDespacho, ...historicoDespachos]);

      const updates = acasalamentosComQuantidade.map(ac =>
        supabase
          .from('lote_fiv_acasalamentos')
          .update({ quantidade_embrioes: null })
          .eq('id', ac.id)
      );

      await Promise.all(updates);

      setEditQuantidadeEmbrioes({});

      toast({
        title: 'Embriões despachados',
        description: `${embrioesParaCriar.length} embrião(ões) foram despachados para ${nomePacote}.`,
      });

      loadLoteDetail(selectedLote.id);
    } catch (error) {
      toast({
        title: 'Erro ao despachar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAcasalamento = async (formData: AcasalamentoForm) => {
    if (!selectedLote) return;

    const quantidadeFracionada = parseFloat(formData.quantidade_fracionada) || 0;

    try {
      setSubmitting(true);

      const aspiracaoSelecionada = aspiracoesDisponiveis.find(
        (a) => a.id === formData.aspiracao_doadora_id
      );
      const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;

      const quantidadeOocitos = parseInt(formData.quantidade_oocitos) || 0;

      if (quantidadeOocitos > oocitosDisponiveis) {
        toast({
          title: 'Erro de validação',
          description: `A quantidade de oócitos (${quantidadeOocitos}) não pode ser maior que os oócitos disponíveis (${oocitosDisponiveis})`,
          variant: 'destructive',
        });
        throw new Error('Validação falhou');
      }

      const { data: doseAtual, error: doseAtualError } = await supabase
        .from('doses_semen')
        .select('id, quantidade')
        .eq('id', formData.dose_semen_id)
        .single();
      if (doseAtualError) throw doseAtualError;

      const quantidadeDisponivel = doseAtual?.quantidade ?? 0;
      if (quantidadeDisponivel < quantidadeFracionada) {
        toast({
          title: 'Estoque insuficiente',
          description: `Quantidade disponível (${quantidadeDisponivel}) é menor que a quantidade fracionada (${quantidadeFracionada}).`,
          variant: 'destructive',
        });
        throw new Error('Estoque insuficiente');
      }

      const acasalamentoParaInserir = {
        lote_fiv_id: selectedLote.id,
        aspiracao_doadora_id: formData.aspiracao_doadora_id,
        dose_semen_id: formData.dose_semen_id,
        quantidade_fracionada: quantidadeFracionada,
        quantidade_oocitos: quantidadeOocitos > 0 ? quantidadeOocitos : null,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase.from('lote_fiv_acasalamentos').insert([acasalamentoParaInserir]);

      if (error) throw error;

      const novaQuantidade = quantidadeDisponivel - quantidadeFracionada;
      const { error: doseUpdateError } = await supabase
        .from('doses_semen')
        .update({ quantidade: novaQuantidade })
        .eq('id', doseAtual?.id || '');
      if (doseUpdateError) throw doseUpdateError;

      toast({
        title: 'Acasalamento adicionado',
        description: 'Acasalamento adicionado com sucesso',
      });

      await loadLoteDetail(selectedLote.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (!errorMessage.includes('Validação') && !errorMessage.includes('Estoque')) {
        toast({
          title: 'Erro ao adicionar acasalamento',
          description: errorMessage.includes('RLS') || errorMessage.includes('policy')
            ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
            : errorMessage,
          variant: 'destructive',
        });
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !selectedLote) {
    return <LoadingSpinner />;
  }

  // Se estiver visualizando um lote específico
  if (selectedLote && showLoteDetail) {
    return (
      <LoteDetailView
        lote={selectedLote}
        acasalamentos={acasalamentos}
        aspiracoesDisponiveis={aspiracoesDisponiveis}
        dosesDisponiveis={dosesDisponiveis}
        dosesDisponiveisNoLote={dosesDisponiveisNoLote}
        doadoras={doadoras}
        clientes={clientes}
        historicoDespachos={historicoDespachos}
        dataAspiracao={dataAspiracao}
        fazendaOrigemNome={fazendaOrigemNome}
        fazendasDestinoNomes={fazendasDestinoNomes}
        submitting={submitting}
        onBack={() => {
          setShowLoteDetail(false);
          setSelectedLote(null);
        }}
        onAddAcasalamento={handleAddAcasalamento}
        onDespacharEmbrioes={despacharEmbrioes}
        onUpdateQuantidadeEmbrioes={(acasalamentoId, quantidade) => {
          setEditQuantidadeEmbrioes({
            ...editQuantidadeEmbrioes,
            [acasalamentoId]: quantidade,
          });
        }}
        editQuantidadeEmbrioes={editQuantidadeEmbrioes}
      />
    );
  }

  // Lista de lotes
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes FIV"
        description="Gerenciar lotes de fecundação in vitro"
        actions={
          <NovoLoteDialog
            pacotes={pacotes}
            clientes={clientes}
            fazendas={fazendas}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={abaAtiva} onValueChange={(value) => setAbaAtiva(value as 'ativos' | 'historico')}>
            <TabsList className="mb-6">
              <TabsTrigger value="ativos">Lotes Ativos</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="ativos" className="mt-0">
              {/* Filtros */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-[250px] relative fazenda-busca-container">
                  <Label htmlFor="filtro-fazenda-aspiração">Filtrar por Fazenda da Aspiração</Label>
                  <div className="relative">
                    <Input
                      id="filtro-fazenda-aspiração"
                      placeholder="Digite para buscar fazenda..."
                      value={filtroFazendaAspiracaoBusca}
                      onChange={(e) => {
                        setFiltroFazendaAspiracaoBusca(e.target.value);
                        setShowFazendaBusca(true);
                        if (!e.target.value) {
                          setFiltroFazendaAspiracao('');
                        }
                      }}
                      onFocus={() => setShowFazendaBusca(true)}
                    />
                    {filtroFazendaAspiracao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-7 w-7 p-0"
                        onClick={() => {
                          setFiltroFazendaAspiracao('');
                          setFiltroFazendaAspiracaoBusca('');
                          setShowFazendaBusca(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {showFazendaBusca && fazendasFiltradas.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        {fazendasFiltradas.map((fazenda) => (
                          <div
                            key={fazenda.id}
                            className="px-4 py-2 hover:bg-slate-100 cursor-pointer"
                            onClick={() => {
                              setFiltroFazendaAspiracao(fazenda.id);
                              setFiltroFazendaAspiracaoBusca(fazenda.nome);
                              setShowFazendaBusca(false);
                            }}
                          >
                            {fazenda.nome}
                          </div>
                        ))}
                      </div>
                    )}
                    {showFazendaBusca && filtroFazendaAspiracaoBusca && fazendasFiltradas.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-4 text-sm text-slate-500">
                        Nenhuma fazenda encontrada
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="filtro-dia-cultivo">Filtrar por Dia do Cultivo</Label>
                  <Select
                    value={filtroDiaCultivo || undefined}
                    onValueChange={(value) => setFiltroDiaCultivo(value || '')}
                  >
                    <SelectTrigger id="filtro-dia-cultivo">
                      <SelectValue placeholder="Todos os dias" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((dia) => (
                        <SelectItem key={dia} value={dia.toString()}>
                          D{dia} - {getNomeDia(dia)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(filtroFazendaAspiracao || filtroDiaCultivo) && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={limparFiltrosAtivos}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                )}
              </div>

              {lotesFiltrados.length === 0 ? (
                <EmptyState
                  title={lotes.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote encontrado'}
                  description={
                    lotes.length === 0
                      ? 'Crie um novo lote para começar.'
                      : 'Ajuste os filtros para encontrar outros lotes.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aspiração</TableHead>
                      <TableHead>Fazendas Destino</TableHead>
                      <TableHead>Dia do Cultivo</TableHead>
                      <TableHead>Acasalamentos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotesFiltrados.map((lote) => (
                      <TableRow key={lote.id}>
                        <TableCell>
                          {lote.pacote_data && formatDate(lote.pacote_data)} - {lote.pacote_nome}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0 ? (
                              lote.fazendas_destino_nomes.map((nome, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {nome}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lote.dia_atual !== undefined ? (
                            <Badge
                              variant="outline"
                              className={`font-semibold ${getCorDia(lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1))}`}
                            >
                              {(() => {
                                const diaCultivo = lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1);
                                return diaCultivo === -1
                                  ? `D-1 - ${getNomeDia(diaCultivo)}`
                                  : `D${diaCultivo} - ${getNomeDia(diaCultivo)}`;
                              })()}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{lote.quantidade_acasalamentos ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/lotes-fiv/${lote.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-0">
              <LotesHistoricoTab
                lotesHistoricos={lotesHistoricos}
                fazendas={fazendas}
                detalhesLoteExpandido={detalhesLoteExpandido}
                loteExpandido={loteExpandido}
                loadingHistorico={loadingHistorico}
                loadingDetalhes={loadingDetalhes}
                filtroHistoricoDataInicio={filtroHistoricoDataInicio}
                setFiltroHistoricoDataInicio={setFiltroHistoricoDataInicio}
                filtroHistoricoDataFim={filtroHistoricoDataFim}
                setFiltroHistoricoDataFim={setFiltroHistoricoDataFim}
                filtroHistoricoFazenda={filtroHistoricoFazenda}
                setFiltroHistoricoFazenda={setFiltroHistoricoFazenda}
                filtroHistoricoFazendaBusca={filtroHistoricoFazendaBusca}
                setFiltroHistoricoFazendaBusca={setFiltroHistoricoFazendaBusca}
                showFazendaBuscaHistorico={showFazendaBuscaHistorico}
                setShowFazendaBuscaHistorico={setShowFazendaBuscaHistorico}
                historicoPage={historicoPage}
                setHistoricoPage={setHistoricoPage}
                HISTORICO_PAGE_SIZE={HISTORICO_PAGE_SIZE}
                onLoadHistorico={loadLotesHistoricos}
                onExpandirLote={handleExpandirLote}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
