import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, Save, CheckCircle2 } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ManualEntryGrid from '@/components/escritorio/ManualEntryGrid';
import type { ColumnDef } from '@/components/escritorio/ManualEntryGrid';
import { useEscritorioTE } from '@/hooks/escritorio/useEscritorioTE';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { EntryMode, TEEntryRow } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function EscritorioTE() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [fazendaId, setFazendaId] = useState('');
  const [protocoloId, setProtocoloId] = useState('');
  const [loteFivId, setLoteFivId] = useState('');
  const [dataTE, setDataTE] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [tecnico, setTecnico] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data } = await supabase.from('fazendas').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { data: protocolos } = useQuery({
    queryKey: ['protocolos-ativos-te', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];
      const { data } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, data_inicio, status')
        .eq('fazenda_id', fazendaId)
        .order('data_inicio', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!fazendaId,
  });

  const { data: lotesFiv } = useQuery({
    queryKey: ['lotes-fiv-disponiveis'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lotes_fiv')
        .select('id, codigo, data_abertura')
        .eq('disponivel_para_transferencia', true)
        .order('data_abertura', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { receptoras, embrioes, isLoading, save, isSaving } = useEscritorioTE({
    protocoloId: protocoloId || undefined,
    fazendaId: fazendaId || undefined,
    loteFivId: loteFivId || undefined,
  });
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<TEEntryRow[]>([]);

  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  const handleLoadReceptoras = () => {
    if (!protocoloId) { toast.error('Selecione um protocolo'); return; }
    loadReceptoras();
  };

  const teColumns: ColumnDef<TEEntryRow>[] = [
    { key: 'registro', label: 'Receptora', readOnly: true, width: '150px' },
    { key: 'nome', label: 'Nome', readOnly: true, width: '130px' },
    {
      key: 'embriao_codigo',
      label: 'Embrião',
      width: '200px',
      render: (row, rowIdx, onChange) => (
        <select
          value={row.embriao_id}
          onChange={(e) => {
            const emb = embrioes.find((em: any) => em.id === e.target.value);
            handleRowChange(rowIdx, 'embriao_id', e.target.value);
            handleRowChange(rowIdx, 'embriao_codigo', emb?.codigo || '');
          }}
          className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">Selecionar...</option>
          {embrioes.map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.codigo} ({e.classificacao}) — {e.doadora_registro}
            </option>
          ))}
        </select>
      ),
    },
    { key: 'observacoes', label: 'Obs', width: '150px' },
  ];

  const handleRowChange = (rowIdx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    if (!dataTE) { toast.error('Preencha a data da TE'); return; }
    if (!veterinario) { toast.error('Preencha o veterinário'); return; }

    const filled = rows.filter(r => r.embriao_id);
    if (filled.length === 0) { toast.error('Nenhum embrião atribuído'); return; }

    // Validar duplicatas
    const embIds = filled.map(r => r.embriao_id);
    const duplicates = embIds.filter((id, i) => embIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      toast.error('Mesmo embrião atribuído a mais de uma receptora');
      return;
    }

    try {
      const importRecord = await createImport({
        report_type: 'te',
        status: 'processing',
        fazenda_id: fazendaId,
        protocolo_id: protocoloId,
        final_data: { data_te: dataTE, veterinario, tecnico, transferencias: filled },
      });

      await save({ dataTE, veterinario, tecnico, rows: filled });
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      toast.success(`${filled.length} transferências registradas com sucesso`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (saved) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Transferência de Embriões (TE)" icon={ArrowRightLeft} />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">Transferências registradas!</p>
            <Button onClick={() => { setSaved(false); setRows([]); }}>Registrar Nova TE</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Transferência de Embriões (TE)"
        description="Registrar transferências via foto ou entrada manual"
        icon={ArrowRightLeft}
        actions={<EntryModeSwitch mode={mode} onChange={setMode} />}
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                {protocolos?.map(p => <option key={p.id} value={p.id}>{p.data_inicio}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Lote FIV</Label>
              <select value={loteFivId} onChange={e => setLoteFivId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {lotesFiv?.map(l => <option key={l.id} value={l.id}>{l.codigo} ({l.data_abertura})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data da TE</Label>
              <Input type="date" value={dataTE} onChange={e => setDataTE(e.target.value)} className="h-9" />
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
            {embrioes.length > 0 && (
              <span className="ml-3 text-sm text-muted-foreground">{embrioes.length} embriões disponíveis</span>
            )}
          </div>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {rows.length} receptoras — {rows.filter(r => r.embriao_id).length} com embrião
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ManualEntryGrid rows={rows} columns={teColumns} onRowChange={handleRowChange} />
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? 'Salvando...' : 'Salvar Transferências'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
