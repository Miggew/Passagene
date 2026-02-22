import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';

interface ReceptorasTablePasso1Props {
    receptorasLocais: Array<{
        id?: string;
        identificacao: string;
        nome?: string;
        observacoes?: string;
        ciclando_classificacao?: 'N' | 'CL' | null;
        qualidade_semaforo?: 1 | 2 | 3 | null;
        historicoStats?: {
            totalProtocolos: number;
            gestacoes: number;
            protocolosDesdeUltimaGestacao: number;
        };
    }>;
    onRemove: (index: number) => void;
    onUpdateCiclando: (index: number, value: 'N' | 'CL' | null) => void;
    onUpdateQualidade: (index: number, value: 1 | 2 | 3 | null) => void;
}

export function ReceptorasTablePasso1({
    receptorasLocais,
    onRemove,
    onUpdateCiclando,
    onUpdateQualidade,
}: ReceptorasTablePasso1Props) {
    return (
        <>
            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
                {receptorasLocais.map((r, index) => {
                    const rowKey = r.id && r.id.trim() !== '' ? r.id : `new-${index}`;
                    const stats = r.historicoStats;

                    return (
                        <div key={rowKey} className="rounded-xl border border-border/60 glass-panel shadow-sm p-3.5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span className="font-medium text-base truncate block">{r.identificacao}</span>
                                        {r.nome && <span className="text-xs text-muted-foreground">{r.nome}</span>}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                                    onClick={() => onRemove(index)}
                                    aria-label="Remover"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Stats P/G/D */}
                            {stats && (
                                <div className="flex items-center gap-1.5 mb-3">
                                    <span className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-medium bg-muted text-foreground rounded">
                                        {stats.totalProtocolos}P
                                    </span>
                                    <span className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-medium bg-primary/15 text-primary rounded">
                                        {stats.gestacoes}G
                                    </span>
                                    <span className="inline-flex items-center justify-center px-1.5 h-5 text-[10px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded">
                                        {stats.protocolosDesdeUltimaGestacao}D
                                    </span>
                                </div>
                            )}

                            {/* Ciclando e Qualidade */}
                            <div className="flex items-center gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground uppercase">Ciclando</span>
                                    <CiclandoBadge
                                        value={r.ciclando_classificacao}
                                        onChange={(value) => onUpdateCiclando(index, value)}
                                        variant="editable"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground uppercase">Qualidade</span>
                                    <QualidadeSemaforo
                                        value={r.qualidade_semaforo}
                                        onChange={(value) => onUpdateQualidade(index, value)}
                                        variant="row"
                                    />
                                </div>
                            </div>

                            {r.observacoes && (
                                <p className="text-xs text-muted-foreground mt-1">{r.observacoes}</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Desktop: Tabela Grid */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
                {/* Tabela: min-w garante largura mínima, w-full distribui uniformemente */}
                <div className="min-w-[700px] w-full">
                    {/* Cabeçalho */}
                    <div className="grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_90px_90px_minmax(100px,1fr)_40px] gap-0 bg-muted text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        <div className="px-3 py-2">Receptora</div>
                        <div className="px-1 py-2 text-center" title="Protocolos">P</div>
                        <div className="px-1 py-2 text-center" title="Gestações">G</div>
                        <div className="px-1 py-2 text-center" title="Desde última">D</div>
                        <div className="border-r border-border/50"></div>
                        <div className="px-2 py-2 text-center">Ciclando</div>
                        <div className="px-2 py-2 text-center">Qualidade</div>
                        <div className="px-2 py-2">Obs.</div>
                        <div className="px-2 py-2"></div>
                    </div>

                    {/* Linhas */}
                    {receptorasLocais.map((r, index) => {
                        const rowKey = r.id && r.id.trim() !== '' ? r.id : `new-${index}`;
                        const stats = r.historicoStats;

                        return (
                            <div
                                key={rowKey}
                                className="group grid grid-cols-[minmax(160px,1.5fr)_36px_36px_36px_16px_90px_90px_minmax(100px,1fr)_40px] gap-0 items-center border-t border-border hover:bg-muted/50"
                            >
                                {/* Receptora */}
                                <div className="flex items-center gap-2 px-3 py-1.5">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
                                        {index + 1}
                                    </span>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium text-sm text-foreground truncate">{r.identificacao}</span>
                                        {r.nome && <span className="text-[10px] text-muted-foreground truncate">{r.nome}</span>}
                                    </div>
                                </div>

                                {/* Histórico P G D */}
                                <div className="px-1 py-1.5 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-muted text-foreground rounded">
                                        {stats?.totalProtocolos ?? 0}
                                    </span>
                                </div>
                                <div className="px-1 py-1.5 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-primary/15 text-primary rounded">
                                        {stats?.gestacoes ?? 0}
                                    </span>
                                </div>
                                <div className="px-1 py-1.5 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-5 text-[10px] font-medium bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded">
                                        {stats?.protocolosDesdeUltimaGestacao ?? 0}
                                    </span>
                                </div>

                                {/* Separador de contexto */}
                                <div className="border-r border-border/50 h-full"></div>

                                {/* Ciclando */}
                                <div className="px-2 py-1 flex justify-center">
                                    <CiclandoBadge
                                        value={r.ciclando_classificacao}
                                        onChange={(value) => onUpdateCiclando(index, value)}
                                        variant="editable"
                                    />
                                </div>

                                {/* Qualidade */}
                                <div className="px-2 py-1 flex justify-center">
                                    <QualidadeSemaforo
                                        value={r.qualidade_semaforo}
                                        onChange={(value) => onUpdateQualidade(index, value)}
                                        variant="row"
                                    />
                                </div>

                                {/* Obs */}
                                <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
                                    {r.observacoes || '-'}
                                </div>

                                {/* Ação */}
                                <div className="px-1 py-1 flex justify-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => onRemove(index)}
                                        aria-label="Remover"
                                    >
                                        <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
