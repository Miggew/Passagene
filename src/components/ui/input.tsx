import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base: rounded-xl, borda de 1px suave com transparência de fundo
          'flex h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-base text-foreground shadow-sm ring-offset-background transition-all duration-300',
          // File input
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          // Placeholder
          'placeholder:text-muted-foreground/60',
          // Hover: preenchimento sutil
          'hover:bg-background/80 hover:border-border',
          // Focus: ring animado
          'focus-visible:outline-none focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background/50 disabled:hover:border-border/60',
          // Responsive
          'md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
