/**
 * Dialog de configuração de visibilidade por métrica.
 * Cada toggle controla se uma stat aparece publicamente.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';

interface MetricConfig {
  key: string;
  label: string;
}

interface StatsVisibilityConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metrics: MetricConfig[];
  visibility: Record<string, boolean>;
  onSave: (visibility: Record<string, boolean>) => void;
}

export default function StatsVisibilityConfig({
  open, onOpenChange, metrics, visibility, onSave,
}: StatsVisibilityConfigProps) {
  const [local, setLocal] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocal({ ...visibility });
  }, [visibility, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Visibilidade das Estatísticas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {metrics.map(m => (
            <div key={m.key} className="flex items-center justify-between">
              <Label className="text-sm">{m.label}</Label>
              <Switch
                checked={local[m.key] !== false}
                onCheckedChange={v => setLocal(prev => ({ ...prev, [m.key]: v }))}
              />
            </div>
          ))}
          <Button
            className="w-full mt-4"
            onClick={() => {
              onSave(local);
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
