/**
 * Editor inline para seção Vitrine de Animais.
 * Permite selecionar doadoras por fazenda e touros para exibir no perfil.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Search } from 'lucide-react';
import { useMyFazendaProfiles } from '@/hooks/useFazendaProfile';
import { useDoadorasByFazenda, useTouros } from '@/api/hooks';
import type { AnimalShowcaseContent } from '@/lib/types';

interface AnimalShowcaseEditorProps {
  animals: AnimalShowcaseContent['animals'];
  onChange: (animals: AnimalShowcaseContent['animals']) => void;
  clienteId: string;
}

export default function AnimalShowcaseEditor({ animals, onChange, clienteId }: AnimalShowcaseEditorProps) {
  const { data: fazendas } = useMyFazendaProfiles(clienteId);
  const [selectedFazendaId, setSelectedFazendaId] = useState(fazendas?.[0]?.fazenda?.id || '');
  const [tab, setTab] = useState<'doadora' | 'touro'>('doadora');
  const [search, setSearch] = useState('');

  const { data: doadoras } = useDoadorasByFazenda(selectedFazendaId || undefined);
  const { data: touros } = useTouros();

  const selectedIds = new Set(animals.map((a) => a.id));

  const handleAdd = (animal: { type: 'doadora' | 'touro'; id: string; nome: string; foto_url?: string }) => {
    if (selectedIds.has(animal.id)) return;
    onChange([...animals, animal]);
  };

  const handleRemove = (id: string) => {
    onChange(animals.filter((a) => a.id !== id));
  };

  const filteredDoadoras = (doadoras || []).filter((d) => {
    const term = search.toLowerCase();
    return (
      !selectedIds.has(d.id) &&
      ((d.nome || '').toLowerCase().includes(term) || d.registro.toLowerCase().includes(term))
    );
  });

  const filteredTouros = (touros || []).filter((t) => {
    const term = search.toLowerCase();
    return (
      !selectedIds.has(t.id) &&
      (t.nome.toLowerCase().includes(term) || t.registro.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Animais selecionados */}
      {animals.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Selecionados ({animals.length})</Label>
          <div className="flex flex-wrap gap-2">
            {animals.map((animal) => (
              <span
                key={animal.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
              >
                <span className="text-[10px] text-muted-foreground uppercase">
                  {animal.type === 'doadora' ? 'D' : 'T'}
                </span>
                {animal.nome}
                <button
                  onClick={() => handleRemove(animal.id)}
                  className="ml-0.5 hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs doadora/touro */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
        <button
          onClick={() => setTab('doadora')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'doadora' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Doadoras
        </button>
        <button
          onClick={() => setTab('touro')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'touro' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Touros
        </button>
      </div>

      {/* Fazenda selector (only for doadoras) */}
      {tab === 'doadora' && fazendas && fazendas.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Fazenda</Label>
          <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione a fazenda" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map(({ fazenda }) => (
                <SelectItem key={fazenda.id} value={fazenda.id}>
                  {fazenda.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou registro..."
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Animal list */}
      <ScrollArea className="h-[200px] rounded-md border">
        <div className="p-2 space-y-1">
          {tab === 'doadora' &&
            filteredDoadoras.map((d) => (
              <button
                key={d.id}
                onClick={() =>
                  handleAdd({
                    type: 'doadora',
                    id: d.id,
                    nome: d.nome || d.registro,
                    foto_url: d.foto_url,
                  })
                }
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{d.nome || d.registro}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {d.registro} {d.raca && `· ${d.raca}`}
                  </p>
                </div>
              </button>
            ))}

          {tab === 'touro' &&
            filteredTouros.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  handleAdd({
                    type: 'touro',
                    id: t.id,
                    nome: t.nome,
                    foto_url: t.foto_url,
                  })
                }
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{t.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.registro} {t.raca && `· ${t.raca}`}
                  </p>
                </div>
              </button>
            ))}

          {tab === 'doadora' && filteredDoadoras.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              {selectedFazendaId ? 'Nenhuma doadora encontrada.' : 'Selecione uma fazenda.'}
            </p>
          )}
          {tab === 'touro' && filteredTouros.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum touro encontrado.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
