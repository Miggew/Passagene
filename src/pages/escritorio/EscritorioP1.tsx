import { useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Syringe, Save, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import AnimalAutocomplete from '@/components/escritorio/AnimalAutocomplete';
import { useEscritorioP1 } from '@/hooks/escritorio/useEscritorioP1';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { P1EntryRow } from '@/lib/types/escritorio';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ImportHistoryList from '@/components/escritorio/ImportHistoryList';
import RelatoriosServicos from '@/pages/relatorios/RelatoriosServicos';

const EMPTY_ROW: P1EntryRow = { registro: '', raca: '' };

export interface EscritorioP1Props {
  hideHeader?: boolean;
}

export default function EscritorioP1({ hideHeader }: EscritorioP1Props = {}) {
  const [fazendaId, setFazendaId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<P1EntryRow[]>(Array.from({ length: 5 }, () => ({ ...EMPTY_ROW })));

  const { data: fazendas } = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data } = await supabase.from('fazendas').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { receptoras, save, isSaving } = useEscritorioP1({ fazendaId: fazendaId || undefined });
  const { createImport, updateImport } = useReportImports(fazendaId || undefined);

  const addRows = (count: number = 5) => {
    setRows(prev => [...prev, ...Array.from({ length: count }, () => ({ ...EMPTY_ROW }))]);
  };

  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const handleAnimalSelect = (idx: number, value: string, animal?: any) => {
    if (animal) {
      setRows(prev => prev.map((r, i) => i === idx ? {
        ...r,
        receptora_id: animal.id,
        registro: animal.registro,
        nome: animal.nome,
        raca: animal.raca || r.raca,
        isNew: false,
      } : r));
    } else {
      setRows(prev => prev.map((r, i) => i === idx ? {
        ...r,
        registro: value,
        receptora_id: undefined,
        isNew: value.length > 0,
      } : r));
    }
  };

  const handleRacaChange = (idx: number, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, raca: value } : r));
  };

  const handleSave = async () => {
    if (!fazendaId) { toast.error('Selecione uma fazenda'); return; }
    if (!dataInicio) { toast.error('Preencha a data de início'); return; }
    if (!responsavel) { toast.error('Preencha o responsável'); return; }

    const filled = rows.filter(r => r.registro.trim());
    if (filled.length === 0) { toast.error('Nenhuma receptora adicionada'); return; }

    // Validar novas receptoras (precisam de raça)
    const newWithoutRaca = filled.filter(r => r.isNew && !r.raca);
    if (newWithoutRaca.length > 0) {
      toast.error(`${newWithoutRaca.length} receptora(s) nova(s) sem raça definida`);
      return;
    }

    try {
      const importRecord = await createImport({
        report_type: 'p1',
        status: 'processing',
        fazenda_id: fazendaId,
        final_data: { dataInicio, responsavel, observacoes, rows: filled },
      });

      await save({ dataInicio, responsavel, rows: filled, observacoes });
      await updateImport({ id: importRecord.id, status: 'completed', completed_at: new Date().toISOString() });

      const newCount = filled.filter(r => r.isNew).length;
      toast.success(`Protocolo criado: ${filled.length} receptoras${newCount > 0 ? ` (${newCount} novas)` : ''}`);
      setSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  if (saved) {
    return (
      <div className={hideHeader ? "" : "space-y-6 animate-in fade-in duration-500"}>
        {!hideHeader && <PageHeader title="Protocolo — 1º Passo" icon={Syringe} />}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="text-lg font-medium">Protocolo criado com sucesso!</p>
            <Button onClick={() => { setSaved(false); setRows(Array.from({ length: 5 }, () => ({ ...EMPTY_ROW }))); }}>
              Criar Novo Protocolo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={hideHeader ? "" : "space-y-6 animate-in fade-in duration-500"}>
      {!hideHeader && (
        <PageHeader
          title="Protocolo — 1º Passo"
          description="Cadastrar novo protocolo com receptoras e consultar histórico"
          icon={Syringe}
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
            <ImportHistoryList reportType="p1" />
          </div>
        </TabsContent>

        <TabsContent value="novo" className="mt-0 space-y-6">
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
                  <Label className="text-xs text-muted-foreground">Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Responsável</Label>
                  <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Nome" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Observações</Label>
                  <Input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Receptoras — {rows.filter(r => r.registro.trim()).length} preenchidas
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => addRows(5)}>
                  <Plus className="w-4 h-4 mr-1" /> +5 linhas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-[40px_200px_120px_100px_40px] gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
                  <span>#</span><span>Registro</span><span>Raça</span><span>Status</span><span></span>
                </div>
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className={cn(
                      'grid grid-cols-[40px_200px_120px_100px_40px] gap-2 items-center',
                      row.isNew && 'bg-amber-500/5 rounded',
                    )}
                  >
                    <span className="text-sm text-muted-foreground pl-1">{i + 1}</span>
                    <AnimalAutocomplete
                      animals={receptoras}
                      value={row.registro}
                      onChange={(v, a) => handleAnimalSelect(i, v, a)}
                      placeholder="Registro..."
                    />
                    <Input
                      value={row.raca}
                      onChange={e => handleRacaChange(i, e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Raça"
                      readOnly={!!row.receptora_id && !row.isNew}
                    />
                    <span className="text-xs">
                      {row.receptora_id && !row.isNew && (
                        <span className="text-green-600">Encontrada</span>
                      )}
                      {row.isNew && (
                        <span className="text-amber-600">Nova</span>
                      )}
                    </span>
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="p-1 text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? 'Salvando...' : 'Criar Protocolo'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
