import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-bg-card hover:bg-bg-card-hover text-text-primary',
        secondary: 'border-transparent bg-bg-subtle text-text-secondary hover:bg-bg-subtle/80',
        destructive: 'border-transparent bg-danger/15 text-danger',
        success: 'border-transparent bg-green/15 text-green glow-green',
        warning: 'border-transparent bg-warning/15 text-warning',
        verified: 'border-transparent bg-gold text-[#080B0A] glow-gold',
        outline: 'text-text-primary border-border-default',
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
