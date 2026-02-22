import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
  icon?: React.ElementType;
};

export default function PageHeader({ title, description, actions, className, icon: Icon }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="mt-1 p-2 bg-primary/10 rounded-lg">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">{title}</h1>
          {description ? <p className="text-muted-foreground mt-1">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">{actions}</div> : null}
    </div>
  );
}
