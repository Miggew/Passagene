import React from 'react';
import { cn } from '@/lib/utils';
import { VariantProps, cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

// --- BUTTONS ---

const buttonVariants = cva(
  "relative overflow-hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-95 touch-manipulation font-sans",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-btn-primary hover:bg-primary/90 hover:shadow-btn-hover",
        secondary: "bg-secondary text-secondary-foreground border border-primary/20 hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground text-muted-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-11 px-5 py-2", // Mobile friendly height (44px+)
        sm: "h-9 px-3 text-xs font-mono uppercase tracking-wider",
        lg: "h-12 px-8 text-base font-display font-bold",
        icon: "h-11 w-11",
      },
      fullWidth: {
        true: "w-full",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {/* Gradiente de brilho sutil (Glass effect) */}
        <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none" />
        
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </button>
    );
  }
);
Button.displayName = "Button";

// --- CARDS ---

export function Card({ className, children, glow = false }: { className?: string; children: React.ReactNode; glow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground shadow-card transition-all",
        glow && "shadow-glow border-primary/20",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("font-display text-lg font-semibold leading-none tracking-tight", className)}>{children}</h3>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-6 pt-0", className)}>{children}</div>;
}

// --- BADGES ---

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "text-foreground border-border",
        // Status do PassaGene
        prenhe: "border-prenhe/20 bg-prenhe/10 text-prenhe",
        servida: "border-servida/20 bg-servida/10 text-servida",
        vazia: "border-vazia/20 bg-vazia/10 text-vazia",
        info: "border-info/20 bg-info/10 text-info",
        warning: "border-warning/20 bg-warning/10 text-warning",
        error: "border-error/20 bg-error/10 text-error",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      )}
      {props.children}
    </div>
  );
}
