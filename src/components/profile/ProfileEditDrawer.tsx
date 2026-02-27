/**
 * Sheet/Drawer para editar informações do perfil.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useUpdateProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import type { UserProfile } from '@/lib/types';

const SPECIALTY_OPTIONS = [
  'FIV', 'IATF', 'TE', 'Aspiração', 'Sexagem',
  'Ultrassonografia', 'Ginecologia', 'Andrologia',
  'Nutrição', 'Genética', 'Consultoria',
];

interface ProfileEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
}

export default function ProfileEditDrawer({ open, onOpenChange, profile }: ProfileEditDrawerProps) {
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState({
    nome: '',
    bio: '',
    telefone: '',
    localizacao: '',
    profile_slug: '',
    profile_public: true,
    profile_roles: [] as string[],
    specialties: [] as string[],
    service_description: '',
  });

  // Sync form when profile changes
  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome || '',
        bio: profile.bio || '',
        telefone: profile.telefone || '',
        localizacao: profile.localizacao || '',
        profile_slug: profile.profile_slug || '',
        profile_public: profile.profile_public ?? true,
        profile_roles: profile.profile_roles || [],
        specialties: profile.specialties || [],
        service_description: profile.service_description || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        nome: form.nome.trim(),
        bio: form.bio.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        localizacao: form.localizacao.trim() || undefined,
        profile_slug: form.profile_slug.trim() || undefined,
        profile_public: form.profile_public,
        profile_roles: form.profile_roles,
        specialties: form.specialties.filter(Boolean),
        service_description: form.service_description.trim() || undefined,
      });
      toast.success('Perfil atualizado!');
      onOpenChange(false);
    } catch {
      // handleError já tratado no hook
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Perfil</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="profile-nome">Nome</Label>
            <Input
              id="profile-nome"
              value={form.nome}
              onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Seu nome"
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              id="profile-bio"
              value={form.bio}
              onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Conte um pouco sobre você..."
              rows={3}
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="profile-telefone">Telefone</Label>
            <Input
              id="profile-telefone"
              value={form.telefone}
              onChange={(e) => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Localização */}
          <div className="space-y-2">
            <Label htmlFor="profile-localizacao">Localização</Label>
            <Input
              id="profile-localizacao"
              value={form.localizacao}
              onChange={(e) => setForm(f => ({ ...f, localizacao: e.target.value }))}
              placeholder="Cidade, Estado"
            />
          </div>

          {/* Tipo de perfil */}
          <div className="space-y-2">
            <Label>Tipo de perfil</Label>
            <p className="text-xs text-muted-foreground">Selecione como você atua</p>
            <div className="space-y-2">
              {[
                { value: 'cliente', label: 'Produtor / Cliente' },
                { value: 'prestador', label: 'Prestador de Serviço' },
              ].map(role => (
                <label key={role.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.profile_roles.includes(role.value)}
                    onChange={(e) => {
                      const roles = e.target.checked
                        ? [...form.profile_roles, role.value]
                        : form.profile_roles.filter(r => r !== role.value);
                      setForm(f => ({ ...f, profile_roles: roles }));
                    }}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          {form.profile_roles.includes('prestador') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="profile-service-desc">Descrição profissional</Label>
                <Textarea
                  id="profile-service-desc"
                  value={form.service_description}
                  onChange={(e) => setForm(f => ({ ...f, service_description: e.target.value }))}
                  placeholder="Descreva sua experiência e serviços..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Especialidades</Label>
                <p className="text-xs text-muted-foreground">Toque para selecionar/deselecionar</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_OPTIONS.map(s => (
                    <Badge
                      key={s}
                      variant={form.specialties.includes(s) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs transition-colors"
                      onClick={() => {
                        const specs = form.specialties.includes(s)
                          ? form.specialties.filter(x => x !== s)
                          : [...form.specialties, s];
                        setForm(f => ({ ...f, specialties: specs }));
                      }}
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="profile-slug">Link do Perfil</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground shrink-0">/perfil/</span>
              <Input
                id="profile-slug"
                value={form.profile_slug}
                onChange={(e) => setForm(f => ({
                  ...f,
                  profile_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                }))}
                placeholder="seu-nome"
                className="font-mono text-sm"
              />
            </div>
          </div>

          {/* Público */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Perfil público</Label>
              <p className="text-xs text-muted-foreground">
                Outros usuários podem ver seu perfil
              </p>
            </div>
            <Switch
              checked={form.profile_public}
              onCheckedChange={(v) => setForm(f => ({ ...f, profile_public: v }))}
            />
          </div>

          {/* Salvar */}
          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending || !form.nome.trim()}
            className="w-full"
          >
            {updateProfile.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar alterações'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
