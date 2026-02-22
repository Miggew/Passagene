import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: rounded-xl (12px), border-2, transições suaves, tipografia Font-bold
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-border text-sm font-bold tracking-tight ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary verde PassaGene
        // Primary verde PassaGene
        default:
          "btn-primary-green border-0",
        // Primary Dourado Marketplace
        gold:
          "btn-primary-gold border-0",
        // Destructive (vermelho)
        destructive:
          "bg-danger text-white shadow-[0_0_15px_rgba(224,82,82,0.15)] hover:bg-danger/90 hover:translate-y-0.5 hover:shadow-none active:scale-[0.96] border-0",
        // Botão secundário: Borda active, fundo transparente
        secondary:
          "border-2 border-border-active bg-transparent text-text-primary shadow-sm hover:bg-border-active/10 hover:translate-y-0.5 hover:shadow-none active:scale-[0.96]",
        // Botão terciário/cancelar: Borda padrão, fundo card
        ghost:
          "border-2 border-border-default bg-bg-card text-text-primary hover:bg-bg-card-hover hover:translate-y-0.5 hover:shadow-none active:scale-[0.96]",
        // Outline simples
        outline:
          "border-2 border-border-default bg-bg-card hover:bg-bg-card-hover text-text-primary shadow-sm hover:translate-y-0.5 hover:shadow-none",
        // Link
        link:
          "border-transparent text-info underline-offset-4 hover:underline hover:text-info/80",
        // Alias retrocompatíveis
        accent:
          "btn-primary-green border-0",
        success:
          "btn-primary-green border-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8 text-base",
        xl: "h-12 px-10 text-base font-semibold",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
