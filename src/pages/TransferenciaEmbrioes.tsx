import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useTransferenciaEmbrioesData } from '@/hooks/useTransferenciaEmbrioesData';
import { useTransferenciaEmbrioesFilters } from '@/hooks/useTransferenciaEmbrioesFilters';
import { useTransferenciaHandlers } from '@/hooks/useTransferenciaHandlers';
import RelatorioTransferenciaDialog from '@/components/transferencia/RelatorioTransferenciaDialog';
import ReceptorasSelection from '@/components/transferencia/ReceptorasSelection';
import EmbrioesTablePacote from '@/components/transferencia/EmbrioesTablePacote';
import EmbrioesTableCongelados from '@/components/transferencia/EmbrioesTableCongelados';
import { ArrowRightLeft, FileText } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
  TransferenciaFormData,
  CamposPacote,
} from '@/lib/types/transferenciaEmbrioes';

const EMBRIOES_PAGE_SIZE = 20;

export default function TransferenciaEmbrioes() {
  // Estados locais do formulário
  const [formData, setFormData] = useState<TransferenciaFormData>({
    fazenda_id: '',
    pacote_id: '',
    protocolo_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  const [camposPacote, setCamposPacote] = useState<CamposPacote>({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Estado de submissão
  const [submitting, setSubmitting] = useState(false);

  // Hook de filtros e UI
  const {
    origemEmbriao,
    setOrigemEmbriao,
    filtroClienteId,
    setFiltroClienteId,
    filtroRaca,
    setFiltroRaca,
    dataPasso2,
    setDataPasso2,
    incluirCioLivre,
    setIncluirCioLivre,
    embrioesPage,
    setEmbrioesPage,
    showRelatorioDialog,
    setShowRelatorioDialog,
    relatorioData,
    setRelatorioData,
    isVisualizacaoApenas,
    setIsVisualizacaoApenas,
    resetAll: resetFiltros,
    aplicarFiltrosSessao,
    fecharRelatorio,
  } = useTransferenciaEmbrioesFilters();

  // Hook de dados
  const {
    fazendas,
    clientes,
    pacotes,
    pacotesFiltrados,
    embrioesCongelados,
    receptoras,
    setReceptoras,
    loading,
    loadingCongelados,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    loadFazendas,
    loadPacotes,
    loadClientes,
    loadEmbrioesCongelados,
    carregarReceptorasDaFazenda,
    recarregarReceptoras,
    salvarSessaoNoBanco,
    encerrarSessaoNoBanco,
    restaurarSessaoEmAndamento,
  } = useTransferenciaEmbrioesData({
    dataPasso2,
    incluirCioLivre,
    filtroClienteId,
    filtroRaca,
    formData,
  });

  // Computed values (needed for handlers hook)
  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = useMemo(() => {
    return pacoteSelecionado?.embrioes.filter(e => e.status_atual === 'FRESCO') || [];
  }, [pacoteSelecionado]);
  const hasD8Limite = embrioesDisponiveis.some(e => e.d8_limite);

  const numerosFixosEffectRuns = useRef(0);
  const numerosFixosMap = useMemo(() => {
    if (!formData.pacote_id || !pacoteSelecionado) {
      return new Map<string, number>();
    }
    const ordenados = [...embrioesDisponiveis].sort((a, b) => {
      const doadoraA = a.doadora_registro || '';
      const doadoraB = b.doadora_registro || '';
      if (doadoraA !== doadoraB) return doadoraA.localeCompare(doadoraB);
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dataA !== dataB) return dataA - dataB;
      return (a.id || '').localeCompare(b.id || '');
    });
    const numerosMap = new Map<string, number>();
    ordenados.forEach((embriao, index) => {
      numerosMap.set(embriao.id, index + 1);
    });
    return numerosMap;
  }, [formData.pacote_id, pacoteSelecionado, embrioesDisponiveis]);

  // Hook de handlers
  const {
    handleDescartarReceptora,
    handleSubmit,
    visualizarRelatorioSessao,
    handleEncerrarSessao,
  } = useTransferenciaHandlers({
    formData,
    setFormData,
    origemEmbriao,
    receptoras,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    numerosFixosMap,
    setSubmitting,
    setRelatorioData,
    setShowRelatorioDialog,
    setIsVisualizacaoApenas,
    resetFiltros,
    loadPacotes,
    loadEmbrioesCongelados,
    recarregarReceptoras,
    encerrarSessaoNoBanco,
  });

  // Salvar estado da sessão
  const salvarEstadoSessao = () => {
    const estadoSessao = {
      fazenda_id: formData.fazenda_id,
      pacote_id: formData.pacote_id,
      data_passo2: dataPasso2,
      data_te: formData.data_te,
      veterinario_responsavel: formData.veterinario_responsavel,
      tecnico_responsavel: formData.tecnico_responsavel,
      origem_embriao: origemEmbriao,
      filtro_cliente_id: filtroClienteId,
      filtro_raca: filtroRaca,
      incluir_cio_livre: incluirCioLivre,
      transferenciasSessao,
      transferenciasIdsSessao,
      embrioes_page: embrioesPage,
    };
    void salvarSessaoNoBanco(estadoSessao);
  };

  // Local handlers
  const handleFazendaChange = async (fazendaId: string) => {
    if (!fazendaId) {
      setFormData({
        ...formData,
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
      });
      setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setReceptoras([]);
      return;
    }

    setTransferenciasSessao([]);
    setTransferenciasIdsSessao([]);
    setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });

    await carregarReceptorasDaFazenda(fazendaId);
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      pacote_id: '',
      protocolo_id: '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });
  };

  const handlePacoteChange = (pacoteId: string) => {
    const pacote = pacotes.find(p => p.id === pacoteId);

    if (pacote?.pacote_info?.veterinario_responsavel && !formData.veterinario_responsavel) {
      setFormData(prev => ({
        ...prev,
        pacote_id: pacoteId,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
      setCamposPacote(prev => ({
        ...prev,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, pacote_id: pacoteId }));
    }
  };

  // Effects
  useEffect(() => {
    const carregarDados = async () => {
      await Promise.all([loadFazendas(), loadPacotes(), loadClientes()]);
      const sessaoRestaurada = await restaurarSessaoEmAndamento();
      if (sessaoRestaurada) {
        aplicarFiltrosSessao(sessaoRestaurada.filtros);
        setCamposPacote(sessaoRestaurada.camposPacote);
        setFormData(prev => ({
          ...prev,
          ...sessaoRestaurada.formData,
          embriao_id: '',
          receptora_id: '',
          protocolo_receptora_id: '',
          observacoes: '',
        }));
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.protocolo_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, incluirCioLivre, transferenciasSessao.length, transferenciasIdsSessao.length, embrioesPage]);

  useEffect(() => {
    void loadFazendas();
  }, [dataPasso2]);

  useEffect(() => {
    if (formData.fazenda_id) {
      carregarReceptorasDaFazenda(formData.fazenda_id);
    }
  }, [formData.fazenda_id, dataPasso2, incluirCioLivre]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim())) {
      loadEmbrioesCongelados();
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    setEmbrioesPage(1);
  }, [formData.pacote_id]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO') {
      setEmbrioesPage(1);
      setFormData(prev => ({ ...prev, embriao_id: '' }));
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    if (!formData.pacote_id || !pacoteSelecionado) return;
    numerosFixosEffectRuns.current += 1;
  }, [formData.pacote_id, pacoteSelecionado, numerosFixosMap]);

  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
    if (embrioesPage > totalPaginas) {
      setEmbrioesPage(totalPaginas);
    }
  }, [embrioesDisponiveis.length, embrioesPage]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferência de Embriões (TE)"
        description="Destinar embriões para receptoras sincronizadas"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Nova Transferência
            </CardTitle>
            {formData.fazenda_id && transferenciasIdsSessao.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={visualizarRelatorioSessao}
                  className="bg-slate-600 hover:bg-slate-700"
                  disabled={submitting}
                  variant="default"
                  title="Visualizar relatório da sessão atual sem encerrar"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Visualizar Relatório ({transferenciasIdsSessao.length} transferência{transferenciasIdsSessao.length > 1 ? 's' : ''})
                </Button>
                <Button
                  type="button"
                  onClick={handleEncerrarSessao}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={submitting}
                  variant="default"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {submitting ? 'Gerando...' : `Encerrar Sessão (${transferenciasIdsSessao.length} transferência${transferenciasIdsSessao.length > 1 ? 's' : ''})`}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 border-b pb-6">
              {/* Passo 1: Selecionar Fazenda */}
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">1. Fazenda onde estão as receptoras *</Label>
                <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {fazendas.map((fazenda) => (
                      <SelectItem key={fazenda.id} value={fazenda.id}>
                        {fazenda.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Passo 2: Selecionar Data do 2º Passo */}
              {formData.fazenda_id && (
                <div className="space-y-2">
                  <Label htmlFor="data_passo2">2. Data do 2º Passo (opcional)</Label>
                  <DatePickerBR
                    id="data_passo2"
                    value={dataPasso2}
                    onChange={(value) => setDataPasso2(value || '')}
                  />
                  {dataPasso2 && (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDataPasso2('')}>
                        Limpar data
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Passo 3: Incluir CIO livre */}
              {formData.fazenda_id && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="incluir-cio-livre"
                    checked={incluirCioLivre}
                    onCheckedChange={setIncluirCioLivre}
                  />
                  <Label htmlFor="incluir-cio-livre" className="cursor-pointer text-sm">
                    Incluir receptoras de CIO livre
                  </Label>
                </div>
              )}

              {/* Passo 4: Origem do Embrião */}
              {formData.fazenda_id && (
                <div className="space-y-2">
                  <Label>3. Origem do Embrião *</Label>
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={origemEmbriao === 'PACOTE' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('PACOTE')}
                      className={origemEmbriao === 'PACOTE' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      Pacote (Frescos)
                    </Button>
                    <Button
                      type="button"
                      variant={origemEmbriao === 'CONGELADO' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('CONGELADO')}
                      className={origemEmbriao === 'CONGELADO' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      Congelados
                    </Button>
                  </div>
                </div>
              )}

              {/* Seleção de Pacote ou Filtros para Congelados */}
              {formData.fazenda_id && origemEmbriao === 'PACOTE' && (
                <div className="space-y-2">
                  <Label htmlFor="pacote_id">4. Pacote de Embriões *</Label>
                  <Select value={formData.pacote_id} onValueChange={handlePacoteChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      {pacotesFiltrados.map((pacote) => (
                        <SelectItem key={pacote.id} value={pacote.id}>
                          {pacote.pacote_info?.fazenda_nome || 'N/A'} - {formatDate(pacote.data_despacho)} ({pacote.frescos} frescos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.fazenda_id && origemEmbriao === 'CONGELADO' && (
                <div className="space-y-4">
                  <Label>4. Filtros para Embriões Congelados</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="filtro_cliente">Cliente</Label>
                      <Select value={filtroClienteId} onValueChange={setFiltroClienteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro_raca">Raça</Label>
                      <Input
                        id="filtro_raca"
                        value={filtroRaca}
                        onChange={(e) => setFiltroRaca(e.target.value)}
                        placeholder="Digite a raça"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos comuns */}
              {(formData.pacote_id || origemEmbriao === 'CONGELADO') && formData.fazenda_id && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_te">5. Data da TE *</Label>
                    <DatePickerBR
                      id="data_te"
                      value={formData.data_te}
                      onChange={(value) => setFormData({ ...formData, data_te: value || '' })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="veterinario_responsavel">Veterinário Responsável *</Label>
                    <Input
                      id="veterinario_responsavel"
                      value={formData.veterinario_responsavel}
                      onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                      placeholder="Nome do veterinário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                    <Input
                      id="tecnico_responsavel"
                      value={formData.tecnico_responsavel}
                      onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                      placeholder="Nome do técnico"
                    />
                  </div>
                </div>
              )}

              {/* Seleção de Receptora */}
              {(formData.pacote_id || (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim()))) && formData.fazenda_id && (
                <ReceptorasSelection
                  receptoras={receptoras}
                  selectedReceptoraId={formData.receptora_id}
                  contagemSessaoPorReceptora={contagemSessaoPorReceptora}
                  submitting={submitting}
                  onSelectReceptora={(receptoraId, protocoloReceptoraId) => {
                    setFormData({
                      ...formData,
                      receptora_id: receptoraId,
                      protocolo_receptora_id: protocoloReceptoraId,
                    });
                  }}
                  onDescartarReceptora={handleDescartarReceptora}
                />
              )}

              {/* Lista de Embriões - Pacote */}
              {formData.pacote_id && pacoteSelecionado && (
                <EmbrioesTablePacote
                  pacote={pacoteSelecionado}
                  embrioes={embrioesDisponiveis}
                  numerosFixosMap={numerosFixosMap}
                  selectedEmbriaoId={formData.embriao_id}
                  embrioesPage={embrioesPage}
                  hasD8Limite={hasD8Limite}
                  onSelectEmbriao={(embriaoId) => setFormData({ ...formData, embriao_id: embriaoId })}
                  onPageChange={setEmbrioesPage}
                />
              )}

              {/* Lista de Embriões - Congelados */}
              {origemEmbriao === 'CONGELADO' && (
                <EmbrioesTableCongelados
                  embrioes={embrioesCongelados}
                  selectedEmbriaoId={formData.embriao_id}
                  embrioesPage={embrioesPage}
                  loadingCongelados={loadingCongelados}
                  filtroClienteId={filtroClienteId}
                  filtroRaca={filtroRaca}
                  onSelectEmbriao={(embriaoId) => setFormData({ ...formData, embriao_id: embriaoId })}
                  onPageChange={setEmbrioesPage}
                />
              )}

              {/* Campo de Observações */}
              {formData.embriao_id && formData.receptora_id && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Observações sobre a transferência"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Submit */}
            {formData.embriao_id && formData.receptora_id && (
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Registrando...' : 'Registrar Transferência'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Dialog do Relatório */}
      <RelatorioTransferenciaDialog
        open={showRelatorioDialog}
        onOpenChange={setShowRelatorioDialog}
        relatorioData={relatorioData}
        fazendaNome={fazendas.find(f => f.id === formData.fazenda_id)?.nome || 'N/A'}
        dataTe={formData.data_te}
        veterinarioResponsavel={formData.veterinario_responsavel}
        tecnicoResponsavel={formData.tecnico_responsavel}
        isVisualizacaoApenas={isVisualizacaoApenas}
        submitting={submitting}
        onFechar={fecharRelatorio}
        onConfirmarEncerrar={handleEncerrarSessao}
      />
    </div>
  );
}
