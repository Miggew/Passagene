import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('border border-dashed border-border rounded-xl p-6 text-center glass-panel/50', className)}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground mt-2">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
