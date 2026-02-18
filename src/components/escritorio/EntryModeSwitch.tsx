import { Camera, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntryMode } from '@/lib/types/escritorio';

interface EntryModeSwitchProps {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}

export default function EntryModeSwitch({ mode, onChange }: EntryModeSwitchProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
      <button
        onClick={() => onChange('ocr')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          mode === 'ocr'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Camera className="w-4 h-4" />
        Foto / Scan
      </button>
      <button
        onClick={() => onChange('manual')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
          mode === 'manual'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Keyboard className="w-4 h-4" />
        Manual
      </button>
    </div>
  );
}
