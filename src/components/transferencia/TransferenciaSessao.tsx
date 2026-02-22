import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MapPin, Package, AlertTriangle, Play, CheckCircle } from "lucide-react";
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ReceptorasSelection from "@/components/transferencia/ReceptorasSelection";
import EmbrioesTablePacote from "@/components/transferencia/EmbrioesTablePacote";
import EmbrioesTableCongelados from "@/components/transferencia/EmbrioesTableCongelados";
import { TransferenciaFormData, CamposPacote, PacoteEmbrioes, EmbrioCompleto, ReceptoraSincronizada } from "@/lib/types/transferenciaEmbrioes";

interface TransferenciaSessaoProps {
    formData: TransferenciaFormData;
    setFormData: (data: TransferenciaFormData | ((prev: TransferenciaFormData) => TransferenciaFormData)) => void;
    camposPacote: CamposPacote;
    setCamposPacote: (data: CamposPacote | ((prev: CamposPacote) => CamposPacote)) => void;
    fazendas: { id: string; nome: string; cliente: { nome: string } }[];
    pacotesFiltrados: PacoteEmbrioes[];
    embrioesCongelados: EmbrioCompleto[];
    origemEmbriao: string;
    loadingCongelados: boolean;
    pacoteSelecionado: PacoteEmbrioes | null;
    hasD8Limite: boolean;
    embrioesDisponiveis: EmbrioCompleto[];
    permitirSegundoEmbriao: boolean;
    setPermitirSegundoEmbriao: (val: boolean) => void;
    clienteIds: string[];
    receptora_id: string; // Do formData
    handleFazendaChange: (id: string) => void;
    handlePacoteChange: (id: string) => void;
    onSelectReceptora: (id: string, protocoloReceptoraId: string) => void;
    // Props para filtros de congelados
    filtroClienteId: string;
    filtroRaca: string;
    // Props para ReceptorasSelection e Tables (pass-through)
    receptoras: ReceptoraSincronizada[];
    contagemSessaoPorReceptora: Record<string, number>;
    receptorasSessaoInfo: Record<string, ReceptoraSincronizada>;
    transferenciasIdsSessao: string[];
    handleDescartarReceptora: (id: string) => void;
    // Props para tabelas de embrioes
    numerosFixosMap: Map<string, number>;
    embrioesPage: number;
    setEmbrioesPage: (page: number) => void;
    EMBRIOES_PAGE_SIZE: number;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    onSelectEmbriao: (id: string) => void;
    submitting: boolean;
}

