import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/mobile-atoms';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { Calendar, Users, MapPin } from 'lucide-react';

interface SetupData {
  fazenda_id: string;
  data: string;
  horario: string;
  veterinario: string;
  tecnico: string;
}

export default function Step1Setup({ data, onChange, onNext }: { data: SetupData, onChange: (d: Partial<SetupData>) => void, onNext: () => void }) {
  const [fazendas, setFazendas] = useState<{ id: string, nome: string }[]>([]);

  useEffect(() => {
    supabase.from('fazendas').select('id, nome').order('nome').then(({ data }) => {
      if (data) setFazendas(data);
    });
  }, []);

  const isValid = data.fazenda_id && data.veterinario && data.tecnico && data.data;

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-primary uppercase text-[10px] font-bold font-mono tracking-[0.15em]">
            <MapPin className="w-3.5 h-3.5" />
            Local da Aspiração
          </Label>
          <Select value={data.fazenda_id} onValueChange={(v) => onChange({ fazenda_id: v })}>
            <SelectTrigger className="h-12 text-sm font-medium">
              <SelectValue placeholder="Selecione a Fazenda..." />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map(f => (
                <SelectItem key={f.id} value={f.id} className="h-10 text-sm">{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-primary uppercase text-[10px] font-bold font-mono tracking-[0.15em]">
              <Calendar className="w-3.5 h-3.5" />
              Data
            </Label>
            <Input 
              type="date" 
              className="h-12 text-sm" 
              value={data.data} 
              onChange={e => onChange({ data: e.target.value })} 
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground uppercase text-[10px] font-bold font-mono tracking-[0.15em]">Hora Início</Label>
            <Input 
              type="time" 
              className="h-12 text-sm" 
              value={data.horario} 
              onChange={e => onChange({ horario: e.target.value })} 
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <Label className="flex items-center gap-2 text-primary uppercase text-[10px] font-bold font-mono tracking-[0.15em]">
            <Users className="w-3.5 h-3.5" />
            Equipe Responsável
          </Label>
          <Input 
            placeholder="Nome do Veterinário" 
            className="h-12 text-sm" 
            value={data.veterinario} 
            onChange={e => onChange({ veterinario: e.target.value })} 
          />
          <Input 
            placeholder="Nome do Técnico" 
            className="h-12 text-sm" 
            value={data.tecnico} 
            onChange={e => onChange({ tecnico: e.target.value })} 
          />
        </div>
      </div>

      <div className="pt-6">
        <Button 
          fullWidth 
          size="lg" 
          onClick={onNext} 
          disabled={!isValid}
          className="shadow-lg shadow-primary/20"
        >
          Continuar para Doadoras
        </Button>
      </div>
    </div>
  );
}
