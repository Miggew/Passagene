import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThumbsUp, Save, CheckCircle2 } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import ManualEntryGrid from '@/components/escritorio/ManualEntryGrid';
import type { ColumnDef } from '@/components/escritorio/ManualEntryGrid';
import { useEscritorioDG } from '@/hooks/escritorio/useEscritorioDG';
import { useReportOcr } from '@/hooks/escritorio/useReportOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import { detectCorrections } from '@/utils/escritorio/postProcess';
import type { EntryMode, DGEntryRow, OcrRow, OcrResult } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function EscritorioDG() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [fazendaId, setFazendaId] = useState('');
  const [dataTE, setDataTE] = useState('');
  const [dataDG, setDataDG] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Fazendas para o select
  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data } = await supabase.from('fazendas').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { receptoras, isLoading, save, isSaving } = useEscritorioDG({ fazendaId, dataTE });
  const { corrections, saveCorrections } = useOcrCorrections(fazendaId || undefined, 'dg');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<DGEntryRow[]>([]);

  // Sincronizar receptoras carregadas com o grid
  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  // Quando receptoras carregam, atualizar grid
  const handleLoadReceptoras = () => {
    if (!fazendaId) { toast.error('Selecione uma fazenda'); return; }
    loadReceptoras();
  };

  // OCR hooks
  const ocrHook = useReportOcr({
    reportType: 'dg',
    fazendaId,
    animals: receptoras.map(r => ({ id: r.receptora_id, registro: r.registro, nome: r.nome })),
    corrections,
  });

  // Atalhos DG
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

  // Marcar restantes como Prenhe
  const markRestAsPrenhe = () => {
    setRows(prev => prev.map(r => r.resultado === '' ? { ...r, resultado: 'PRENHE' } : r));
  };

  // Salvar
  const handleSave = async () => {
    if (!dataDG) { toast.error('Preencha a data do DG'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    const filled = rows.filter(r => r.resultado !== '');
    if (filled.length === 0) { toast.error('Nenhum resultado preenchido'); return; }

    try {
      // Criar registro de importação
      const importRecord = await createImport({
        report_type: 'dg',
        status: 'processing',
        fazenda_id: fazendaId,
        final_data: {
          data_diagnostico: dataDG,
          veterinario,
          tecnico,
          resultados: filled,
        },
      });

      // Salvar via RPC
      await save({ dataDiagnostico: dataDG, veterinario, tecnico, resultados: filled });

      // Marcar importação como completa
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      toast.success(`${filled.length} diagnósticos registrados com sucesso`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  // OCR: processar resultado
  const handleOcrResult = (result: unknown) => {
    const ocr = result as OcrResult;
    setOcrResult(ocr);
  };

  // OCR: salvar após revisão
  const handleOcrSave = async (reviewedRows: OcrRow[]) => {
    // Converter OCR rows para DG entry rows
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

    // Salvar correções OCR
    if (ocrResult) {
      const corrs = detectCorrections(ocrResult.rows, reviewedRows, 'dg', fazendaId, veterinario);
      if (corrs.length > 0) await saveCorrections(corrs);
    }

    setOcrResult(null);
    setMode('manual'); // Voltar para manual com dados preenchidos
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
            <Button onClick={() => { setSaved(false); setRows([]); }}>
              Registrar Novo DG
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="DG — Diagnóstico de Gestação"
        description="Registrar resultados de DG via foto ou entrada manual"
        icon={ThumbsUp}
        actions={<EntryModeSwitch mode={mode} onChange={setMode} />}
      />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fazenda</Label>
              <select
                value={fazendaId}
                onChange={(e) => setFazendaId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {fazendas?.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
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
          {mode === 'manual' && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadReceptoras}
                disabled={!fazendaId || isLoading}
              >
                {isLoading ? 'Carregando...' : 'Carregar Receptoras'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modo OCR */}
      {mode === 'ocr' && !ocrResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <ReportScanner
              onResult={handleOcrResult}
              uploadAndProcess={ocrHook.processFile}
              disabled={!fazendaId}
            />
          </CardContent>
        </Card>
      )}

      {/* OCR Review */}
      {mode === 'ocr' && ocrResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisão dos Dados Extraídos</CardTitle>
          </CardHeader>
          <CardContent>
            <OcrReviewGrid
              rows={ocrResult.rows}
              onSave={handleOcrSave}
              onCancel={() => { setOcrResult(null); ocrHook.reset(); }}
              columns={['registro', 'raca', 'resultado', 'obs']}
              resultadoLabel="DG (P/V/R)"
            />
          </CardContent>
        </Card>
      )}

      {/* Modo Manual */}
      {mode === 'manual' && rows.length > 0 && (
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

      {/* Dicas de atalho */}
      {mode === 'manual' && rows.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Atalhos: <kbd className="px-1 py-0.5 bg-muted rounded text-xs">P</kbd> Prenhe{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">V</kbd> Vazia{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">R</kbd> Retoque{' '}
          — Auto-avança para próxima linha
        </p>
      )}
    </div>
  );
}
