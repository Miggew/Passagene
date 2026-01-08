import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export default function LoadingSpinner({ className, size = 24 }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={cn('animate-spin text-green-600', className)} size={size} />
    </div>
  );
}