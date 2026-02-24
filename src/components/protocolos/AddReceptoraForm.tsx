import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getStatusColor } from '@/components/shared/StatusBadge';
import ClassificacoesCicloInline from '@/components/shared/ClassificacoesCicloInline';

interface AddReceptoraFormProps {
    addReceptoraForm: {
        receptora_id: string;
        observacoes: string;
        ciclando_classificacao: 'N' | 'CL' | null;
        qualidade_semaforo: 1 | 2 | 3 | null;
    };
    setAddReceptoraForm: Dispatch<SetStateAction<{
        receptora_id: string;
        observacoes: string;
        ciclando_classificacao: 'N' | 'CL' | null;
        qualidade_semaforo: 1 | 2 | 3 | null;
    }>>;
    buscaReceptora: string;
    setBuscaReceptora: (busca: string) => void;
    popoverAberto: boolean;
    setPopoverAberto: (open: boolean) => void;
    receptorasFiltradas: Array<{
        id: string;
        identificacao: string;
        nome?: string | null;
        status: string;
        motivoIndisponivel?: string;
        disponivel: boolean;
    }>;
    receptorasComStatus: Array<{
        id: string;
        identificacao: string;
        nome?: string | null;
    }>;
    loadingReceptoras: boolean;
    onAdd: () => Promise<void>;
}

export function AddReceptoraForm({
    addReceptoraForm,
    setAddReceptoraForm,
    buscaReceptora,
    setBuscaReceptora,
    popoverAberto,
    setPopoverAberto,
    receptorasFiltradas,
    receptorasComStatus,
    loadingReceptoras,
    onAdd,
}: AddReceptoraFormProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Receptora *</Label>
                <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverAberto}
                            className="w-full justify-between"
                        >
                            {addReceptoraForm.receptora_id
                                ? (() => {
                                    const selecionada = receptorasComStatus.find(
                                        (r) => String(r.id).trim() === addReceptoraForm.receptora_id.trim()
                                    );
                                    return selecionada
                                        ? `${selecionada.identificacao}${selecionada.nome ? ` - ${selecionada.nome}` : ''}`
                                        : 'Selecione uma receptora';
                                })()
                                : 'Buscar receptora...'}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                            <CommandInput
                                placeholder="Buscar por identificação ou nome..."
                                value={buscaReceptora}
                                onValueChange={setBuscaReceptora}
                            />
                            <CommandList>
                                {loadingReceptoras ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        Carregando...
                                    </div>
                                ) : receptorasFiltradas.length === 0 ? (
                                    <CommandEmpty>
                                        {buscaReceptora.trim() ? 'Nenhuma encontrada' : 'Nenhuma disponível'}
                                    </CommandEmpty>
                                ) : (
                                    <CommandGroup>
                                        {receptorasFiltradas.map((r) => {
                                            const rId = r.id ? String(r.id).trim() : '';
                                            if (!rId) return null;
                                            const stats = (r as any).historicoStats as { totalProtocolos: number; gestacoes: number; protocolosDesdeUltimaGestacao: number } | undefined;

                                            return (
                                                <CommandItem
                                                    key={r.id}
                                                    value={`${r.identificacao} ${r.nome || ''} ${rId}`}
                                                    onSelect={() => {
                                                        if (r.disponivel) {
                                                            setAddReceptoraForm({ ...addReceptoraForm, receptora_id: rId });
                                                            setBuscaReceptora('');
                                                            setPopoverAberto(false);
                                                        }
                                                    }}
                                                    disabled={!r.disponivel}
                                                    className={`group ${!r.disponivel ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between w-full gap-2">
                                                        <div className="flex flex-col min-w-0 flex-shrink">
                                                            <span className={`font-medium truncate ${r.disponivel ? 'group-data-[selected=true]:text-accent-foreground' : 'text-muted-foreground'}`}>
                                                                {r.identificacao}
                                                            </span>
                                                            {r.nome && (
                                                                <span className="text-xs text-muted-foreground truncate group-data-[selected=true]:text-accent-foreground/70">{r.nome}</span>
                                                            )}
                                                        </div>

                                                        {r.disponivel && stats && (
                                                            <div className="flex items-center gap-1 shrink-0 ml-auto">
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-medium" title="Protocolos">{stats.totalProtocolos}P</span>
                                                                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium" title="Gestações">{stats.gestacoes}G</span>
                                                                <span className="text-[10px] bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium" title="Desde última gestação">{stats.protocolosDesdeUltimaGestacao}D</span>
                                                            </div>
                                                        )}

                                                        {!r.disponivel && (
                                                            <Badge
                                                                variant="outline"
                                                                className={`ml-auto text-[10px] px-1.5 py-0 shrink-0 ${getStatusColor(r.status)}`}
                                                            >
                                                                {formatStatusLabel(r.status)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <div className="space-y-2">
                <ClassificacoesCicloInline
                    ciclandoValue={addReceptoraForm.ciclando_classificacao}
                    qualidadeValue={addReceptoraForm.qualidade_semaforo}
                    onChangeCiclando={(value) =>
                        setAddReceptoraForm({ ...addReceptoraForm, ciclando_classificacao: value })
                    }
                    onChangeQualidade={(value) =>
                        setAddReceptoraForm({ ...addReceptoraForm, qualidade_semaforo: value })
                    }
                    size="sm"
                />
            </div>
            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                    value={addReceptoraForm.observacoes}
                    onChange={(e) =>
                        setAddReceptoraForm({ ...addReceptoraForm, observacoes: e.target.value })
                    }
                    placeholder="Observações"
                    rows={2}
                />
            </div>
            <Button
                onClick={onAdd}
                className="w-full"
                disabled={loadingReceptoras || !addReceptoraForm.receptora_id}
            >
                Adicionar
            </Button>
        </div>
    );
}
