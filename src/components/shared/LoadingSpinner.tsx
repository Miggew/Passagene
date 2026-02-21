import { cn } from '@/lib/utils';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export default function LoadingSpinner({ className, size }: LoadingSpinnerProps) {
  // Inline mode (inside buttons, etc.)
  if (className) {
    return (
      <div className={cn('shrink-0 flex items-center justify-center', className)}>
        <LoaderDNA size={size ?? 24} variant="premium" />
      </div>
    );
  }

  // Full/splash mode (page loading)
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[60vh] p-8">
      <LoaderDNA size={size ?? 64} variant="premium" />
    </div>
  );
}
