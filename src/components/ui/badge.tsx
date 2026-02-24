import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border/40 bg-foreground/5 hover:bg-foreground/10 text-foreground backdrop-blur-sm',
        secondary: 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60 backdrop-blur-sm',
        destructive: 'border-transparent bg-destructive/15 text-destructive',
        success: 'border-transparent bg-primary/15 text-primary glow-green',
        warning: 'border-transparent bg-warning/15 text-warning',
        verified: 'border-transparent bg-gold text-[#080B0A] glow-gold',
        outline: 'text-foreground border-border/60',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
