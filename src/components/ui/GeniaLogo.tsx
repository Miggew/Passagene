import React from 'react';
import { cn } from '@/lib/utils';

interface GeniaLogoProps {
    className?: string;
    size?: number;
    variant?: 'default' | 'white' | 'premium';
    showText?: boolean;
}

export function GeniaLogo({
    className,
    size = 32,
    variant = 'default',
    showText = true,
}: GeniaLogoProps) {
    const isWhite = variant === 'white';
    const isPremium = variant === 'premium';

    return (
        <div className={cn("flex items-center justify-center", className)}>
            {showText && (
                <div className={cn("font-black tracking-tighter uppercase", isWhite ? "text-white" : "")} style={{ fontSize: size }}>
                    <span className={cn(isWhite ? "text-white" : "text-foreground")}>Gen</span>
                    <span className={cn(isWhite ? "text-white/80" : "text-primary")}>.IA</span>
                </div>
            )}
        </div>
    );
}
