import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base: rounded-lg (8px), shadow-sm, transições
          'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm ring-offset-background transition-all duration-200',
          // File input
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          // Placeholder
          'placeholder:text-muted-foreground',
          // Hover: borda mais escura
          'hover:border-primary/40',
          // Focus: ring verde translúcido supersuave, borda
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/50',
          // Disabled
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input',
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
