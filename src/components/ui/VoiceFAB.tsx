import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GeniaLogo } from './GeniaLogo';

interface VoiceFABProps {
    className?: string;
    size?: 'md' | 'lg' | 'xl';
    isSidebar?: boolean;
}

export function VoiceFAB({ className, size = 'lg', isSidebar = false }: VoiceFABProps) {
    const navigate = useNavigate();
    const [isHolding, setIsHolding] = useState(false);
    const pressTimer = useRef<NodeJS.Timeout | null>(null);
    const holdTriggered = useRef(false);

    // Configurações de tamanho
    const sizeClasses = {
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-20 h-20'
    };

    const iconSizes = {
        md: 20,
        lg: 24,
        xl: 32
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        // Ignora botão direito
        if (e.button !== 0) return;

        holdTriggered.current = false;

        pressTimer.current = setTimeout(() => {
            setIsHolding(true);
            holdTriggered.current = true;

            // Navega e aciona o gravador de voz automaticamente via state ou window event
            navigate('/genia', { state: { autoStartVoice: true } });

            // Disparar evento global para a página ConsultorIA capturar e iniciar gravação
            window.dispatchEvent(new CustomEvent('genia:start-voice'));

        }, 500); // 500ms define um "hold"
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }

        setIsHolding(false);

        // Se soltou antes de 500ms, é um clique normal (navegação simples)
        if (!holdTriggered.current) {
            // Se já não estiver na página, vai para ela
            navigate('/genia');
        } else {
            // Se estava segurando e soltou, envia o áudio
            window.dispatchEvent(new CustomEvent('genia:stop-voice'));
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        // Se arrastar o dedo pra fora enquanto segura, envia/cancela?
        // Vamos manter gravando até soltar o touch/mouse up globalmente se possível, 
        // mas para garantir limpeza anulamos apenas o isHolding visual e enviamos o áudio.
        if (isHolding) {
            setIsHolding(false);
            window.dispatchEvent(new CustomEvent('genia:stop-voice'));
        }

        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (pressTimer.current) clearTimeout(pressTimer.current);
        };
    }, []);

    // Se a sidebar tá colapsada, mostrar só o ícone. O design será um gradiente premium verde.
    return (
        <button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            className={cn(
                "group relative bg-primary hover:bg-primary-light rounded-full flex items-center justify-center text-white z-20 transition-all active:scale-95 select-none",
                sizeClasses[size],
                isSidebar && !isHolding ? "shadow-md" : "shadow-[0_6px_20px_rgba(9,201,114,0.35)] hover:shadow-[0_8px_25px_rgba(9,201,114,0.5)]",
                isHolding && "ring-4 ring-primary/30 animate-pulse bg-emerald-500 scale-110",
                className
            )}
            style={{ WebkitTapHighlightColor: 'transparent' }}
        >
            {/* Ondas Sonoras Radiais quando está segurando */}
            {isHolding && (
                <>
                    <div className="absolute inset-0 rounded-full border border-white/40 animate-ping opacity-75" />
                    <div className="absolute -inset-2 rounded-full border border-white/20 animate-ping opacity-50 animation-delay-200" />
                </>
            )}

            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
            </div>

            <div className="relative z-10 transition-transform drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] pointer-events-none flex flex-col items-center justify-center">
                {isHolding ? (
                    <Mic className={cn("text-white animate-bounce", size === 'xl' ? "w-10 h-10" : "w-7 h-7")} />
                ) : (
                    // Mostrar apenas icon ou texto dependendo do contexto
                    size === 'md' ? (
                        <div className="font-black tracking-tighter text-white text-[15px]">G</div>
                    ) : (
                        <div className={cn("font-black tracking-tighter uppercase text-white leading-none text-center")}>
                            <div className="text-[14px] opacity-80" style={{ fontSize: size === 'xl' ? 22 : 14 }}>Gen</div>
                            <div className="text-[17px]" style={{ fontSize: size === 'xl' ? 26 : 17 }}>.IA</div>
                        </div>
                    )
                )}
            </div>

            {/* Dica de interação flutuante */}
            {!isHolding && !isSidebar && (
                <div className="absolute -top-8 bg-black/70 backdrop-blur-md text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Segure para Falar
                </div>
            )}
        </button>
    );
}