export function TransferenciaSessao({
    formData,
    setFormData,
    camposPacote,
    setCamposPacote,
    fazendas,
    pacotesFiltrados,
    embrioesCongelados,
    origemEmbriao,
    loadingCongelados,
    pacoteSelecionado,
    hasD8Limite,
    embrioesDisponiveis,
    permitirSegundoEmbriao,
    setPermitirSegundoEmbriao,
    handleFazendaChange,
    handlePacoteChange,
    onSelectReceptora,
    filtroClienteId,
    filtroRaca,
    receptoras,
    contagemSessaoPorReceptora,
    receptorasSessaoInfo,
    transferenciasIdsSessao,
    handleDescartarReceptora,
    numerosFixosMap,
    embrioesPage,
    setEmbrioesPage,
    EMBRIOES_PAGE_SIZE,
    handleSubmit,
    onSelectEmbriao,
    submitting
}: TransferenciaSessaoProps) {

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
            {/* Coluna da Esquerda: Seleção e Receptoras */}
            <div className="lg:col-span-4 space-y-4">
                <Card className="border-border shadow-sm">
                    <CardHeader className="pb-3 bg-muted/30">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" />
                            Local e Origem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        {/* Seleção de Fazenda */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                                Fazenda Destino
                                {formData.fazenda_id && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                                        {fazendas.find(f => f.id === formData.fazenda_id)?.cliente?.nome}
                                    </Badge>
                                )}
                            </Label>
                            <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
                                <SelectTrigger className={`h-11 md:h-10 ${formData.fazenda_id ? 'border-primary/50 bg-primary/5' : ''}`}>
                                    <SelectValue placeholder="Selecione a fazenda..." />
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

                        {/* Seleção de Pacote ou Embrião Congelado */}
                        {formData.fazenda_id && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                                    {origemEmbriao === 'FRESCO' ? 'Pacote / Lote FIV' : 'Embrião Congelado'}
                                    {hasD8Limite && origemEmbriao === 'FRESCO' && (
                                        <Badge variant="destructive" className="text-[10px] h-5 px-1.5 animate-pulse">
                                            D8 Limite!
                                        </Badge>
                                    )}
                                </Label>

                                {origemEmbriao === 'FRESCO' ? (
                                    <Select
                                        value={formData.pacote_id}
                                        onValueChange={handlePacoteChange}
                                        disabled={!formData.fazenda_id || pacotesFiltrados.length === 0}
                                    >
                                        <SelectTrigger className={`h-11 md:h-10 ${formData.pacote_id ? 'border-primary/50 bg-primary/5' : ''}`}>
                                            <SelectValue placeholder={pacotesFiltrados.length === 0 ? "Nenhum pacote disponível" : "Selecione o pacote..."} />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {pacotesFiltrados.map((pacote) => (
                                                <SelectItem key={pacote.id} value={pacote.id} className="py-2">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium">{pacote.nome}</span>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                            <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-sm">
                                                                {pacote.embrioes.filter(e => e.status_atual === 'FRESCO').length} embriões
                                                            </Badge>
                                                            <span>• {pacote.raca || 'Raça mista'}</span>
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    // Select para Congelados (opcional, pois tem tabela dedicada)
                                    <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-border text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Selecione um embrião na lista de congelados ao lado.
                                        </p>
                                        <Badge variant="outline" className="mt-2">
                                            {loadingCongelados ? 'Carregando...' : `${embrioesCongelados.length} disponíveis`}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Aviso de Pacote Vazio ou Erro */}
                        {origemEmbriao === 'FRESCO' && formData.fazenda_id && pacotesFiltrados.length === 0 && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2 text-sm text-amber-600">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Nenhum pacote encontrado para esta fazenda com os filtros atuais. Verifique a data de referência.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {formData.fazenda_id && (formData.pacote_id || origemEmbriao === 'CONGELADO') && (
                    <ReceptorasSelection
                        fazendaId={formData.fazenda_id}
                        receptoraSelecionadaId={formData.receptora_id}
                        onSelectReceptora={(id, protocoloId) => {
                            setFormData((prev) => ({ ...prev, receptora_id: id, protocolo_receptora_id: protocoloId }));
                            onSelectReceptora(id, protocoloId);
                        }}
                        receptoras={receptoras}
                        contagemSessaoPorReceptora={contagemSessaoPorReceptora}
                        receptorasSessaoInfo={receptorasSessaoInfo}
                        transferenciasIdsSessao={transferenciasIdsSessao}
                        onDescartarReceptora={handleDescartarReceptora}
                        permitirSegundoEmbriao={permitirSegundoEmbriao}
                    />
                )}
            </div>

            {/* Coluna da Direita: Lista de Embriões e Ação */}
            <div className="lg:col-span-8 space-y-4">
                {formData.fazenda_id && (formData.pacote_id || origemEmbriao === 'CONGELADO') ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                        {/* Switch para 2 embriões */}
                        <div className="flex items-center justify-end space-x-2 py-1">
                            <Switch
                                id="modo-gemeos"
                                checked={permitirSegundoEmbriao}
                                onCheckedChange={setPermitirSegundoEmbriao}
                            />
                            <Label htmlFor="modo-gemeos" className="text-xs text-muted-foreground cursor-pointer">
                                Permitir 2 embriões/receptora
                            </Label>
                        </div>

                        {origemEmbriao === 'FRESCO' && pacoteSelecionado ? (
                            <EmbrioesTablePacote
                                pacote={pacoteSelecionado}
                                embrioes={embrioesDisponiveis}
                                numerosFixosMap={numerosFixosMap}
                                selectedEmbriaoId={formData.embriao_id}
                                onSelectEmbriao={onSelectEmbriao}
                                embrioesPage={embrioesPage}
                                onPageChange={setEmbrioesPage}
                                hasD8Limite={hasD8Limite}
                            />
                        ) : origemEmbriao === 'CONGELADO' ? (
                            <EmbrioesTableCongelados
                                embrioes={embrioesCongelados}
                                selectedEmbriaoId={formData.embriao_id}
                                onSelectEmbriao={onSelectEmbriao}
                                embrioesPage={embrioesPage}
                                onPageChange={setEmbrioesPage}
                                loadingCongelados={loadingCongelados}
                                filtroClienteId={filtroClienteId}
                                filtroRaca={filtroRaca}
                            />
                        ) : null}

                        {/* Botão de Transferir */}
                        {formData.embriao_id && formData.receptora_id && (
                            <div className="flex justify-end pt-4 border-t border-border">
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-primary hover:bg-primary-dark"
                                >
                                    {submitting ? (
                                        <>
                                            <LoadingSpinner className="mr-2" size={20} />
                                            Registrando...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Transferir Embrião
                                        </>
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Empty State da Direita */
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border/50 rounded-xl bg-muted/5">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Play className="w-8 h-8 text-muted-foreground ml-1" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Inicie uma Transferência</h3>
                        <p className="text-muted-foreground max-w-md text-sm">
                            Selecione uma <strong>Fazenda</strong> e um <strong>Pacote de Embriões</strong> (ou Embriões Congelados) à esquerda para visualizar os itens disponíveis para transferência.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
