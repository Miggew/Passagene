import { cn } from '@/lib/utils';

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
  showValue?: boolean;
}

const styles = {
  high: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  low: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
} as const;

export default function ConfidenceBadge({ confidence, className, showValue = true }: ConfidenceBadgeProps) {
  const level = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border',
        styles[level],
        className,
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          level === 'high' && 'bg-green-500',
          level === 'medium' && 'bg-amber-500',
          level === 'low' && 'bg-red-500',
        )}
      />
      {showValue && `${confidence}%`}
    </span>
  );
}
