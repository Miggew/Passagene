import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, CheckCircle2, Loader2, Search } from 'lucide-react';
import { GenderIcon } from '@/components/icons/GenderIcon';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import ManualEntryGrid from '@/components/escritorio/ManualEntryGrid';
import type { ColumnDef } from '@/components/escritorio/ManualEntryGrid';
import { useEscritorioSexagem } from '@/hooks/escritorio/useEscritorioSexagem';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import { uploadReportImageBackground } from '@/lib/cloudRunOcr';
import { detectCorrections } from '@/utils/escritorio/postProcess';
import type { EntryMode, SexagemEntryRow, OcrRow, OcrResult } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function EscritorioSexagem() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [fazendaId, setFazendaId] = useState('');
  const [dataSexagem, setDataSexagem] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data } = await supabase.from('fazendas').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { receptoras, isLoading, save, isSaving } = useEscritorioSexagem({ fazendaId });
  const { corrections, saveCorrections } = useOcrCorrections(fazendaId || undefined, 'sexagem');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<SexagemEntryRow[]>([]);

  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  const handleLoadReceptoras = () => {
    if (!fazendaId) { toast.error('Selecione uma fazenda'); return; }
    loadReceptoras();
  };

  const ocrHook = useCloudRunOcr({
    reportType: 'sexagem',
    fazendaId,
  });

  const ocrFieldsReady = !!(capturedFile && fazendaId && dataSexagem && veterinario);

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

  const sexagemColumns: ColumnDef<SexagemEntryRow>[] = [
    { key: 'registro', label: 'Registro', readOnly: true, width: '150px' },
    { key: 'nome', label: 'Nome', readOnly: true, width: '150px' },
    { key: 'raca', label: 'Raça', readOnly: true, width: '100px' },
    {
      key: 'resultado',
      label: 'Sexo (F/M/S/D/V)',
      width: '160px',
      shortcuts: {
        F: 'PRENHE_FEMEA',
        M: 'PRENHE_MACHO',
        S: 'PRENHE_SEM_SEXO',
        D: 'PRENHE_2_SEXOS',
        V: 'VAZIA',
      },
      autoAdvance: true,
    },
    { key: 'observacoes', label: 'Obs', width: '150px' },
  ];

  const handleRowChange = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    if (!dataSexagem) { toast.error('Preencha a data da sexagem'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    const filled = rows.filter(r => r.resultado !== '');
    if (filled.length === 0) { toast.error('Nenhum resultado preenchido'); return; }

    try {
      const importRecord = await createImport({
        report_type: 'sexagem',
        status: 'processing',
        fazenda_id: fazendaId,
        final_data: { data_sexagem: dataSexagem, veterinario, tecnico, resultados: filled },
      });

      await save({ dataSexagem, veterinario, tecnico, resultados: filled });
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      if (capturedFile) {
        uploadReportImageBackground(capturedFile, fazendaId, importRecord.id);
      }

      toast.success(`${filled.length} sexagens registradas com sucesso`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleOcrSave = async (reviewedRows: OcrRow[]) => {
    const sexRows: SexagemEntryRow[] = reviewedRows.map(r => {
      const matched = receptoras.find(
        rec => rec.registro.toUpperCase() === (r.registro.matched_value || r.registro.value).toUpperCase()
      );
      return {
        protocolo_receptora_id: matched?.protocolo_receptora_id || '',
        receptora_id: matched?.receptora_id || '',
        registro: r.registro.matched_value || r.registro.value,
        nome: matched?.nome,
        raca: r.raca.value,
        resultado: r.resultado.value as SexagemEntryRow['resultado'],
        observacoes: r.obs.value,
      };
    }).filter(r => r.protocolo_receptora_id && r.resultado);

    setRows(sexRows);
    if (ocrResult) {
      const corrs = detectCorrections(ocrResult.rows, reviewedRows, 'sexagem', fazendaId, veterinario);
      if (corrs.length > 0) await saveCorrections(corrs);
    }
    setOcrResult(null);
    setMode('manual');
    toast.info(`${sexRows.length} linhas importadas do OCR. Revise e salve.`);
  };

  if (saved) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Sexagem" icon={GenderIcon} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">Sexagens registradas com sucesso!</p>
            <Button onClick={() => { setSaved(false); setRows([]); }}>Registrar Nova Sexagem</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Sexagem"
        description="Registrar resultados de sexagem fetal via foto ou entrada manual"
        icon={GenderIcon}
        actions={<EntryModeSwitch mode={mode} onChange={setMode} />}
      />

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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fazenda *</Label>
                    <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Selecione...</option>
                      {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Data da Sexagem *</Label>
                    <Input type="date" value={dataSexagem} onChange={e => setDataSexagem(e.target.value)} className="h-9" />
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
                  columns={['registro', 'raca', 'resultado', 'obs']}
                  resultadoLabel="Sexo (F/M/S/D/V)"
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fazenda</Label>
                  <select value={fazendaId} onChange={e => setFazendaId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Selecione...</option>
                    {fazendas?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data da Sexagem</Label>
                  <Input type="date" value={dataSexagem} onChange={e => setDataSexagem(e.target.value)} className="h-9" />
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
                  {isLoading ? 'Carregando...' : 'Carregar Receptoras Prenhe'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {rows.length} receptoras — {rows.filter(r => r.resultado !== '').length} preenchidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ManualEntryGrid
                  rows={rows}
                  columns={sexagemColumns}
                  onRowChange={handleRowChange}
                  getRowClassName={(row) =>
                    row.resultado === 'PRENHE_FEMEA' ? 'bg-pink-500/5' :
                    row.resultado === 'PRENHE_MACHO' ? 'bg-blue-500/5' :
                    row.resultado === 'VAZIA' ? 'bg-red-500/5' : ''
                  }
                />
                <div className="flex justify-end gap-2 mt-4">
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-1" />
                    {isSaving ? 'Salvando...' : 'Salvar Sexagens'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Atalhos: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">F</kbd> Fêmea{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">M</kbd> Macho{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">S</kbd> Sem sexo{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">D</kbd> 2 Sexos{' '}
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">V</kbd> Vazia
            </p>
          )}
        </>
      )}
    </div>
  );
}
