import { useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TestTube, Save, CheckCircle2, Plus, Trash2, Loader2, Search } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGridAspiracao from '@/components/escritorio/OcrReviewGridAspiracao';
import AnimalAutocomplete from '@/components/escritorio/AnimalAutocomplete';
import { useEscritorioAspiracao } from '@/hooks/escritorio/useEscritorioAspiracao';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import { uploadReportImageBackground } from '@/lib/cloudRunOcr';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ImportHistoryList from '@/components/escritorio/ImportHistoryList';
import RelatoriosServicos from '@/pages/relatorios/RelatoriosServicos';
import type { EntryMode, AspiracaoEntryRow, OcrAspiracaoRow, OcrAspiracaoResult } from '@/lib/types/escritorio';

const EMPTY_ROW: AspiracaoEntryRow = {
  registro: '', raca: '', horario_aspiracao: '', hora_final: '',
  atresicos: 0, degenerados: 0, expandidos: 0, desnudos: 0, viaveis: 0, total: 0,
};

export default function EscritorioAspiracao() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [fazendaId, setFazendaId] = useState('');
  const [fazendaDestinoId, setFazendaDestinoId] = useState('');
  const [dataAspiracao, setDataAspiracao] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<AspiracaoEntryRow[]>([{ ...EMPTY_ROW }]);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrAspiracaoResult | null>(null);

  const { doadoras, fazendas, save, isSaving } = useEscritorioAspiracao({ fazendaId: fazendaId || undefined });
  const { corrections } = useOcrCorrections(fazendaId || undefined, 'aspiracao');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const ocrHook = useCloudRunOcr({
    reportType: 'aspiracao',
    fazendaId,
  });

  const ocrFieldsReady = !!(capturedFile && fazendaId && dataAspiracao && veterinario && tecnico);

  const handleFileSelected = (file: File) => {
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setOcrResult(null);
  };

  const handleAnalyze = async () => {
    if (!capturedFile || !ocrFieldsReady) return;
    setIsAnalyzing(true);
    try {
      const result = await ocrHook.processFile(capturedFile) as OcrAspiracaoResult;
      setOcrResult(result);

      // Auto-fill header fields from OCR if better data
      const h = result.header;
      if (h?.veterinario?.value && !veterinario) setVeterinario(h.veterinario.value);
      if (h?.tecnico?.value && !tecnico) setTecnico(h.tecnico.value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no OCR');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOcrSave = (reviewedRows: OcrAspiracaoRow[]) => {
    // Convert OCR rows to entry rows
    const entryRows: AspiracaoEntryRow[] = reviewedRows.map(r => {
      const matched = doadoras.find(
        d => d.registro.toUpperCase() === (r.registro.matched_value || r.registro.value).toUpperCase()
      );
      return {
        doadora_id: matched?.id,
        registro: r.registro.matched_value || r.registro.value,
        nome: matched?.nome,
        raca: r.raca.value,
        horario_aspiracao: '',
        hora_final: '',
        atresicos: r.atresicos.value || 0,
        degenerados: r.degenerados.value || 0,
        expandidos: r.expandidos.value || 0,
        desnudos: r.desnudos.value || 0,
        viaveis: r.viaveis.value || 0,
        total: r.total.value || 0,
      };
    }).filter(r => r.registro);

    setRows(entryRows);
    setOcrResult(null);
    setMode('manual');
    toast.info(`${entryRows.length} linhas importadas do OCR. Revise e salve.`);
  };

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: string, value: string | number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (['atresicos', 'degenerados', 'expandidos', 'desnudos', 'viaveis'].includes(field)) {
        updated.total = (Number(updated.atresicos) || 0) + (Number(updated.degenerados) || 0) +
          (Number(updated.expandidos) || 0) + (Number(updated.desnudos) || 0) + (Number(updated.viaveis) || 0);
      }
      return updated;
    }));
  };

  const handleAnimalSelect = (idx: number, value: string, animal?: any) => {
    if (animal) {
      setRows(prev => prev.map((r, i) => i === idx ? {
        ...r,
        doadora_id: animal.id,
        registro: animal.registro,
        nome: animal.nome,
        raca: animal.raca || '',
        isNew: false,
      } : r));
    } else {
      updateRow(idx, 'registro', value);
    }
  };

  const handleSave = async () => {
    if (!fazendaId) { toast.error('Selecione uma fazenda'); return; }
    if (!dataAspiracao) { toast.error('Preencha a data'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    const filled = rows.filter(r => r.registro && r.doadora_id);
    if (filled.length === 0) { toast.error('Nenhuma doadora com registro válido'); return; }

    try {
      const importRecord = await createImport({
        report_type: 'aspiracao',
        status: 'processing',
        fazenda_id: fazendaId,
        final_data: { dataAspiracao, horarioInicio, veterinario, tecnico, observacoes, doadoras: filled },
      });

      const result = await save({
        fazendaDestinoId: fazendaDestinoId || undefined,
        dataAspiracao, horarioInicio, veterinario, tecnico, observacoes, doadoras: filled,
      });

      await updateImport({
        id: importRecord.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        pacote_aspiracao_id: (result as any)?.pacote_id,
      });

      // Background: upload image for audit trail
      if (capturedFile) {
        uploadReportImageBackground(capturedFile, fazendaId, importRecord.id);
      }

      toast.success(`Aspiração registrada: ${filled.length} doadoras, ${filled.reduce((s, r) => s + r.total, 0)} oócitos`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (saved) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Aspiração Folicular" icon={TestTube} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">Aspiração registrada!</p>
            <Button onClick={() => { setSaved(false); setRows([{ ...EMPTY_ROW }]); }}>Registrar Nova Aspiração</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Aspiração Folicular"
        description="Registrar aspirações via foto ou entrada manual e consultar o histórico de serviços"
        icon={TestTube}
        actions={
          <div className={mode === 'ocr' ? 'hidden sm:block' : 'hidden sm:block'}>
            {/* Actions kept simple */}
          </div>
        }
      />

      <Tabs defaultValue="novo" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="novo">Novo Registro</TabsTrigger>
          <TabsTrigger value="historico">Consultas / Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-0 space-y-8">
          <RelatoriosServicos fixedTab="aspiracoes" hideHeader />
          <div className="pt-6 border-t border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Importações Recentes (Permite Desfazer)</h3>
            <ImportHistoryList reportType="aspiracao" />
          </div>
        </TabsContent>

        <TabsContent value="novo" className="mt-0 space-y-6">
          <div className="flex items-center justify-end mb-4">
            <EntryModeSwitch mode={mode} onChange={setMode} />
          </div>

          {mode === 'ocr' && (
            <>
              {/* Card 1: Foto */}
              <Card>
                <CardHeader><CardTitle className="text-base">1. Foto do Relatório</CardTitle></CardHeader>
                <CardContent>
                  <ReportScanner onFileSelected={handleFileSelected} />
                </CardContent>
              </Card>

              {/* Card 2: Dados (after photo) */}
              {capturedFile && !ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">2. Dados da Aspiração</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fazenda (origem) *</Label>
                        <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Selecione...</option>
                          {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Data *</Label>
                        <Input type="date" value={dataAspiracao} onChange={e => setDataAspiracao(e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Veterinário *</Label>
                        <Input value={veterinario} onChange={e => setVeterinario(e.target.value)} placeholder="Nome" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Técnico *</Label>
                        <Input value={tecnico} onChange={e => setTecnico(e.target.value)} placeholder="Nome" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fazenda (destino lab)</Label>
                        <select value={fazendaDestinoId} onChange={e => setFazendaDestinoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Mesma</option>
                          {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Horário Início</Label>
                        <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} className="h-9" />
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

              {/* Card 3: Revisão OCR */}
              {ocrResult && (
                <Card>
                  <CardHeader><CardTitle className="text-base">3. Revisão dos Dados Extraídos</CardTitle></CardHeader>
                  <CardContent>
                    <OcrReviewGridAspiracao
                      rows={ocrResult.rows}
                      imageUrl={previewUrl || undefined}
                      onSave={handleOcrSave}
                      onCancel={() => { setOcrResult(null); ocrHook.reset(); }}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {mode === 'manual' && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fazenda (origem)</Label>
                      <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Selecione...</option>
                        {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fazenda (destino lab)</Label>
                      <select value={fazendaDestinoId} onChange={e => setFazendaDestinoId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="">Mesma</option>
                        {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <Input type="date" value={dataAspiracao} onChange={e => setDataAspiracao(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Horário Início</Label>
                      <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} className="h-9" />
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
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{rows.length} doadora{rows.length > 1 ? 's' : ''}</CardTitle>
                    <Button variant="outline" size="sm" onClick={addRow}>
                      <Plus className="w-4 h-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                      <div className="grid grid-cols-[40px_180px_80px_60px_60px_60px_60px_60px_60px_40px] gap-1 text-xs font-medium text-muted-foreground mb-2 px-1">
                        <span>#</span><span>Doadora</span><span>Raça</span>
                        <span>ATR</span><span>DEG</span><span>EXP</span><span>DES</span><span>VIA</span><span>Total</span>
                        <span></span>
                      </div>
                      {rows.map((row, i) => (
                        <div key={i} className="grid grid-cols-[40px_180px_80px_60px_60px_60px_60px_60px_60px_40px] gap-1 items-center mb-1">
                          <span className="text-sm text-muted-foreground pl-1">{i + 1}</span>
                          <AnimalAutocomplete
                            animals={doadoras}
                            value={row.registro}
                            onChange={(v, a) => handleAnimalSelect(i, v, a)}
                          />
                          <Input value={row.raca || ''} onChange={e => updateRow(i, 'raca', e.target.value)} className="h-8 text-sm" placeholder="Raça" />
                          <Input type="number" min={0} value={row.atresicos || ''} onChange={e => updateRow(i, 'atresicos', Number(e.target.value))} className="h-8 text-sm text-center" />
                          <Input type="number" min={0} value={row.degenerados || ''} onChange={e => updateRow(i, 'degenerados', Number(e.target.value))} className="h-8 text-sm text-center" />
                          <Input type="number" min={0} value={row.expandidos || ''} onChange={e => updateRow(i, 'expandidos', Number(e.target.value))} className="h-8 text-sm text-center" />
                          <Input type="number" min={0} value={row.desnudos || ''} onChange={e => updateRow(i, 'desnudos', Number(e.target.value))} className="h-8 text-sm text-center" />
                          <Input type="number" min={0} value={row.viaveis || ''} onChange={e => updateRow(i, 'viaveis', Number(e.target.value))} className="h-8 text-sm text-center" />
                          <span className="text-sm font-medium text-center">{row.total}</span>
                          {rows.length > 1 && (
                            <button onClick={() => removeRow(i)} className="p-1 text-muted-foreground hover:text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      Total geral: <span className="font-medium text-foreground">{rows.reduce((s, r) => s + r.total, 0)}</span> oócitos
                      {' '}| Viáveis: <span className="font-medium text-foreground">{rows.reduce((s, r) => s + (r.viaveis || 0), 0)}</span>
                    </div>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-1" />
                      {isSaving ? 'Salvando...' : 'Salvar Aspiração'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
