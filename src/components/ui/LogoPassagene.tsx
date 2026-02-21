import React, { useEffect, useRef, useState } from 'react';

// Cores agora são injetadas pelo Tailwind e CSS Custom Properties
// Veja index.css para as variáveis --logo-*

interface LogoPassageneProps {
    /** Altura máxima que a pílula vai ocupar (Ideal: 48 a 52px para Navbars) */
    height?: number;
    /** Variante do Logo: 
     * 'premium' = Fundo Musgo, Passa Verde Neon, Gene Branco (V4 Aprovada) 
     * 'hollow' = Fundo Transparente, letreiros Verde Musgo
     * 'white' = Fundo Transparente, filamentos 100% brancos (ideal para botões coloridos)
     */
    variant?: 'premium' | 'hollow' | 'white';
    /** Exibe a tipografia "PassaGene"? Se falso, exibe apenas a pílula encostada. */
    showText?: boolean;
    /** Força o DNA a ficar se movendo independentemente do hover (Útil para botões de IA) */
    forceAnimate?: boolean;
}

export const LogoPassagene: React.FC<LogoPassageneProps> = ({
    height = 52,
    variant = 'premium',
    showText = true,
    forceAnimate = false,
} = {}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Elementos do DOM para as bolinhas (Preenchidos dinamicamente)
    const dotsRef = useRef<Array<{ base: HTMLDivElement; rev: HTMLDivElement; delaySec: number }>>([]);
    const animFrameRef = useRef<number>();
    const [isHovered, setIsHovered] = useState(false);

    // Configurações Matemáticas Inquebráveis
    const numDots = 7;
    const innerSize = height; // Bola perfeita
    const targetLength = innerSize * (194 / 200); // Proporção exata do desenho vetorial original
    const wrapperSize = targetLength / numDots;
    const dotSize = wrapperSize * 0.93;

    const delaySpan = 0.75; // Fita em "Meia Onda"
    const ANIM_DURATION = 1.5;

    // Definição de Cores Baseada na Variante
    const getColors = () => {
        switch (variant) {
            case 'white':
                return {
                    bg: 'transparent',
                    frontStrand: '#ffffff',
                    backStrand: 'rgba(255, 255, 255, 0.5)',
                    textPassa: '#ffffff',
                    textGene: 'rgba(255, 255, 255, 0.7)'
                };
            case 'premium':
                return {
                    bg: 'hsl(var(--logo-bg))',
                    frontStrand: 'hsl(var(--logo-front))',
                    backStrand: 'hsl(var(--logo-back))',
                    // Texto fora do badge usa cores que se adaptam ao tema
                    textPassa: 'hsl(var(--logo-hollow-passa))',
                    textGene: 'hsl(var(--logo-hollow-gene))'
                };
            case 'hollow':
            default:
                // Ideal para fundos corporativos vazados (Se adapta ao light/dark mode pelo CSS)
                return {
                    bg: 'transparent',
                    frontStrand: 'hsl(var(--logo-hollow-front))',
                    backStrand: 'hsl(var(--logo-hollow-back))',
                    textPassa: 'hsl(var(--logo-hollow-passa))',
                    textGene: 'hsl(var(--logo-hollow-gene))'
                };
        }
    };

    const colors = getColors();

    // Lifecycle: Cria as posições iniciais calculadas (t=0)
    useEffect(() => {
        const updateDots = (timeProgress: number) => {
            dotsRef.current.forEach((data) => {
                if (!data.base || !data.rev) return;

                const absTime = timeProgress - data.delaySec;
                const progress = ((absTime % ANIM_DURATION) + ANIM_DURATION) % ANIM_DURATION / ANIM_DURATION;
                const cosVal = Math.cos(progress * 2 * Math.PI);

                // Movimento Lado Frente
                const top1Percent = 50 * (1 - cosVal);
                const scale1 = 0.75 + 0.25 * cosVal;
                const z1 = cosVal >= 0 ? 2 : 1;

                // Movimento Lado Trás
                const bottom2Percent = 50 * (1 - cosVal);
                const scale2 = 0.75 - 0.25 * cosVal;
                const z2 = -cosVal >= 0 ? 2 : 1;

                // Math.abs é necessário porque em JS sub-pixels negativos podem quebrar o calc() em alguns browsers
                data.base.style.top = `calc(${Math.abs(top1Percent)}% - ${(dotSize * Math.abs(top1Percent)) / 100}px)`;
                data.base.style.transform = `scale(${scale1})`;
                data.base.style.zIndex = z1.toString();

                data.rev.style.bottom = `calc(${Math.abs(bottom2Percent)}% - ${(dotSize * Math.abs(bottom2Percent)) / 100}px)`;
                data.rev.style.transform = `scale(${scale2})`;
                data.rev.style.zIndex = z2.toString();
            });
        };

        // Força o frame zero 
        updateDots(0.0);

        // Motor de Animação 60FPS Javascript (Sem CSS Bugado)
        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsedSec = (timestamp - startTime) / 1000;
            updateDots(elapsedSec);

            if (isHovered || forceAnimate) {
                animFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Encerra e congela de volta na raiz no próximo frame
                updateDots(0.0);
                startTime = null;
            }
        };

        if (isHovered || forceAnimate) {
            animFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isHovered, ANIM_DURATION, dotSize]);

    // Constroi os arrays vazios para os Dots de acordo com a matemática
    const dotsConfig = Array.from({ length: numDots }).map((_, i) => {
        return {
            id: i,
            delaySec: -((i / (numDots - 1)) * delaySpan)
        };
    });

    return (
        <div
            className="flex items-center cursor-pointer select-none transition-transform hover:-translate-y-[2px]"
            style={{
                height: `${height}px`,
                gap: '8px',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* SÍMBOLO DNA */}
            <div
                className="relative flex items-center justify-center shrink-0 overflow-hidden"
                style={{
                    width: `${innerSize}px`,
                    height: `${innerSize}px`,
                    backgroundColor: colors.bg,
                    borderRadius: '50%',
                    boxShadow: variant === 'premium' ? '0 4px 14px rgba(0, 0, 0, 0.1)' : 'none'
                }}
            >
                <div
                    className="flex items-center justify-center h-[60%]"
                    style={{ transform: 'rotate(-45deg) scale(0.93)' }}
                >
                    {dotsConfig.map((config, i) => (
                        <div
                            key={config.id}
                            className="relative flex justify-center items-center h-full"
                            style={{ width: `${wrapperSize}px` }}
                        >
                            <div
                                ref={(el) => {
                                    if (el) {
                                        if (!dotsRef.current[i]) dotsRef.current[i] = { delaySec: config.delaySec } as any;
                                        dotsRef.current[i].base = el;
                                    }
                                }}
                                className="absolute rounded-full"
                                style={{
                                    width: `${dotSize}px`,
                                    height: `${dotSize}px`,
                                    backgroundColor: colors.frontStrand,
                                    left: `calc(50% - ${dotSize / 2}px)`
                                }}
                            />
                            <div
                                ref={(el) => {
                                    if (el) {
                                        if (!dotsRef.current[i]) dotsRef.current[i] = { delaySec: config.delaySec } as any;
                                        dotsRef.current[i].rev = el;
                                    }
                                }}
                                className="absolute rounded-full"
                                style={{
                                    width: `${dotSize}px`,
                                    height: `${dotSize}px`,
                                    backgroundColor: colors.backStrand,
                                    left: `calc(50% - ${dotSize / 2}px)`
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* TIPOGRAFIA */}
            {showText && (
                <div
                    className="font-extrabold flex items-center tracking-tight"
                    style={{
                        fontSize: `${height * 0.58}px`, // Escalabilidade perfeita independente da Pílula (Ex: 30px numa pílula 52px)
                        lineHeight: 1,
                        fontFamily: "'Outfit', sans-serif"
                    }}
                >
                    <span style={{ color: colors.textPassa }}>Passa</span>
                    <span style={{ color: colors.textGene, fontWeight: 400 }}>Gene</span>
                </div>
            )}
        </div>
    );
};
