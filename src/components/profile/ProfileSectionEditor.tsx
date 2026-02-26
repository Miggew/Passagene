/**
 * Dialog para adicionar/editar seções do perfil.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Type, Image, BarChart3, MapPin, PawPrint } from 'lucide-react';
import { useUpsertSection } from '@/hooks/useProfile';
import { toast } from 'sonner';
import type { ProfileSection, ProfileSectionType, ProfileSectionContent, TextSectionContent } from '@/lib/types';

interface ProfileSectionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: ProfileSection | null;
  nextSortOrder: number;
}

const sectionTypeLabels: Record<ProfileSectionType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Texto', icon: <Type className="w-4 h-4" /> },
  animal_showcase: { label: 'Vitrine de Animais', icon: <PawPrint className="w-4 h-4" /> },
  photo_gallery: { label: 'Galeria de Fotos', icon: <Image className="w-4 h-4" /> },
  stats: { label: 'Estatísticas', icon: <BarChart3 className="w-4 h-4" /> },
  fazenda_highlight: { label: 'Destaque Fazenda', icon: <MapPin className="w-4 h-4" /> },
};

export default function ProfileSectionEditor({
  open,
  onOpenChange,
  section,
  nextSortOrder,
}: ProfileSectionEditorProps) {
  const upsertSection = useUpsertSection();
  const isEditing = !!section;

  const [sectionType, setSectionType] = useState<ProfileSectionType>('text');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [textBody, setTextBody] = useState('');

  useEffect(() => {
    if (section) {
      setSectionType(section.section_type);
      setTitle(section.title);
      setIsPublic(section.is_public);
      if (section.section_type === 'text') {
        setTextBody((section.content as TextSectionContent).body || '');
      }
    } else {
      setSectionType('text');
      setTitle('');
      setIsPublic(true);
      setTextBody('');
    }
  }, [section, open]);

  const buildContent = (): ProfileSectionContent => {
    switch (sectionType) {
      case 'text':
        return { body: textBody };
      case 'animal_showcase':
        return { animals: [], layout: 'grid' };
      case 'photo_gallery':
        return { photos: [], layout: 'grid' };
      case 'stats':
        return { show_doadoras: true, show_receptoras: true, show_embrioes: true };
      case 'fazenda_highlight':
        return { fazenda_id: '', show_animal_count: true, custom_description: '' };
    }
  };

  const handleSave = async () => {
    try {
      await upsertSection.mutateAsync({
        id: section?.id,
        section_type: sectionType,
        title: title.trim(),
        content: isEditing && section?.section_type === sectionType
          ? { ...section.content, ...(sectionType === 'text' ? { body: textBody } : {}) }
          : buildContent(),
        sort_order: section?.sort_order ?? nextSortOrder,
        is_public: isPublic,
      });
      toast.success(isEditing ? 'Seção atualizada!' : 'Seção adicionada!');
      onOpenChange(false);
    } catch {
      // handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Seção' : 'Nova Seção'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Tipo */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Tipo de seção</Label>
              <Select value={sectionType} onValueChange={(v) => setSectionType(v as ProfileSectionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sectionTypeLabels).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {icon}
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da seção"
            />
          </div>

          {/* Conteúdo por tipo */}
          {sectionType === 'text' && (
            <div className="space-y-2">
              <Label>Texto</Label>
              <Textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                placeholder="Escreva aqui..."
                rows={5}
              />
            </div>
          )}

          {sectionType === 'animal_showcase' && !isEditing && (
            <p className="text-sm text-muted-foreground">
              Você poderá adicionar animais após criar a seção.
            </p>
          )}

          {sectionType === 'photo_gallery' && !isEditing && (
            <p className="text-sm text-muted-foreground">
              Você poderá adicionar fotos após criar a seção.
            </p>
          )}

          {/* Público */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Visível para todos</Label>
              <p className="text-xs text-muted-foreground">Outros usuários podem ver esta seção</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <Button
            onClick={handleSave}
            disabled={upsertSection.isPending}
            className="w-full"
          >
            {upsertSection.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              isEditing ? 'Atualizar' : 'Criar seção'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
