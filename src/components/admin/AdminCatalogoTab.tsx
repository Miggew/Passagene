/**
 * Aba de administração do catálogo genético
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/shared/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Trash2,
  Star,
  Search,
  Save,
  Dna,
  SquarePen,
} from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';

interface CatalogoItem {
  id: string;
  tipo: 'doadora' | 'touro';
  doadora_id: string | null;
  touro_id: string | null;
  preco: number | null;
  preco_negociavel: boolean;
  descricao: string | null;
  foto_principal: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  created_at: string;
  nome?: string;
  registro?: string;
  raca?: string;
}

interface AnimalOption {
  id: string;
  nome: string | null;
  registro: string;
  raca: string | null;
}

export default function AdminCatalogoTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null);

  // Form state
  const [formTipo, setFormTipo] = useState<'doadora' | 'touro'>('doadora');
  const [formAnimalId, setFormAnimalId] = useState('');
  const [formPreco, setFormPreco] = useState('');
  const [formPrecoNegociavel, setFormPrecoNegociavel] = useState(false);
  const [formDescricao, setFormDescricao] = useState('');
  const [formFotoPrincipal, setFormFotoPrincipal] = useState('');
  const [formDestaque, setFormDestaque] = useState(false);
  const [formAtivo, setFormAtivo] = useState(true);
  const [formOrdem, setFormOrdem] = useState('0');

  // Animal options
  const [doadoras, setDoadoras] = useState<AnimalOption[]>([]);
  const [touros, setTouros] = useState<AnimalOption[]>([]);
  const [searchAnimal, setSearchAnimal] = useState('');

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('catalogo_genetica')
        .select('*')
        .order('ordem')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with animal names
      const enrichedItems = await Promise.all((data || []).map(async (item) => {
        if (item.tipo === 'doadora' && item.doadora_id) {
          const { data: doadora } = await supabase
            .from('doadoras')
            .select('nome, registro, raca')
            .eq('id', item.doadora_id)
            .single();
          return { ...item, ...doadora };
        } else if (item.tipo === 'touro' && item.touro_id) {
          const { data: touro } = await supabase
            .from('touros')
            .select('nome, registro, raca')
            .eq('id', item.touro_id)
            .single();
          return { ...item, ...touro };
        }
        return item;
      }));

      setItems(enrichedItems as CatalogoItem[]);
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao carregar:', error);
      toast({
        title: 'Erro ao carregar catálogo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAnimalOptions = useCallback(async () => {
    try {
      const { data: doadorasData } = await supabase
        .from('doadoras')
        .select('id, nome, registro, raca')
        .order('nome');
      setDoadoras(doadorasData || []);

      const { data: tourosData } = await supabase
        .from('touros')
        .select('id, nome, registro, raca')
        .order('nome');
      setTouros(tourosData || []);
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao carregar animais:', error);
    }
  }, []);

  useEffect(() => {
    loadItems();
    loadAnimalOptions();
  }, [loadItems, loadAnimalOptions]);

  const resetForm = () => {
    setFormTipo('doadora');
    setFormAnimalId('');
    setFormPreco('');
    setFormPrecoNegociavel(false);
    setFormDescricao('');
    setFormFotoPrincipal('');
    setFormDestaque(false);
    setFormAtivo(true);
    setFormOrdem('0');
    setSearchAnimal('');
    setEditingItem(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: CatalogoItem) => {
    setEditingItem(item);
    setFormTipo(item.tipo);
    setFormAnimalId(item.tipo === 'doadora' ? item.doadora_id || '' : item.touro_id || '');
    setFormPreco(item.preco?.toString() || '');
    setFormPrecoNegociavel(item.preco_negociavel);
    setFormDescricao(item.descricao || '');
    setFormFotoPrincipal(item.foto_principal || '');
    setFormDestaque(item.destaque);
    setFormAtivo(item.ativo);
    setFormOrdem(item.ordem.toString());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formAnimalId) {
      toast({
        title: 'Erro',
        description: 'Selecione um animal',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        tipo: formTipo,
        doadora_id: formTipo === 'doadora' ? formAnimalId : null,
        touro_id: formTipo === 'touro' ? formAnimalId : null,
        preco: formPreco ? parseFloat(formPreco) : null,
        preco_negociavel: formPrecoNegociavel,
        descricao: formDescricao || null,
        foto_principal: formFotoPrincipal || null,
        destaque: formDestaque,
        ativo: formAtivo,
        ordem: parseInt(formOrdem) || 0,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('catalogo_genetica')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast({ title: 'Item atualizado com sucesso' });
      } else {
        const { error } = await supabase
          .from('catalogo_genetica')
          .insert(payload);

        if (error) throw error;
        toast({ title: 'Item adicionado ao catálogo' });
      }

      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao salvar:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CatalogoItem) => {
    if (!confirm(`Remover "${item.nome || item.registro}" do catálogo?`)) return;

    try {
      const { error } = await supabase
        .from('catalogo_genetica')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      toast({ title: 'Item removido do catálogo' });
      loadItems();
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao deletar:', error);
      toast({
        title: 'Erro ao remover',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const toggleDestaque = async (item: CatalogoItem) => {
    try {
      const { error } = await supabase
        .from('catalogo_genetica')
        .update({ destaque: !item.destaque })
        .eq('id', item.id);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao atualizar destaque:', error);
    }
  };

  const toggleAtivo = async (item: CatalogoItem) => {
    try {
      const { error } = await supabase
        .from('catalogo_genetica')
        .update({ ativo: !item.ativo })
        .eq('id', item.id);

      if (error) throw error;
      loadItems();
    } catch (error) {
      console.error('[AdminCatalogoTab] Erro ao atualizar status:', error);
    }
  };

  const filteredAnimals = formTipo === 'doadora'
    ? doadoras.filter(d =>
        !searchAnimal ||
        d.nome?.toLowerCase().includes(searchAnimal.toLowerCase()) ||
        d.registro.toLowerCase().includes(searchAnimal.toLowerCase())
      )
    : touros.filter(t =>
        !searchAnimal ||
        t.nome?.toLowerCase().includes(searchAnimal.toLowerCase()) ||
        t.registro.toLowerCase().includes(searchAnimal.toLowerCase())
      );

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Catálogo Genético</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os animais disponíveis para venda na vitrine
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar ao Catálogo
        </Button>
      </div>

      {/* Lista de itens */}
      {items.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
            <div className="grid grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_0.6fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-primary/40" />
                Animal
              </div>
              <div className="px-3 py-3">Raça</div>
              <div className="px-3 py-3 text-right">Preço</div>
              <div className="px-3 py-3 text-center">Destaque</div>
              <div className="px-3 py-3 text-center">Ativo</div>
              <div className="px-3 py-3 text-center">Ações</div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/50">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`group grid grid-cols-[2fr_1fr_1fr_0.8fr_0.8fr_0.6fr] items-center transition-all duration-150 hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}`}
              >
                {/* Animal */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                  <Badge
                    variant="outline"
                    className={item.tipo === 'doadora' ? 'text-pink-600 border-pink-500/30' : 'text-blue-600 border-blue-500/30'}
                  >
                    <CowIcon className="w-3 h-3 mr-1" />
                    {item.tipo === 'doadora' ? 'Doadora' : 'Touro'}
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {item.nome || item.registro}
                    </p>
                    {item.nome && (
                      <p className="text-xs text-muted-foreground truncate">{item.registro}</p>
                    )}
                  </div>
                </div>

                {/* Raça */}
                <div className="px-3 py-3">
                  {item.raca && (
                    <Badge variant="outline" className="text-xs">
                      <Dna className="w-3 h-3 mr-1" />
                      {item.raca}
                    </Badge>
                  )}
                </div>

                {/* Preço */}
                <div className="px-3 py-3 text-right">
                  {item.preco ? (
                    <span className="font-medium text-primary">
                      {item.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Consultar</span>
                  )}
                </div>

                {/* Destaque */}
                <div className="px-3 py-3 flex justify-center">
                  <button
                    onClick={() => toggleDestaque(item)}
                    className={`p-1.5 rounded-md transition-colors ${item.destaque ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground hover:text-amber-500'}`}
                  >
                    <Star className={`w-4 h-4 ${item.destaque ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Ativo */}
                <div className="px-3 py-3 flex justify-center">
                  <Switch
                    checked={item.ativo}
                    onCheckedChange={() => toggleAtivo(item)}
                  />
                </div>

                {/* Ações */}
                <div className="px-3 py-3 flex justify-center gap-1">
                  <button
                    onClick={() => openEditDialog(item)}
                    className="p-1.5 rounded-md bg-transparent hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <SquarePen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-md bg-transparent hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12">
          <EmptyState
            title="Catálogo vazio"
            description="Adicione doadoras e touros ao catálogo para exibi-los na vitrine de genética"
          />
        </div>
      )}

      {/* Dialog de adicionar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Item do Catálogo' : 'Adicionar ao Catálogo'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formTipo}
                onValueChange={(v) => {
                  setFormTipo(v as 'doadora' | 'touro');
                  setFormAnimalId('');
                }}
                disabled={!!editingItem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doadora">Doadora</SelectItem>
                  <SelectItem value="touro">Touro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Animal */}
            <div className="space-y-2">
              <Label>Animal</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou registro..."
                    value={searchAnimal}
                    onChange={(e) => setSearchAnimal(e.target.value)}
                    className="pl-9"
                    disabled={!!editingItem}
                  />
                </div>
                <Select
                  value={formAnimalId}
                  onValueChange={setFormAnimalId}
                  disabled={!!editingItem}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o animal" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredAnimals.map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.nome || animal.registro} {animal.nome && `(${animal.registro})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preço e Ordem */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={formPreco}
                  onChange={(e) => setFormPreco(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={formOrdem}
                  onChange={(e) => setFormOrdem(e.target.value)}
                />
              </div>
            </div>

            {/* Preço negociável */}
            <div className="flex items-center gap-2">
              <Switch
                checked={formPrecoNegociavel}
                onCheckedChange={setFormPrecoNegociavel}
              />
              <Label>Preço negociável</Label>
            </div>

            {/* Foto principal */}
            <div className="space-y-2">
              <Label>URL da foto principal (opcional)</Label>
              <Input
                placeholder="https://..."
                value={formFotoPrincipal}
                onChange={(e) => setFormFotoPrincipal(e.target.value)}
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label>Descrição para o catálogo (opcional)</Label>
              <Textarea
                placeholder="Descrição comercial do animal..."
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                rows={3}
              />
            </div>

            {/* Destaque e Ativo */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formDestaque}
                  onCheckedChange={setFormDestaque}
                />
                <Label className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500" />
                  Destaque
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formAtivo}
                  onCheckedChange={setFormAtivo}
                />
                <Label>Ativo no catálogo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
