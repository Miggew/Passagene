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
import { Loader2, Type, Image, BarChart3, MapPin, PawPrint, Briefcase, Award, FolderOpen, Building2, Globe, Sparkles } from 'lucide-react';
import { useUpsertSection, useProfileData } from '@/hooks/useProfile';
import { useMyFazendaProfiles } from '@/hooks/useFazendaProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AnimalShowcaseEditor from './editors/AnimalShowcaseEditor';
import PhotoGalleryEditor from './editors/PhotoGalleryEditor';
import ServicePortfolioEditor from './editors/ServicePortfolioEditor';
import type {
  ProfileSection, ProfileSectionType, ProfileSectionContent, TextSectionContent,
  AnimalShowcaseContent, PhotoGalleryContent, ServicePortfolioContent,
} from '@/lib/types';

interface ProfileSectionEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: ProfileSection | null;
  nextSortOrder: number;
  fazendaProfileId?: string;
}

const sectionTypeLabels: Record<ProfileSectionType, { label: string; icon: React.ReactNode }> = {
  text: { label: 'Texto', icon: <Type className="w-4 h-4" /> },
  animal_showcase: { label: 'Vitrine de Animais', icon: <PawPrint className="w-4 h-4" /> },
  photo_gallery: { label: 'Galeria de Fotos', icon: <Image className="w-4 h-4" /> },
  stats: { label: 'Estatísticas', icon: <BarChart3 className="w-4 h-4" /> },
  fazenda_highlight: { label: 'Destaque Fazenda', icon: <MapPin className="w-4 h-4" /> },
  production_stats: { label: 'Stats de Produção', icon: <BarChart3 className="w-4 h-4" /> },
  service_stats: { label: 'Stats de Serviços', icon: <Briefcase className="w-4 h-4" /> },
  specialties: { label: 'Especialidades', icon: <Award className="w-4 h-4" /> },
  service_portfolio: { label: 'Portfolio', icon: <FolderOpen className="w-4 h-4" /> },
  fazenda_links: { label: 'Minhas Fazendas', icon: <Building2 className="w-4 h-4" /> },
  platform_stats: { label: 'Stats da Plataforma', icon: <Globe className="w-4 h-4" /> },
  feature_showcase: { label: 'Showcase de Features', icon: <Sparkles className="w-4 h-4" /> },
};

