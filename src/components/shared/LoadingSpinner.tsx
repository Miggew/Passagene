import { cn } from '@/lib/utils';
import DnaHelixIcon from './DnaHelixIcon';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export default function LoadingSpinner({ className, size }: LoadingSpinnerProps) {
  // Inline mode (inside buttons, etc.)
  if (className) {
    return <DnaHelixIcon size={size ?? 20} className={cn('shrink-0', className)} />;
  }

  // Full/splash mode (page loading)
  return (
    <div className="flex items-center justify-center p-8">
      <DnaHelixIcon size={size ?? 80} className="shadow-md" />
    </div>
  );
}
