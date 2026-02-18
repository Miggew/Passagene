import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    User,
    MapPin,
    Save,
    AlertTriangle,
} from 'lucide-react';
import { DIAS_MINIMOS } from '@/lib/gestacao';
import { useDiagnosticoGestacao } from '@/hooks/useDiagnosticoGestacao';

export function DiagnosticoSessao() {
    const {
        fazendaSelecionada,
        setFazendaSelecionada,
        loteSelecionado,
        setLoteSelecionado,
        receptoras,
        loading,
        submitting,
        formData,
        loteFormData,
        setLoteFormData,
        fazendas,
        lotesTE,
        loadingLotes,
        handleSalvarLote,
        handleResultadoChange,
        handleFieldChange,
        showRestaurarDialog,
        setShowRestaurarDialog,
        restaurarRascunho,
        descartarRascunho,
        hoje
    } = useDiagnosticoGestacao();

    const todasReceptorasComResultado = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.resultado && dados.data_diagnostico;
    });

    const formatarData = (data: string) => {
        if (!data) return '-';
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="mt-4">
            {/* Barra de controles premium */}
            <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
                <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
                    {/* Grupo: Responsáveis */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                            <User className="w-3.5 h-3.5" />
                            <span>Responsáveis</span>
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Veterinário *
                            </label>
                            <Input
                                placeholder="Nome do veterinário"
                                value={loteFormData.veterinario_responsavel}
                                onChange={(e) => setLoteFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                                className="h-11 md:h-9"
                            />
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Técnico
                            </label>
                            <Input
                                placeholder="Nome do técnico"
                                value={loteFormData.tecnico_responsavel}
                                onChange={(e) => setLoteFormData(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}
                                className="h-11 md:h-9"
                            />
                        </div>
                    </div>

                    {/* Separador */}
                    <div className="h-10 w-px bg-border hidden md:block" />

                    {/* Grupo: Local */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Local</span>
                        </div>
                        <div className="w-full md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Fazenda *
                            </label>
                            <Select
                                value={fazendaSelecionada}
                                onValueChange={setFazendaSelecionada}
                                disabled={!loteFormData.veterinario_responsavel}
                            >
                                <SelectTrigger className="h-11 md:h-9">
                                    <SelectValue placeholder="Selecione a fazenda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fazendas.map((fazenda) => (
                                        <SelectItem key={fazenda.id} value={fazenda.id}>
                                            {fazenda.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-auto md:flex-1 md:min-w-[200px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Lote TE *
                            </label>
                            <Select
                                value={loteSelecionado?.id || ''}
                                onValueChange={(value) => {
                                    const lote = lotesTE.find(l => l.id === value);
                                    setLoteSelecionado(lote || null);
                                }}
                                disabled={!fazendaSelecionada || loadingLotes}
                            >
                                <SelectTrigger className="h-11 md:h-9">
                                    <SelectValue placeholder={loadingLotes ? 'Carregando...' : 'Selecione o lote'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {lotesTE.map((lote) => {
                                        const diasInsuficientes = lote.dias_gestacao !== undefined && lote.dias_gestacao < DIAS_MINIMOS.DG;
                                        return (
                                            <SelectItem key={lote.id} value={lote.id}>
                                                <span className={diasInsuficientes ? 'text-amber-600' : ''}>
                                                    {formatarData(lote.data_te)} • {lote.dias_gestacao ?? '?'}d • {lote.quantidade_receptoras} rec.
                                                    {diasInsuficientes && ' ⚠️'}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Separador */}
                    <div className="h-10 w-px bg-border hidden md:block" />

                    {/* Grupo: Ação */}
                    <div className="flex items-end gap-3 w-full md:w-auto md:ml-auto">
                        <Button
                            onClick={handleSalvarLote}
                            disabled={
                                !loteSelecionado ||
                                !todasReceptorasComResultado ||
                                submitting ||
                                loteSelecionado?.status === 'FECHADO' ||
                                (loteSelecionado?.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG)
                            }
                            className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm w-full md:w-auto"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {submitting ? 'Salvando...' : 'Salvar Lote'}
                        </Button>
                    </div>
                </div>

                {/* Aviso de dias insuficientes */}
                {loteSelecionado && loteSelecionado.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Este lote está com {loteSelecionado.dias_gestacao} dias. DG requer mínimo de {DIAS_MINIMOS.DG} dias (faltam {DIAS_MINIMOS.DG - loteSelecionado.dias_gestacao}).
                        </p>
                    </div>
                )}
            </div>

            {/* Tabela de Receptoras */}
            {loading ? (
                <Card>
                    <CardContent className="py-8">
                        <LoadingSpinner />
                    </CardContent>
                </Card>
            ) : loteSelecionado && receptoras.length > 0 ? (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div>
                                    <CardTitle className="text-base">
                                        Receptoras do Lote
                                    </CardTitle>
                                    <CardDescription>
                                        {receptoras.length} receptora(s) • TE em {formatarData(loteSelecionado.data_te)}
                                    </CardDescription>
                                </div>
                                {loteSelecionado.status === 'FECHADO' && (
                                    <Badge variant="secondary">Lote Fechado</Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3">
                            {receptoras.map((receptora) => {
                                const dados = formData[receptora.receptora_id] || {
                                    resultado: '',
                                    numero_gestacoes: '',
                                    observacoes: '',
                                    data_diagnostico: hoje,
                                };
                                const isDisabled = loteSelecionado.status === 'FECHADO';

                                return (
                                    <div key={receptora.receptora_id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-base">{receptora.brinco}</span>
                                                {receptora.nome && (
                                                    <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="font-mono">
                                                {receptora.dias_gestacao}d
                                            </Badge>
                                        </div>

                                        <div className="text-sm text-muted-foreground mb-3">
                                            {receptora.embrioes.map((embriao) => (
                                                <div key={embriao.te_id}>
                                                    {embriao.doadora_registro || '-'}
                                                    {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                                    {embriao.embriao_classificacao && (
                                                        <span className="text-xs ml-1">({embriao.embriao_classificacao})</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Data DG</label>
                                                <DatePickerBR
                                                    value={dados.data_diagnostico}
                                                    onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Resultado</label>
                                                <Select
                                                    value={dados.resultado}
                                                    onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
                                                    disabled={isDisabled}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="--" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PRENHE">PRENHE</SelectItem>
                                                        <SelectItem value="VAZIA">VAZIA</SelectItem>
                                                        <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {(dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') && (
                                                <div>
                                                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Nº Gest.</label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="3"
                                                        value={dados.numero_gestacoes}
                                                        onChange={(e) => handleFieldChange(receptora.receptora_id, 'numero_gestacoes', e.target.value)}
                                                        className="h-11"
                                                        disabled={isDisabled}
                                                    />
                                                </div>
                                            )}
                                            <div className={(dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') ? '' : 'col-span-2'}>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Obs.</label>
                                                <Input
                                                    value={dados.observacoes}
                                                    onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                                    placeholder="Obs."
                                                    className="h-11"
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Receptora</TableHead>
                                        <TableHead>Dias Gest.</TableHead>
                                        <TableHead>Embrião</TableHead>
                                        <TableHead>Doadora × Touro</TableHead>
                                        <TableHead>Data DG</TableHead>
                                        <TableHead>Resultado</TableHead>
                                        <TableHead>Nº Gest.</TableHead>
                                        <TableHead>Obs.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receptoras.map((receptora) => {
                                        const dados = formData[receptora.receptora_id] || {
                                            resultado: '',
                                            numero_gestacoes: '',
                                            observacoes: '',
                                            data_diagnostico: hoje,
                                        };
                                        const isDisabled = loteSelecionado.status === 'FECHADO';

                                        return (
                                            <TableRow key={receptora.receptora_id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {receptora.brinco}
                                                        {receptora.nome && (
                                                            <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono">
                                                        {receptora.dias_gestacao}d
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        {receptora.embrioes.map((embriao, idx) => (
                                                            <div key={embriao.te_id} className="text-sm">
                                                                {embriao.embriao_identificacao || `#${idx + 1}`}
                                                                {embriao.embriao_classificacao && (
                                                                    <span className="text-muted-foreground text-xs ml-1">
                                                                        ({embriao.embriao_classificacao})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5 text-sm">
                                                        {receptora.embrioes.map((embriao) => (
                                                            <div key={embriao.te_id}>
                                                                {embriao.doadora_registro || '-'}
                                                                {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <DatePickerBR
                                                        value={dados.data_diagnostico}
                                                        onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                                                        className="w-32"
                                                        disabled={isDisabled}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={dados.resultado}
                                                        onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
                                                        disabled={isDisabled}
                                                    >
                                                        <SelectTrigger className="w-28 h-9">
                                                            <SelectValue placeholder="--" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PRENHE">PRENHE</SelectItem>
                                                            <SelectItem value="VAZIA">VAZIA</SelectItem>
                                                            <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    {dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE' ? (
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="3"
                                                            value={dados.numero_gestacoes}
                                                            onChange={(e) => handleFieldChange(receptora.receptora_id, 'numero_gestacoes', e.target.value)}
                                                            className="w-16 h-9"
                                                            disabled={isDisabled}
                                                        />
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={dados.observacoes}
                                                        onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                                        placeholder="Obs."
                                                        className="w-32 h-9"
                                                        disabled={isDisabled}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            ) : loteSelecionado && receptoras.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhuma receptora encontrada neste lote
                    </CardContent>
                </Card>
            ) : null}

            {/* Dialog Restaurar Sessão em Andamento */}
            <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            Diagnóstico de gestação não finalizado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem um diagnóstico de gestação em andamento que não foi finalizado. Deseja continuar de onde parou?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={descartarRascunho}>Descartar</AlertDialogCancel>
                        <AlertDialogAction onClick={restaurarRascunho}>Restaurar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