export default function ProfileSectionEditor({
  open,
  onOpenChange,
  section,
  nextSortOrder,
  fazendaProfileId,
}: ProfileSectionEditorProps) {
  const { user } = useAuth();
  const { data: profile } = useProfileData(user?.id ?? null);
  const isAdmin = profile?.user_type === 'admin';
  const { data: fazendas } = useMyFazendaProfiles(profile?.cliente_id ?? null);
  const upsertSection = useUpsertSection();
  const isEditing = !!section;

  const [sectionType, setSectionType] = useState<ProfileSectionType>('text');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [textBody, setTextBody] = useState('');
  const [selectedFazendaId, setSelectedFazendaId] = useState('');
  const [animals, setAnimals] = useState<AnimalShowcaseContent['animals']>([]);
  const [photos, setPhotos] = useState<PhotoGalleryContent['photos']>([]);
  const [portfolioItems, setPortfolioItems] = useState<ServicePortfolioContent['items']>([]);

  useEffect(() => {
    if (section) {
      setSectionType(section.section_type);
      setTitle(section.title);
      setIsPublic(section.is_public);
      if (section.section_type === 'text') {
        setTextBody((section.content as TextSectionContent).body || '');
      }
      if (section.section_type === 'animal_showcase') {
        setAnimals((section.content as AnimalShowcaseContent).animals || []);
      }
      if (section.section_type === 'photo_gallery') {
        setPhotos((section.content as PhotoGalleryContent).photos || []);
      }
      if (section.section_type === 'service_portfolio') {
        setPortfolioItems((section.content as ServicePortfolioContent).items || []);
      }
      const content = section.content as Record<string, unknown>;
      if (content?.fazenda_id) setSelectedFazendaId(content.fazenda_id as string);
    } else {
      setSectionType('text');
      setTitle('');
      setIsPublic(true);
      setTextBody('');
      setSelectedFazendaId(fazendas?.[0]?.fazenda?.id || '');
      setAnimals([]);
      setPhotos([]);
      setPortfolioItems([]);
    }
  }, [section, open, fazendas]);

  const buildContent = (): ProfileSectionContent => {
    switch (sectionType) {
      case 'text':
        return { body: textBody };
      case 'animal_showcase':
        return { animals, layout: 'grid' };
      case 'photo_gallery':
        return { photos, layout: 'grid' };
      case 'stats':
        return { show_doadoras: true, show_receptoras: true, show_embrioes: true };
      case 'fazenda_highlight':
        return { fazenda_id: selectedFazendaId, show_animal_count: true, custom_description: '' };
      case 'production_stats':
        return { fazenda_id: selectedFazendaId, visibility: {} };
      case 'service_stats':
        return { user_id: user?.id || '', visibility: {} };
      case 'specialties':
        return { description: '', specialties: [] };
      case 'service_portfolio':
        return { items: portfolioItems };
      case 'fazenda_links':
        return { show_stats: true };
      case 'platform_stats':
        return { visibility: {} };
      case 'feature_showcase':
        return {
          features: [
            { icon: 'dna', title: 'EmbryoScore IA', description: 'Score automatizado de embriões com DINOv2 + Gemini' },
            { icon: 'flask-conical', title: 'Gestão de FIV', description: 'Lotes, aspirações, acasalamentos e embriões' },
            { icon: 'syringe', title: 'Hub de Campo', description: 'Protocolos, TE, DG e sexagem' },
            { icon: 'file-text', title: 'Hub Escritório', description: 'Digitalização de relatórios com OCR' },
            { icon: 'bar-chart-3', title: 'Relatórios', description: 'Produção, KPIs e exportação de dados' },
            { icon: 'store', title: 'Marketplace', description: 'Compra e venda de genética bovina' },
          ],
          layout: 'grid',
        };
    }
  };

  const handleSave = async () => {
    try {
      await upsertSection.mutateAsync({
        id: section?.id,
        section_type: sectionType,
        title: title.trim(),
        content: isEditing && section?.section_type === sectionType
          ? {
              ...section.content,
              ...(sectionType === 'text' ? { body: textBody } : {}),
              ...(sectionType === 'animal_showcase' ? { animals } : {}),
              ...(sectionType === 'photo_gallery' ? { photos } : {}),
              ...(sectionType === 'service_portfolio' ? { items: portfolioItems } : {}),
            }
          : buildContent(),
        sort_order: section?.sort_order ?? nextSortOrder,
        is_public: isPublic,
        fazenda_profile_id: fazendaProfileId,
      });
      toast.success(isEditing ? 'Seção atualizada!' : 'Seção adicionada!');
      onOpenChange(false);
    } catch {
      // handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                  {Object.entries(sectionTypeLabels)
                    .filter(([key]) => {
                      if (key === 'platform_stats' && !isAdmin) return false;
                      return true;
                    })
                    .map(([key, { label, icon }]) => (
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

          {/* Seletor de fazenda para seções que precisam */}
          {(sectionType === 'production_stats' || sectionType === 'fazenda_highlight') && fazendas && fazendas.length > 0 && (
            <div className="space-y-2">
              <Label>Fazenda</Label>
              <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
                <SelectTrigger>
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

          {sectionType === 'animal_showcase' && profile?.cliente_id && (
            <AnimalShowcaseEditor
              animals={animals}
              onChange={setAnimals}
              clienteId={profile.cliente_id}
            />
          )}

          {sectionType === 'photo_gallery' && (
            <PhotoGalleryEditor
              photos={photos}
              onChange={setPhotos}
              sectionId={section?.id}
            />
          )}

          {sectionType === 'service_portfolio' && (
            <ServicePortfolioEditor
              items={portfolioItems}
              onChange={setPortfolioItems}
              sectionId={section?.id}
            />
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
