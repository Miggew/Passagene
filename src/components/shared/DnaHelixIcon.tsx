import { cn } from '@/lib/utils';

interface DnaHelixIconProps {
  size: number;
  className?: string;
}

const DELAYS = ['-1.4s', '-1.25s', '-1.1s', '-0.95s', '-0.8s'];

export default function DnaHelixIcon({ size, className }: DnaHelixIconProps) {
  const borderRadius = Math.round(size * 0.2);
  const dotSize = Math.max(2, size * 0.125);
  const dotMargin = Math.max(0.5, size * 0.03);

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden', className)}
      style={{ width: size, height: size, borderRadius, background: 'linear-gradient(135deg, #34D399, #D4A24C)' }}
    >
      <div
        className="flex items-center justify-center h-[50%]"
        style={{ transform: 'rotate(-45deg) scale(0.93)' }}
      >
        {DELAYS.map((delay, i) => (
          <div
            key={i}
            className="relative h-full"
            style={{ width: dotSize, marginLeft: dotMargin, marginRight: dotMargin }}
          >
            <div
              className="absolute rounded-full bg-background animate-dna-spin"
              style={{ width: dotSize, height: dotSize, animationDelay: delay }}
            />
            <div
              className="absolute rounded-full bg-background/80 animate-dna-spin-rev"
              style={{ width: dotSize, height: dotSize, animationDelay: delay }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
