import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, UserPlus, Lock } from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { ProtocoloInfoCard } from '@/components/protocolos/ProtocoloInfoCard';
import { ConfirmExitDialog } from '@/components/protocolos/ConfirmExitDialog';
import { AddReceptoraForm } from '@/components/protocolos/AddReceptoraForm';
import { CreateReceptoraForm } from '@/components/protocolos/CreateReceptoraForm';
import { ReceptorasTablePasso1 } from '@/components/protocolos/ReceptorasTablePasso1';
import { useProtocoloWizardData, useProtocoloWizardReceptoras, useProtocoloWizardSubmit } from '@/hooks/protocolos';
import { useProtocoloDraft } from '@/hooks/useProtocoloDraft';

interface ProtocoloPasso1Props {
    onSuccess: () => void;
}

export function ProtocoloPasso1({ onSuccess }: ProtocoloPasso1Props) {
    const [passo1CurrentStep, setPasso1CurrentStep] = useState<'form' | 'receptoras'>('form');

    // Draft Hook
    const {
        showRestaurarPasso1Dialog,
        setShowRestaurarPasso1Dialog,
        getRascunhoPasso1,
        salvarRascunhoPasso1,
        limparRascunhoPasso1,
        descartarRascunhoPasso1
    } = useProtocoloDraft();

    const {
        loading: loadingPasso1,
        loadingReceptoras: loadingReceptorasPasso1,
        fazendas: fazendasPasso1,
        allReceptoras,
        receptorasComStatus,
        protocoloData,
        setProtocoloData,
        loadFazendas: loadFazendasPasso1,
        loadAllReceptoras,
        getSelectedIds,
        getReceptorasFiltradas,
        getFazendaNome,
    } = useProtocoloWizardData();

    const {
        receptorasLocais,
        setReceptorasLocais,
        showAddReceptora,
        setShowAddReceptora,
        showCreateReceptora,
        setShowCreateReceptora,
        buscaReceptora,
        setBuscaReceptora,
        popoverAberto,
        setPopoverAberto,
        addReceptoraForm,
        setAddReceptoraForm,
        createReceptoraForm,
        setCreateReceptoraForm,
        submitting: receptorasSubmitting,
        handleAddReceptora,
        handleCreateReceptora,
        handleRemoveReceptora,
        handleUpdateCiclando,
        handleUpdateQualidade,
        resetAddForm,
        resetCreateForm,
    } = useProtocoloWizardReceptoras({
        fazendaId: protocoloData.fazenda_id,
        allReceptoras,
        receptorasComStatus,
        selectedIds: getSelectedIds([]),
        onReceptorasReload: () => loadAllReceptoras(protocoloData.fazenda_id),
    });

    const {
        submitting: submitSubmittingPasso1,
        showConfirmExit: showConfirmExitPasso1,
        setShowConfirmExit: setShowConfirmExitPasso1,
        handleFinalizarPasso1,
        handleConfirmExit: handleConfirmExitPasso1,
        validateProtocoloForm,
    } = useProtocoloWizardSubmit({
        protocoloData,
        receptorasLocais,
        onSuccess: () => {
            handleResetPasso1();
            onSuccess();
        },
    });

    const submittingPasso1 = receptorasSubmitting || submitSubmittingPasso1;

    // Effects
    useEffect(() => {
        loadFazendasPasso1();
    }, [loadFazendasPasso1]);

    useEffect(() => {
        if (passo1CurrentStep === 'receptoras' && protocoloData.fazenda_id) {
            loadAllReceptoras(protocoloData.fazenda_id);
        }
    }, [passo1CurrentStep, protocoloData.fazenda_id, loadAllReceptoras]);

    // Draft Effects
    useEffect(() => {
        const rascunho = getRascunhoPasso1();
        if (rascunho && (rascunho.receptorasLocais.length > 0 || rascunho.currentStep === 'receptoras')) {
            setShowRestaurarPasso1Dialog(true);
        }
    }, [getRascunhoPasso1, setShowRestaurarPasso1Dialog]);

    useEffect(() => {
        if (passo1CurrentStep === 'receptoras' || receptorasLocais.length > 0) {
            const timer = setTimeout(() => {
                salvarRascunhoPasso1({
                    protocoloData,
                    receptorasLocais,
                    currentStep: passo1CurrentStep
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [protocoloData, receptorasLocais, passo1CurrentStep, salvarRascunhoPasso1]);

    const restaurarRascunho = () => {
        const rascunho = getRascunhoPasso1();
        if (rascunho) {
            setProtocoloData(rascunho.protocoloData);
            setReceptorasLocais(rascunho.receptorasLocais);
            setPasso1CurrentStep(rascunho.currentStep);
        }
        setShowRestaurarPasso1Dialog(false);
    };

    const handleContinueToReceptoras = () => {
        if (validateProtocoloForm()) {
            setPasso1CurrentStep('receptoras');
        }
    };

    const handleVoltarPasso1 = () => {
        if (passo1CurrentStep === 'receptoras') {
            setPasso1CurrentStep('form');
        }
    };

    const handleResetPasso1 = () => {
        setPasso1CurrentStep('form');
        setProtocoloData({
            fazenda_id: '',
            data_inicio: new Date().toISOString().split('T')[0],
            veterinario: '',
            tecnico: '',
            observacoes: '',
        });
        setReceptorasLocais([]);
        limparRascunhoPasso1();
    };

    const receptorasFiltradas = getReceptorasFiltradas(buscaReceptora, getSelectedIds(receptorasLocais));

    return (
        <>
            {passo1CurrentStep === 'form' ? (
                <>
                    {/* Barra Premium de Controles */}
                    <div className="rounded-xl border border-border bg-card overflow-hidden mb-4">
                        <div className="flex flex-col md:flex-row md:flex-wrap md:items-stretch">
                            {/* Grupo: Responsáveis */}
                            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="w-1 h-6 rounded-full bg-primary/40" />
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsáveis</span>
                                </div>
                                <Input
                                    placeholder="Veterinário *"
                                    value={protocoloData.veterinario}
                                    onChange={(e) => setProtocoloData({ ...protocoloData, veterinario: e.target.value })}
                                    className="h-11 md:h-9 w-[calc(50%-0.375rem)] md:w-[160px] bg-background/80 border-primary/20 focus:border-primary/40"
                                />
                                <Input
                                    placeholder="Técnico"
                                    value={protocoloData.tecnico}
                                    onChange={(e) => setProtocoloData({ ...protocoloData, tecnico: e.target.value })}
                                    className="h-11 md:h-9 w-[calc(50%-0.375rem)] md:w-[160px] bg-background"
                                />
                            </div>

                            {/* Grupo: Local e Data */}
                            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border">
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="w-1 h-6 rounded-full bg-primary/40" />
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Local</span>
                                </div>
                                <Select
                                    value={protocoloData.fazenda_id}
                                    onValueChange={(value) => setProtocoloData({ ...protocoloData, fazenda_id: value })}
                                    disabled={!protocoloData.veterinario}
                                >
                                    <SelectTrigger className="h-11 md:h-9 w-full md:w-[180px] bg-background">
                                        <SelectValue placeholder="Fazenda *" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fazendasPasso1.map((fazenda) => (
                                            <SelectItem key={fazenda.id} value={fazenda.id}>
                                                {fazenda.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <DatePickerBR
                                    value={protocoloData.data_inicio}
                                    onChange={(value) => setProtocoloData({ ...protocoloData, data_inicio: value || '' })}
                                    className="h-11 md:h-9 w-full md:w-[130px] bg-background"
                                />
                            </div>

                            {/* Grupo: Ação */}
                            <div className="flex items-center gap-2 px-4 py-3 w-full md:w-auto md:ml-auto bg-gradient-to-b from-muted/50 to-transparent">
                                <Button
                                    onClick={handleContinueToReceptoras}
                                    disabled={loadingPasso1 || !protocoloData.fazenda_id || !protocoloData.veterinario || !protocoloData.data_inicio}
                                    className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm shadow-primary/25 w-full md:w-auto"
                                >
                                    Continuar
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Informações do protocolo */}
                    <ProtocoloInfoCard
                        fazendaNome={getFazendaNome(protocoloData.fazenda_id)}
                        dataInicio={protocoloData.data_inicio}
                        veterinario={protocoloData.veterinario}
                        tecnico={protocoloData.tecnico}
                    />

                    {/* Lista de Receptoras */}
                    <Card className="mt-4">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Receptoras do Protocolo ({receptorasLocais.length})
                                    </CardTitle>
                                    <CardDescription>
                                        Adicione as receptoras para este protocolo
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    {/* Dialog Adicionar Receptora Existente */}
                                    <Dialog
                                        open={showAddReceptora}
                                        onOpenChange={(open) => {
                                            setShowAddReceptora(open);
                                            if (!open) resetAddForm();
                                        }}
                                    >
                                        <DialogTrigger asChild>
                                            <Button size="sm">
                                                <Plus className="w-4 h-4 mr-2" />
                                                Adicionar
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-lg">
                                            <DialogHeader>
                                                <DialogTitle>Adicionar Receptora</DialogTitle>
                                                <DialogDescription>
                                                    Busque por identificação ou nome.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <AddReceptoraForm
                                                addReceptoraForm={addReceptoraForm}
                                                setAddReceptoraForm={setAddReceptoraForm}
                                                buscaReceptora={buscaReceptora}
                                                setBuscaReceptora={setBuscaReceptora}
                                                popoverAberto={popoverAberto}
                                                setPopoverAberto={setPopoverAberto}
                                                receptorasFiltradas={receptorasFiltradas}
                                                receptorasComStatus={receptorasComStatus}
                                                loadingReceptoras={loadingReceptorasPasso1}
                                                onAdd={handleAddReceptora}
                                            />
                                        </DialogContent>
                                    </Dialog>

                                    {/* Dialog Criar Nova Receptora */}
                                    <Dialog
                                        open={showCreateReceptora}
                                        onOpenChange={(open) => {
                                            setShowCreateReceptora(open);
                                            if (!open) resetCreateForm();
                                        }}
                                    >
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <UserPlus className="w-4 h-4 mr-2" />
                                                Nova
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Cadastrar Nova Receptora</DialogTitle>
                                                <DialogDescription>
                                                    Preencha os dados da nova receptora.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <CreateReceptoraForm
                                                createReceptoraForm={createReceptoraForm}
                                                setCreateReceptoraForm={setCreateReceptoraForm}
                                                submitting={submittingPasso1}
                                                onCreate={handleCreateReceptora}
                                            />
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {receptorasLocais.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Nenhuma receptora adicionada. Adicione pelo menos uma antes de finalizar.
                                </div>
                            ) : (
                                <ReceptorasTablePasso1
                                    receptorasLocais={receptorasLocais}
                                    onRemove={handleRemoveReceptora}
                                    onUpdateCiclando={handleUpdateCiclando}
                                    onUpdateQualidade={handleUpdateQualidade}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Botões de Ação */}
                    <div className="flex items-center justify-between mt-4">
                        <Button variant="outline" onClick={handleVoltarPasso1} disabled={submittingPasso1}>
                            Voltar
                        </Button>
                        <Button
                            onClick={handleFinalizarPasso1}
                            disabled={receptorasLocais.length === 0 || submittingPasso1}
                            className="bg-primary hover:bg-primary-dark"
                        >
                            <Lock className="w-4 h-4 mr-2" />
                            {submittingPasso1 ? 'Finalizando...' : 'Finalizar 1º Passo'}
                        </Button>
                    </div>

                    <ConfirmExitDialog
                        open={showConfirmExitPasso1}
                        onOpenChange={setShowConfirmExitPasso1}
                        onConfirm={handleConfirmExitPasso1}
                        title="Sair sem finalizar?"
                        description="Se você sair agora, nenhum protocolo será criado."
                    />
                </>
            )}

            {/* Dialog Restaurar Rascunho */}
            <AlertDialog open={showRestaurarPasso1Dialog} onOpenChange={setShowRestaurarPasso1Dialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Retomar trabalho anterior?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Foi encontrado um rascunho do 1º Passo não finalizado. Deseja continuar de onde parou?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={descartarRascunhoPasso1}>
                            Descartar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={restaurarRascunho} className="bg-primary hover:bg-primary-dark">
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
