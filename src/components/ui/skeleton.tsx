import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-[shimmer-phosphor_3s_infinite_linear] rounded-md bg-gradient-to-r from-muted via-primary/10 to-muted bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
