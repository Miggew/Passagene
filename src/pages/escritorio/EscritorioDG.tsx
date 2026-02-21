import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Save, CheckCircle2, Loader2, Search } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import MultiPageScanner from '@/components/escritorio/MultiPageScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import ManualEntryGrid from '@/components/escritorio/ManualEntryGrid';
import type { ColumnDef } from '@/components/escritorio/ManualEntryGrid';
import { useEscritorioDG } from '@/hooks/escritorio/useEscritorioDG';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import { uploadReportImageBackground } from '@/lib/cloudRunOcr';
import { detectCorrections } from '@/utils/escritorio/postProcess';
import type { EntryMode, DGEntryRow, OcrRow, OcrResult } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ImportHistoryList from '@/components/escritorio/ImportHistoryList';
import RelatoriosServicos from '@/pages/relatorios/RelatoriosServicos';

export default function EscritorioDG() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [fazendaId, setFazendaId] = useState('');
  const [dataTE, setDataTE] = useState('');
  const [dataDG, setDataDG] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [capturedFiles, setCapturedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fazendas').select('id, nome').order('nome');
      if (error) { toast.error('Erro ao carregar fazendas'); return []; }
      return data || [];
    },
  });

  const { receptoras, isLoading, save, isSaving } = useEscritorioDG({ fazendaId, dataTE });
  const { corrections, saveCorrections } = useOcrCorrections(fazendaId || undefined, 'dg');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<DGEntryRow[]>([]);

  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  const handleLoadReceptoras = () => {
    if (!fazendaId) { toast.error('Selecione uma fazenda'); return; }
    loadReceptoras();
  };

  const ocrHook = useCloudRunOcr({
    reportType: 'dg',
    fazendaId,
  });

  const ocrFieldsReady = !!(capturedFiles.length > 0 && fazendaId && dataDG && veterinario);

  const handleFilesChange = (files: File[]) => {
    previewUrls.forEach(u => URL.revokeObjectURL(u));
    setCapturedFiles(files);
    setPreviewUrls(files.map(f => URL.createObjectURL(f)));
    setOcrResult(null);
  };

  const handleAnalyze = async () => {
    if (capturedFiles.length === 0 || !ocrFieldsReady) return;
    setIsAnalyzing(true);
    try {
      const result = capturedFiles.length > 1
        ? await ocrHook.processMultipleFiles(capturedFiles)
        : await ocrHook.processFile(capturedFiles[0]) as OcrResult;
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

  // DG shortcuts
  const dgColumns: ColumnDef<DGEntryRow>[] = [
    { key: 'registro', label: 'Registro', readOnly: true, width: '150px' },
    { key: 'nome', label: 'Nome', readOnly: true, width: '150px' },
    { key: 'raca', label: 'Raça', readOnly: true, width: '100px' },
    {
      key: 'resultado',
      label: 'Resultado (P/V/R)',
      width: '140px',
      shortcuts: { P: 'PRENHE', V: 'VAZIA', R: 'RETOQUE' },
      autoAdvance: true,
    },
    { key: 'observacoes', label: 'Obs', width: '150px' },
  ];

  const handleRowChange = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const markRestAsPrenhe = () => {
    setRows(prev => prev.map(r => r.resultado === '' ? { ...r, resultado: 'PRENHE' } : r));
  };

  const handleSave = async () => {
    if (!dataDG) { toast.error('Preencha a data do DG'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    const filled = rows.filter(r => r.resultado !== '');
    if (filled.length === 0) { toast.error('Nenhum resultado preenchido'); return; }

    try {
      const importRecord = await createImport({
        report_type: 'dg',
        status: 'processing',
        fazenda_id: fazendaId,
        final_data: { data_diagnostico: dataDG, veterinario, tecnico, resultados: filled },
      });

      await save({ dataDiagnostico: dataDG, veterinario, tecnico, resultados: filled });
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      if (capturedFiles.length > 0) {
        capturedFiles.forEach((file, i) => {
          const suffix = capturedFiles.length > 1 ? `-p${i + 1}` : '';
          uploadReportImageBackground(file, fazendaId, `${importRecord.id}${suffix}`);
        });
      }

      toast.success(`${filled.length} diagnósticos registrados com sucesso`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleOcrSave = async (reviewedRows: OcrRow[]) => {
    const dgRows: DGEntryRow[] = reviewedRows.map(r => {
      const matched = receptoras.find(
        rec => rec.registro.toUpperCase() === (r.registro.matched_value || r.registro.value).toUpperCase()
      );
      return {
        protocolo_receptora_id: matched?.protocolo_receptora_id || '',
        receptora_id: matched?.receptora_id || '',
        registro: r.registro.matched_value || r.registro.value,
        nome: matched?.nome,
        raca: r.raca.value,
        resultado: r.resultado.value as DGEntryRow['resultado'],
        observacoes: r.obs.value,
      };
    }).filter(r => r.protocolo_receptora_id && r.resultado);

    setRows(dgRows);

    if (ocrResult) {
      const corrs = detectCorrections(ocrResult.rows, reviewedRows, 'dg', fazendaId, veterinario);
      if (corrs.length > 0) await saveCorrections(corrs);
    }

    setOcrResult(null);
    setMode('manual');
    toast.info(`${dgRows.length} linhas importadas do OCR. Revise e salve.`);
  };

  if (saved) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="DG — Diagnóstico de Gestação" icon={ThumbsUp} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">Diagnósticos registrados com sucesso!</p>
            <Button onClick={() => { setSaved(false); setRows([]); setCapturedFiles([]); setPreviewUrls([]); }}>Registrar Novo DG</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="DG — Diagnóstico de Gestação"
        description="Registrar resultados de DG via foto ou entrada manual e consultar histórico"
        icon={ThumbsUp}
        actions={
          <div className="hidden sm:block">
            {/* Action helpers */}
          </div>
        }
      />

      <Tabs defaultValue="novo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="novo">Novo Registro</TabsTrigger>
          <TabsTrigger value="historico">Consultas / Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-0 space-y-8">
          <RelatoriosServicos fixedTab="dg" hideHeader />
          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Importações Recentes (Permite Desfazer)</h3>
            <ImportHistoryList reportType="dg" />
          </div>
        </TabsContent>

        <TabsContent value="novo" className="mt-0 space-y-6">
          <div className="flex items-center justify-end mb-4">
            <EntryModeSwitch mode={mode} onChange={setMode} />
          </div>

          {/* OCR mode: photo first flow */}
          {mode === 'ocr' && (
            <>
              {/* Card 1: Foto */}
              <Card>
                <CardHeader><CardTitle className="text-base">1. Foto do Relatório</CardTitle></CardHeader>
                <CardContent>
                  <MultiPageScanner files={capturedFiles} onFilesChange={handleFilesChange} />
                </CardContent>
              </Card>

              {/* Card 2: Dados do Serviço (after photo, before OCR) */}
              {capturedFiles.length > 0 && !ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">2. Dados do Serviço</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fazenda *</Label>
                        <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Selecione...</option>
                          {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Data da TE</Label>
                        <Input type="date" value={dataTE} onChange={e => setDataTE(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Data do DG *</Label>
                        <Input type="date" value={dataDG} onChange={e => setDataDG(e.target.value)} className="h-9" />
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
                          <><Search className="w-4 h-4 mr-1" /> Analisar Relatório{capturedFiles.length > 1 ? ` (${capturedFiles.length} páginas)` : ''}</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card 3: OCR Review */}
              {ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">3. Revisão dos Dados Extraídos</CardTitle></CardHeader>
                  <CardContent>
                    <OcrReviewGrid
                      rows={ocrResult.rows}
                      imageUrls={previewUrls}
                      onSave={handleOcrSave}
                      onCancel={() => { setOcrResult(null); ocrHook.reset(); }}
                      columns={['registro', 'raca', 'resultado', 'obs']}
                      resultadoLabel="DG (P/V/R)"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <>
              {/* Filtros */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fazenda</Label>
                      <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Selecione...</option>
                        {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data da TE</Label>
                      <Input type="date" value={dataTE} onChange={e => setDataTE(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data do DG</Label>
                      <Input type="date" value={dataDG} onChange={e => setDataDG(e.target.value)} className="h-9" />
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
                    <Button variant="outline" size="sm" onClick={handleLoadReceptoras} disabled={!fazendaId || isLoading}>
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
                        {rows.length} receptoras — {rows.filter(r => r.resultado !== '').length} preenchidas
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={markRestAsPrenhe}>
                          Marcar restantes como Prenhe
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ManualEntryGrid
                      rows={rows}
                      columns={dgColumns}
                      onRowChange={handleRowChange}
                      getRowClassName={(row) =>
                        row.resultado === 'PRENHE' ? 'bg-green-500/5' :
                          row.resultado === 'VAZIA' ? 'bg-red-500/5' :
                            row.resultado === 'RETOQUE' ? 'bg-amber-500/5' : ''
                      }
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button onClick={handleSave} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-1" />
                        {isSaving ? 'Salvando...' : 'Salvar Diagnósticos'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {rows.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Atalhos: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">P</kbd> Prenhe{' '}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-xs">V</kbd> Vazia{' '}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-xs">R</kbd> Retoque{' '}
                  — Auto-avança para próxima linha
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
