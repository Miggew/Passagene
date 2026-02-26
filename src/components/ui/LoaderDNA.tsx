import React, { useEffect, useRef } from 'react';

// Cores agora são injetadas pelo Tailwind e CSS Custom Properties
// Veja index.css para as variáveis --logo-*

interface LoaderDNAProps {
    /** Diâmetro total do Círculo de loading em pixels */
    size?: number;
    /** Variante de Cor
     * 'accent' = Fundo Verde Vibrante (Passa Musgo)
     * 'premium' = Fundo Musgo Escuro (Passa Verde Vibrante)
     */
    variant?: 'accent' | 'premium';
}

export const LoaderDNA: React.FC<LoaderDNAProps> = ({
    size = 64,
    variant = 'accent'
} = {}) => {
    const dotsRef = useRef<Array<{ base: HTMLDivElement; rev: HTMLDivElement; delaySec: number }>>([]);
    const animFrameRef = useRef<number>(0);

    const numDots = 7;
    // O Circulo tem padding interno de ~16% para o DNA caber perfeitamente girando
    const innerSize = size * 0.84;
    const targetLength = innerSize * (194 / 200);
    const wrapperSize = targetLength / numDots;
    const dotSize = wrapperSize * 0.93;

    const delaySpan = 0.75;
    const ANIM_DURATION = 1.5;

    const getColors = () => {
        switch (variant) {
            case 'premium':
                return {
                    bg: 'var(--gradient-dna)',
                    frontStrand: '#ffffff',
                    backStrand: 'rgba(255, 255, 255, 0.5)',
                };
            case 'accent':
            default:
                return {
                    bg: 'var(--green)',
                    frontStrand: '#080B0A',
                    backStrand: 'rgba(8, 11, 10, 0.5)',
                }
        }
    };

    const colors = getColors();

    useEffect(() => {
        const updateDots = (timeProgress: number) => {
            dotsRef.current.forEach((data) => {
                if (!data.base || !data.rev) return;

                const absTime = timeProgress - data.delaySec;
                const progress = ((absTime % ANIM_DURATION) + ANIM_DURATION) % ANIM_DURATION / ANIM_DURATION;
                const cosVal = Math.cos(progress * 2 * Math.PI);

                // Lado Frente (Passa)
                const top1Percent = 50 * (1 - cosVal);
                const scale1 = 0.75 + 0.25 * cosVal;
                const z1 = cosVal >= 0 ? 2 : 1;

                // Lado Trás (Gene)
                const bottom2Percent = 50 * (1 - cosVal);
                const scale2 = 0.75 - 0.25 * cosVal;
                const z2 = -cosVal >= 0 ? 2 : 1;

                // Math.abs handles browser calculation errors for scales/percentages near zero
                data.base.style.top = `calc(${Math.abs(top1Percent)}% - ${(dotSize * Math.abs(top1Percent)) / 100}px)`;
                data.base.style.transform = `scale(${scale1})`;
                data.base.style.zIndex = z1.toString();

                data.rev.style.bottom = `calc(${Math.abs(bottom2Percent)}% - ${(dotSize * Math.abs(bottom2Percent)) / 100}px)`;
                data.rev.style.transform = `scale(${scale2})`;
                data.rev.style.zIndex = z2.toString();
            });
        };

        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsedSec = (timestamp - startTime) / 1000;
            updateDots(elapsedSec);
            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate); // Auto-play infinito para spinners

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [ANIM_DURATION, dotSize]);

    const dotsConfig = Array.from({ length: numDots }).map((_, i) => {
        return {
            id: i,
            delaySec: -((i / (numDots - 1)) * delaySpan)
        };
    });

    return (
        <div
            className="flex items-center justify-center rounded-full shrink-0 shadow-lg"
            style={{
                width: `${size}px`,
                height: `${size}px`,
                background: colors.bg,
            }}
        >
            <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ width: `${innerSize}px`, height: `${innerSize}px` }}
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
                            {/* Strand 1 */}
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
                            {/* Strand 2 */}
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
        </div>
    );
};
