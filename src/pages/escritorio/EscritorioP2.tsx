import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Syringe, Save, CheckCircle2, X, Loader2, Search } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import { useEscritorioP2 } from '@/hooks/escritorio/useEscritorioP2';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import { uploadReportImageBackground } from '@/lib/cloudRunOcr';
import { detectCorrections } from '@/utils/escritorio/postProcess';
import type { EntryMode, P2EntryRow, OcrRow, OcrResult } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ImportHistoryList from '@/components/escritorio/ImportHistoryList';
import RelatoriosServicos from '@/pages/relatorios/RelatoriosServicos';

export interface EscritorioP2Props {
  hideHeader?: boolean;
}

export default function EscritorioP2({ hideHeader }: EscritorioP2Props = {}) {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [protocoloId, setProtocoloId] = useState('');
  const [fazendaId, setFazendaId] = useState('');
  const [dataConfirmacao, setDataConfirmacao] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [saved, setSaved] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data } = await supabase.from('fazendas').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { data: protocolos } = useQuery({
    queryKey: ['protocolos-ativos', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];
      const { data } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, data_inicio, status')
        .eq('fazenda_id', fazendaId)
        .in('status', ['EM_ANDAMENTO', 'ATIVO'])
        .order('data_inicio', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!fazendaId,
  });

  const { receptoras, isLoading, save, isSaving } = useEscritorioP2({ protocoloId: protocoloId || undefined });
  const { corrections, saveCorrections } = useOcrCorrections(fazendaId || undefined, 'p2');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<P2EntryRow[]>([]);

  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  const handleLoadReceptoras = () => {
    if (!protocoloId) { toast.error('Selecione um protocolo'); return; }
    loadReceptoras();
  };

  const ocrHook = useCloudRunOcr({
    reportType: 'p2',
    fazendaId,
  });

  const ocrFieldsReady = !!(capturedFile && fazendaId && dataConfirmacao && veterinario);

  const handleFileSelected = (file: File) => {
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOcrResult(null);
  };

  const handleAnalyze = async () => {
    if (!capturedFile || !ocrFieldsReady) return;
    setIsAnalyzing(true);
    try {
      const result = await ocrHook.processFile(capturedFile) as OcrResult;
      setOcrResult(result);

      const h = result.header;
      if (h?.veterinario?.value && !veterinario) setVeterinario(h.veterinario.value);
      if (h?.tecnico?.value && !tecnico) setTecnico(h.tecnico.value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no OCR');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOcrSave = async (reviewedRows: OcrRow[]) => {
    // Map OCR resultado (APTA/PERDA) to P2 is_perda
    const p2Rows: P2EntryRow[] = reviewedRows.map(r => {
      const matched = receptoras.find(
        rec => rec.registro.toUpperCase() === (r.registro.matched_value || r.registro.value).toUpperCase()
      );
      return {
        protocolo_receptora_id: matched?.protocolo_receptora_id || '',
        receptora_id: matched?.receptora_id || '',
        registro: r.registro.matched_value || r.registro.value,
        nome: matched?.nome,
        raca: r.raca.value,
        is_perda: r.resultado.value.toUpperCase() === 'PERDA',
      };
    }).filter(r => r.protocolo_receptora_id);

    setRows(p2Rows);
    if (ocrResult) {
      const corrs = detectCorrections(ocrResult.rows, reviewedRows, 'p2', fazendaId, veterinario);
      if (corrs.length > 0) await saveCorrections(corrs);
    }
    setOcrResult(null);
    setMode('manual');
    toast.info(`${p2Rows.length} linhas importadas do OCR. Revise e salve.`);
  };

  const togglePerda = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, is_perda: !r.is_perda } : r));
  };

  const handleSave = async () => {
    if (!dataConfirmacao) { toast.error('Preencha a data de confirmação'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    try {
      const importRecord = await createImport({
        report_type: 'p2',
        status: 'processing',
        fazenda_id: fazendaId,
        protocolo_id: protocoloId,
        final_data: { data_confirmacao: dataConfirmacao, veterinario, tecnico, rows },
      });

      await save({ dataConfirmacao, veterinario, tecnico, rows });
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      if (capturedFile) {
        uploadReportImageBackground(capturedFile, fazendaId, importRecord.id);
      }

      const perdasCount = rows.filter(r => r.is_perda).length;
      const aptasCount = rows.length - perdasCount;
      toast.success(`P2 confirmado: ${aptasCount} aptas, ${perdasCount} perdas`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (saved) {
    return (
      <div className={hideHeader ? "" : "space-y-6 animate-in fade-in duration-500"}>
        {!hideHeader && <PageHeader title="Protocolo — 2º Passo" icon={Syringe} />}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">P2 confirmado com sucesso!</p>
            <Button onClick={() => { setSaved(false); setRows([]); }}>Confirmar Outro P2</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={hideHeader ? "" : "space-y-6 animate-in fade-in duration-500"}>
      {!hideHeader && (
        <PageHeader
          title="Protocolo — 2º Passo (Confirmação)"
          description="Confirmar presença ou marcar perdas e consultar histórico de confirmações"
          icon={Syringe}
          actions={
            <div className="hidden sm:block">
              {/* Action helpers */}
            </div>
          }
        />
      )}

      <Tabs defaultValue="novo" className={hideHeader ? "space-y-6" : "space-y-6"}>
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="novo">Novo Registro</TabsTrigger>
          <TabsTrigger value="historico">Consultas / Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-0 space-y-8">
          <RelatoriosServicos fixedTab="protocolos" hideHeader />
          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Importações Recentes (Permite Desfazer)</h3>
            <ImportHistoryList reportType="p2" />
          </div>
        </TabsContent>

        <TabsContent value="novo" className="mt-0 space-y-6">
          <div className="flex items-center justify-end mb-4">
            <EntryModeSwitch mode={mode} onChange={setMode} />
          </div>

          {/* OCR mode: photo first */}
          {mode === 'ocr' && (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">1. Foto do Relatório</CardTitle></CardHeader>
                <CardContent>
                  <ReportScanner onFileSelected={handleFileSelected} />
                </CardContent>
              </Card>

              {capturedFile && !ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">2. Dados do Serviço</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fazenda *</Label>
                        <select value={fazendaId} onChange={e => { setFazendaId(e.target.value); setProtocoloId(''); }} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Selecione...</option>
                          {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Protocolo</Label>
                        <select value={protocoloId} onChange={e => setProtocoloId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Selecione...</option>
                          {protocolos?.map(p => <option key={p.id} value={p.id}>{p.data_inicio} ({p.status})</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Data Confirmação *</Label>
                        <Input type="date" value={dataConfirmacao} onChange={e => setDataConfirmacao(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Veterinário *</Label>
                        <Input value={veterinario} onChange={e => setVeterinario(e.target.value)} placeholder="Nome" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Técnico</Label>
                        <Input value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Nome" className="h-9" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleAnalyze} disabled={!ocrFieldsReady || isAnalyzing}>
                        {isAnalyzing ? (
                          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analisando...</>
                        ) : (
                          <><Search className="w-4 h-4 mr-1" /> Analisar Relatório</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">3. Revisão dos Dados</CardTitle></CardHeader>
                  <CardContent>
                    <OcrReviewGrid
                      rows={ocrResult.rows}
                      imageUrl={previewUrl || undefined}
                      onSave={handleOcrSave}
                      onCancel={() => { setOcrResult(null); ocrHook.reset(); }}
                      columns={['registro', 'raca', 'resultado']}
                      resultadoLabel="Status (Apta/Perda)"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fazenda</Label>
                      <select value={fazendaId} onChange={e => { setFazendaId(e.target.value); setProtocoloId(''); }} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Selecione...</option>
                        {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Protocolo</Label>
                      <select value={protocoloId} onChange={e => setProtocoloId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Selecione...</option>
                        {protocolos?.map(p => <option key={p.id} value={p.id}>{p.data_inicio} ({p.status})</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data Confirmação</Label>
                      <Input type="date" value={dataConfirmacao} onChange={e => setDataConfirmacao(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Veterinário</Label>
                      <Input value={veterinario} onChange={e => setVeterinario(e.target.value)} placeholder="Nome" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Técnico</Label>
                      <Input value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Nome" className="h-9" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={handleLoadReceptoras} disabled={!protocoloId || isLoading}>
                      {isLoading ? 'Carregando...' : 'Carregar Receptoras'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {rows.length} receptoras — {rows.filter(r => r.is_perda).length} marcadas como perda
                      </CardTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Todas são aptas por padrão. Clique no X para marcar como perda.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Registro</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Raça</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr
                              key={i}
                              className={cn(
                                'border-b border-border/50 cursor-pointer transition-colors',
                                row.is_perda ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-muted/20',
                              )}
                              onClick={() => togglePerda(i)}
                            >
                              <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                              <td className={cn('px-3 py-2 font-medium', row.is_perda && 'line-through text-red-500')}>{row.registro}</td>
                              <td className={cn('px-3 py-2', row.is_perda && 'line-through text-muted-foreground')}>{row.nome}</td>
                              <td className="px-3 py-2 text-muted-foreground">{row.raca}</td>
                              <td className="px-3 py-2 text-center">
                                {row.is_perda ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-500/10 text-red-600 border border-red-500/30">
                                    <X className="w-3 h-3" /> Perda
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-green-500/10 text-green-600 border border-green-500/30">
                                    Apta
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Salvando...' : 'Confirmar P2'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div >
  );
}
