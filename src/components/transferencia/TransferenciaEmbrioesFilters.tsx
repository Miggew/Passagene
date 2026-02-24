import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DatePickerBR from "@/components/shared/DatePickerBR";
import {
    ArrowRightLeft,
    Snowflake,
    X,
    User,
    Search,
} from "lucide-react";
import { TransferenciaFormData, CamposPacote } from "@/lib/types/transferenciaEmbrioes";
import { OrigemEmbriao } from '@/hooks/useTransferenciaEmbrioesFilters';

interface TransferenciaEmbrioesFiltersProps {
    formData: TransferenciaFormData;
    setFormData: (data: TransferenciaFormData) => void;
    camposPacote: CamposPacote;
    setCamposPacote: (data: CamposPacote) => void;
    origemEmbriao: OrigemEmbriao;
    setOrigemEmbriao: (val: OrigemEmbriao) => void;
    filtroClienteId: string;
    setFiltroClienteId: (val: string) => void;
    filtroRaca: string;
    setFiltroRaca: (val: string) => void;
    dataPasso2: string;
    setDataPasso2: (val: string) => void;
    clientes: { id: string; nome: string }[];
    resetFiltros: () => void;
}

export function TransferenciaEmbrioesFilters({
    formData,
    setFormData,
    camposPacote,
    setCamposPacote,
    origemEmbriao,
    setOrigemEmbriao,
    filtroClienteId,
    setFiltroClienteId,
    filtroRaca,
    setFiltroRaca,
    dataPasso2,
    setDataPasso2,
    clientes,
    resetFiltros
}: TransferenciaEmbrioesFiltersProps) {
    return (
        <div className="mt-4">
            {/* Barra de controles premium */}
            <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
                <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
                    {/* Grupo: Responsáveis */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-primary/40 self-center hidden md:block" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center w-full md:w-auto">
                            <User className="w-3.5 h-3.5" />
                            <span>Responsáveis</span>
                        </div>
                        <div className="w-[calc(50%-0.375rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Veterinário *
                            </label>
                            <Input
                                placeholder="Nome do veterinário"
                                value={formData.veterinario_responsavel}
                                onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                                className="h-11 md:h-9"
                            />
                        </div>
                        <div className="w-[calc(50%-0.375rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Técnico
                            </label>
                            <Input
                                placeholder="Nome do técnico (opcional)"
                                value={formData.tecnico_responsavel}
                                onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                                className="h-11 md:h-9"
                            />
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-border/50 self-center mx-2" />

                    {/* Grupo: Filtros Globais */}
                    <div className="flex flex-wrap items-end gap-3 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center w-full md:w-auto">
                            <Search className="w-3.5 h-3.5" />
                            <span>Filtros</span>
                        </div>

                        {/* Origem do Embrião */}
                        <div className="w-[calc(50%-0.375rem)] md:w-auto">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Origem
                            </label>
                            <Tabs
                                value={origemEmbriao}
                                onValueChange={(v) => {
                                    setOrigemEmbriao(v as OrigemEmbriao);
                                    // Reset dependente se mudar origem
                                    if (v === 'FRESCO') {

                                    } else {
                                        setFormData({ ...formData, pacote_id: '' });
                                    }
                                }}
                                className="w-full md:w-auto"
                            >
                                <TabsList className="h-9 w-full md:w-auto grid grid-cols-2 bg-muted/50">
                                    <TabsTrigger value="FRESCO" className="text-xs">
                                        <ArrowRightLeft className="w-3 h-3 mr-1.5" />
                                        Fresco
                                    </TabsTrigger>
                                    <TabsTrigger value="CONGELADO" className="text-xs">
                                        <Snowflake className="w-3 h-3 mr-1.5" />
                                        Congelado
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        {/* Cliente (Filtro) - Só aparece p/ Congelados ou pra filtrar Pacotes/Receptoras */}
                        <div className="w-[calc(50%-0.375rem)] md:w-auto md:min-w-[180px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Cliente
                            </label>
                            <Select value={filtroClienteId} onValueChange={setFiltroClienteId}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Todos os clientes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos os clientes</SelectItem>
                                    {clientes.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Raça (Filtro) */}
                        <div className="w-[calc(50%-0.375rem)] md:w-auto md:min-w-[120px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Raça
                            </label>
                            <Select value={filtroRaca} onValueChange={setFiltroRaca}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todas</SelectItem>
                                    <SelectItem value="NELORE">Nelore</SelectItem>
                                    <SelectItem value="ANGUS">Angus</SelectItem>
                                    <SelectItem value="GIR">Gir</SelectItem>
                                    <SelectItem value="GIROLANDO">Girolando</SelectItem>
                                    <SelectItem value="SENEPOL">Senepol</SelectItem>
                                    <SelectItem value="BRAHMAN">Brahman</SelectItem>
                                    <SelectItem value="TABAPUA">Tabapuã</SelectItem>
                                    <SelectItem value="SINDI">Sindi</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Data Ref. Passo 2 (Só para frescos) */}
                        {origemEmbriao === 'FRESCO' && (
                            <div className="w-[calc(50%-0.375rem)] md:w-auto">
                                <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                    Ref. Sincronização
                                </label>
                                <div className="w-full md:w-[140px]">
                                    <DatePickerBR
                                        value={dataPasso2 || ''}
                                        onChange={(v) => setDataPasso2(v)}
                                        className="h-9 text-xs"
                                        placeholder="Data ref."
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full md:w-auto pt-2 md:pt-0">
                        {(filtroClienteId || filtroRaca !== '' || dataPasso2) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetFiltros}
                                className="h-9 w-full md:w-auto text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3.5 h-3.5 mr-1.5" />
                                Limpar Filtros
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tags de filtros ativos */}
                <div className="flex flex-wrap gap-2 mt-3">
                    {origemEmbriao === 'FRESCO' && !dataPasso2 && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                            Mostrando cronogramas recentes
                        </Badge>
                    )}
                    {filtroClienteId && (
                        <Badge variant="secondary" className="text-[10px]">
                            Cliente: {clientes.find(c => c.id === filtroClienteId)?.nome || '...'}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}
