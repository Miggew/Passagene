import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Syringe, Save, CheckCircle2, X } from 'lucide-react';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import { useEscritorioP2 } from '@/hooks/escritorio/useEscritorioP2';
import { useReportOcr } from '@/hooks/escritorio/useReportOcr';
import { useOcrCorrections } from '@/hooks/escritorio/useOcrCorrections';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { EntryMode, P2EntryRow, OcrResult } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function EscritorioP2() {
  const [mode, setMode] = useState<EntryMode>('manual');
  const [protocoloId, setProtocoloId] = useState('');
  const [fazendaId, setFazendaId] = useState('');
  const [dataConfirmacao, setDataConfirmacao] = useState('');
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

  // Protocolos em andamento
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
  const { corrections } = useOcrCorrections(fazendaId || undefined, 'p2');
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const [rows, setRows] = useState<P2EntryRow[]>([]);

  const loadReceptoras = useCallback(() => {
    setRows(receptoras.map(r => ({ ...r })));
  }, [receptoras]);

  const handleLoadReceptoras = () => {
    if (!protocoloId) { toast.error('Selecione um protocolo'); return; }
    loadReceptoras();
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
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageHeader title="Protocolo — 2º Passo" icon={Syringe} />
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Protocolo — 2º Passo (Confirmação)"
        description="Confirmar presença ou marcar perdas. Trabalhe por exceção: só marque perdas."
        icon={Syringe}
        actions={<EntryModeSwitch mode={mode} onChange={setMode} />}
      />

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
          {mode === 'manual' && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={handleLoadReceptoras} disabled={!protocoloId || isLoading}>
                {isLoading ? 'Carregando...' : 'Carregar Receptoras'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {mode === 'manual' && rows.length > 0 && (
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
    </div>
  );
}
