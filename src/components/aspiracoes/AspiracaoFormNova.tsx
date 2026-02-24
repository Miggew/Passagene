import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { supabase } from '@/lib/supabase';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Fazenda } from '@/lib/types';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface AspiracaoFormNovaProps {
    formData: {
        fazenda_id: string;
        data_aspiracao: string;
        horario_inicio: string;
        veterinario_responsavel: string;
        tecnico_responsavel: string;
    };
    setFormData: React.Dispatch<React.SetStateAction<{
        fazenda_id: string;
        data_aspiracao: string;
        horario_inicio: string;
        veterinario_responsavel: string;
        tecnico_responsavel: string;
    }>>;
    fazendas: Fazenda[];
    loadingFazendas: boolean;
    onContinuar: () => void;
    temDadosNaoSalvos?: boolean;
    onRestaurarRascunho?: () => void;
}

export function AspiracaoFormNova({
    formData,
    setFormData,
    fazendas,
    loadingFazendas,
    onContinuar,
    temDadosNaoSalvos,
    onRestaurarRascunho
}: AspiracaoFormNovaProps) {
    const [openFazenda, setOpenFazenda] = useState(false);

    const handleFazendaSelect = (currentValue: string) => {
        setFormData(prev => ({ ...prev, fazenda_id: currentValue === formData.fazenda_id ? '' : currentValue }));
        setOpenFazenda(false);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Dados da Aspiração</CardTitle>
                        <CardDescription>Informe os dados iniciais para começar a sessão</CardDescription>
                    </div>
                    {temDadosNaoSalvos && onRestaurarRascunho && (
                        <Button variant="outline" size="sm" onClick={onRestaurarRascunho} className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                            Restaurar Rascunho
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Fazenda (Origem)</Label>
                        <Popover open={openFazenda} onOpenChange={setOpenFazenda}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openFazenda}
                                    className="w-full justify-between"
                                    disabled={loadingFazendas}
                                >
                                    {formData.fazenda_id
                                        ? fazendas.find((f) => f.id === formData.fazenda_id)?.nome
                                        : "Selecione a fazenda..."}
                                    {loadingFazendas ? (
                                        <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />
                                    ) : (
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar fazenda..." />
                                    <CommandList>
                                        <CommandEmpty>Nenhuma fazenda encontrada.</CommandEmpty>
                                        <CommandGroup>
                                            {fazendas.map((fazenda) => (
                                                <CommandItem
                                                    key={fazenda.id}
                                                    value={fazenda.id}
                                                    onSelect={() => handleFazendaSelect(fazenda.id)}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.fazenda_id === fazenda.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {fazenda.nome}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label>Data da Aspiração</Label>
                        <DatePickerBR
                            value={formData.data_aspiracao}
                            onChange={(date) => setFormData(prev => ({ ...prev, data_aspiracao: date }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Horário Início (Opcional)</Label>
                        <Input
                            type="time"
                            value={formData.horario_inicio}
                            onChange={(e) => setFormData(prev => ({ ...prev, horario_inicio: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Veterinário Responsável</Label>
                        <Input
                            placeholder="Nome do veterinário"
                            value={formData.veterinario_responsavel}
                            onChange={(e) => setFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Técnico Responsável</Label>
                        <Input
                            placeholder="Nome do técnico"
                            value={formData.tecnico_responsavel}
                            onChange={(e) => setFormData(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={onContinuar} size="lg">
                        Continuar para Doadoras
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
