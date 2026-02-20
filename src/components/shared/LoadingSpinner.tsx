import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export default function LoadingSpinner({ className, size }: LoadingSpinnerProps) {
  const s = size ?? 24;

  const dotClass = "relative w-1.5 h-full mx-0.5";
  const glowCore = "absolute w-1.5 h-1.5 rounded-full";
  // Usamos bg-background para dar a ilusão de serem "vazados" (transparente até o fundo da página)
  const glowTop = `${glowCore} bg-background animate-dna-spin`;
  const glowBot = `${glowCore} bg-background animate-dna-spin-rev opacity-80`; // Leve opacidade para dar a profundidade da fita de trás

  // Spinner inline (Substitui loader comum de botões pela hélice)
  if (className) {
    return (
      <div
        className={cn('relative flex items-center justify-center shrink-0', className)}
        style={{ height: s }}
      >
        <div className="flex items-center justify-center h-full -rotate-45 scale-[1.2]">
          <div className={dotClass}><div className={glowTop} style={{ animationDelay: "-1.4s" }} /><div className={glowBot} style={{ animationDelay: "-1.4s" }} /></div>
          <div className={dotClass}><div className={glowTop} style={{ animationDelay: "-1.25s" }} /><div className={glowBot} style={{ animationDelay: "-1.25s" }} /></div>
          <div className={dotClass}><div className={glowTop} style={{ animationDelay: "-1.1s" }} /><div className={glowBot} style={{ animationDelay: "-1.1s" }} /></div>
        </div>
      </div>
    );
  }

  // Splash / Full size spinner (Para Dashboards e Telas Principais)
  return (
    <div className="flex items-center justify-center p-8">
      <div
        className="relative flex items-center justify-center bg-primary rounded-2xl shadow-md"
        style={{ width: 80, height: 80 }}
      >
        {/* Hélice Maior Diagonal (PassaGene) - Vazada */}
        <div className="flex items-center justify-center h-[50%] -rotate-45 scale-[1.3]">
          <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.4s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.4s" }} /></div>
          <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.25s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.25s" }} /></div>
          <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-1.1s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-1.1s" }} /></div>
          <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-0.95s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-0.95s" }} /></div>
          <div className="relative w-2.5 h-full mx-1"><div className="absolute w-2.5 h-2.5 rounded-full bg-background animate-dna-spin" style={{ animationDelay: "-0.8s" }} /><div className="absolute w-2.5 h-2.5 rounded-full bg-background/80 animate-dna-spin-rev" style={{ animationDelay: "-0.8s" }} /></div>
        </div>
      </div>
    </div>
  );
}
