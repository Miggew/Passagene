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
    <div className={cn('border border-dashed border-slate-200 rounded-lg p-6 text-center', className)}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="text-sm text-slate-600 mt-2">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
