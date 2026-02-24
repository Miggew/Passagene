import { Mic, ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedInputBarProps {
    input: string;
    setInput: (v: string) => void;
    isLoading: boolean;
    isListening: boolean;
    onSend: () => void;
    onStartListening: () => void;
}

export function UnifiedInputBar({
    input,
    setInput,
    isLoading,
    isListening,
    onSend,
    onStartListening,
}: UnifiedInputBarProps) {
    const hasText = input.trim().length > 0;
    const state = isListening ? 'recording' : hasText ? 'typing' : 'idle';

    return (
        <div className="mt-auto px-3 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0 z-20 w-full">
            <div
                className={cn(
                    'relative flex items-center w-full max-w-xl mx-auto rounded-[22px] transition-all',
                    state === 'recording'
                        ? 'bg-background/90 backdrop-blur-xl recording-glow'
                        : 'bg-background/80 backdrop-blur-xl border border-border/80 shadow-sm focus-within:ring-2 focus-within:ring-primary/20'
                )}
            >
                {/* Esquerda: textarea (idle/typing) OU waveform (recording) */}
                {state === 'recording' ? (
                    <div className="flex-1 flex items-center gap-3 py-2 pl-5 pr-2 min-h-[56px]">
                        {/* 7 barras de waveform — orgânicas */}
                        <div className="flex items-end gap-[3px] h-6">
                            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'w-[3.5px] rounded-full transition-all',
                                        i <= 3 || i >= 6 ? 'bg-destructive/70' : 'bg-destructive',
                                    )}
                                    style={{ height: '100%' }}
                                >
                                    <div className={`w-full h-full rounded-full waveform-bar-${((i - 1) % 5) + 1}`} />
                                </div>
                            ))}
                        </div>
                        <span className="text-[15px] font-medium text-destructive/80 animate-pulse">
                            Ouvindo...
                        </span>
                    </div>
                ) : (
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        placeholder="Pergunte algo..."
                        className="flex-1 max-h-28 min-h-[56px] bg-transparent border-0 focus:ring-0 resize-none py-4 pl-5 pr-2 text-[15px] scrollbar-thin outline-none placeholder:text-muted-foreground/50 leading-relaxed"
                        rows={1}
                    />
                )}

                {/* Direita: botão flush com a borda direita da barra */}
                <div className="flex items-center pr-1.5 shrink-0">
                    {state === 'recording' ? (
                        <button
                            onClick={onStartListening}
                            aria-label="Parar gravação"
                            className="w-[44px] h-[44px] rounded-full flex items-center justify-center bg-destructive text-white transition-all hover:scale-105 active:scale-95 shadow-[0_0_16px_rgba(224,82,82,0.4)]"
                        >
                            <Square className="w-4.5 h-4.5 fill-current" />
                        </button>
                    ) : state === 'typing' ? (
                        <button
                            onClick={onSend}
                            disabled={isLoading}
                            aria-label="Enviar mensagem"
                            className={cn(
                                'w-[44px] h-[44px] rounded-full flex items-center justify-center transition-all',
                                isLoading
                                    ? 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed'
                                    : 'btn-primary-green hover:scale-105 active:scale-95'
                            )}
                        >
                            <ArrowUp className="w-5 h-5 stroke-[2.5] text-white" />
                        </button>
                    ) : (
                        <button
                            onClick={onStartListening}
                            aria-label="Gravar mensagem de voz"
                            className="relative w-[48px] h-[48px] rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 inline-mic-breathe"
                        >
                            {/* Mini aura giratória */}
                            <div className="absolute inset-[-2px] rounded-full overflow-hidden z-0">
                                <div className="absolute inset-[-50%] voice-fab-aura" />
                            </div>
                            {/* Core acrílico */}
                            <div className="absolute inset-[2px] rounded-full voice-fab-core z-10" />
                            {/* Ícone mic */}
                            <Mic className="relative z-20 w-[22px] h-[22px] text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
