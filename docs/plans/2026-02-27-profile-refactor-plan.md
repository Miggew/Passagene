# Profile Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o sistema de perfil para suportar dois tipos (Pessoa e Fazenda), remover banner, avatar quadrado para logos, perfis duais (cliente + prestador), stats reais do sistema, e controle granular de visibilidade.

**Architecture:** Evolução incremental do sistema de seções existente (`profile_sections`). Novos `section_type`s para stats, especialidades e portfolio. Nova tabela `fazenda_profiles` com seções compartilhadas via FK em `profile_sections`. RPCs no Supabase para agregar dados reais de produção e serviços.

**Tech Stack:** React 19, TypeScript, Tailwind, Supabase (RLS + RPCs), TanStack Query, shadcn/ui, Lucide icons

**Design Doc:** `docs/plans/2026-02-27-profile-refactor-design.md`

---

## Task 1: SQL — Alterações no banco de dados

**Entregar SQL ao usuário para executar no Supabase Dashboard** (Supabase CLI não executa SQL sem Docker).

**Files:**
- Create: `sql/profile_refactor_migration.sql`

**Step 1: Criar arquivo SQL com todas as alterações**

```sql
-- =============================================
-- Profile Refactor Migration
-- =============================================

-- 1. Novos campos em user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_roles text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specialties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_description text;

-- 2. Nova tabela fazenda_profiles
CREATE TABLE IF NOT EXISTS fazenda_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  foto_url TEXT,
  descricao TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fazenda_id)
);

-- 3. Trigger para slug automático em fazenda_profiles
CREATE OR REPLACE FUNCTION trg_generate_fazenda_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
  fazenda_nome TEXT;
BEGIN
  SELECT nome INTO fazenda_nome FROM fazendas WHERE id = NEW.fazenda_id;
  base_slug := lower(trim(regexp_replace(
    unaccent(coalesce(fazenda_nome, 'fazenda')),
    '[^a-z0-9]+', '-', 'g'
  ), '-'));
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM fazenda_profiles WHERE slug = final_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fazenda_slug ON fazenda_profiles;
CREATE TRIGGER trg_fazenda_slug
  BEFORE INSERT OR UPDATE OF fazenda_id ON fazenda_profiles
  FOR EACH ROW
  WHEN (NEW.slug IS NULL OR NEW.slug = '')
  EXECUTE FUNCTION trg_generate_fazenda_slug();

-- 4. FK opcional em profile_sections para fazenda_profiles
ALTER TABLE profile_sections
  ADD COLUMN IF NOT EXISTS fazenda_profile_id UUID REFERENCES fazenda_profiles(id) ON DELETE CASCADE;

-- 5. RLS para fazenda_profiles
ALTER TABLE fazenda_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own fazenda profiles"
  ON fazenda_profiles FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admin full access fazenda profiles"
  ON fazenda_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin'));

CREATE POLICY "Public fazenda profiles readable"
  ON fazenda_profiles FOR SELECT
  USING (is_public = true);

-- 6. Atualizar RLS de profile_sections para suportar fazenda_profile_id
CREATE POLICY "Fazenda owner can manage fazenda sections"
  ON profile_sections FOR ALL
  USING (
    fazenda_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fazenda_profiles fp
      WHERE fp.id = fazenda_profile_id AND fp.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    fazenda_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fazenda_profiles fp
      WHERE fp.id = fazenda_profile_id AND fp.owner_id = auth.uid()
    )
  );

-- 7. RPC: Stats de produção por fazenda
CREATE OR REPLACE FUNCTION get_fazenda_stats(p_fazenda_id UUID)
RETURNS TABLE(
  total_doadoras BIGINT,
  total_receptoras BIGINT,
  total_embrioes BIGINT,
  total_aspiracoes BIGINT,
  taxa_prenhez NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM doadoras WHERE fazenda_id = p_fazenda_id)::BIGINT AS total_doadoras,
    (SELECT count(*) FROM protocolo_receptoras pr
     JOIN receptoras r ON r.id = pr.receptora_id
     WHERE r.fazenda_id = p_fazenda_id)::BIGINT AS total_receptoras,
    (SELECT count(*) FROM embrioes e
     JOIN aspiracoes_doadoras ad ON ad.id = e.aspiracao_doadoras_id
     JOIN doadoras d ON d.id = ad.doadora_id
     WHERE d.fazenda_id = p_fazenda_id
       AND e.classificacao IN ('A','B','C','BE','BN','BX','BL','BI'))::BIGINT AS total_embrioes,
    (SELECT count(DISTINCT la.id) FROM lotes_aspiracao la
     JOIN aspiracoes_doadoras ad ON ad.lote_aspiracao_id = la.id
     JOIN doadoras d ON d.id = ad.doadora_id
     WHERE d.fazenda_id = p_fazenda_id)::BIGINT AS total_aspiracoes,
    (SELECT CASE
       WHEN count(*) = 0 THEN 0
       ELSE round(
         count(*) FILTER (WHERE dg.resultado IN ('PRENHE', 'PRENHE_RETOQUE'))::NUMERIC
         / count(*)::NUMERIC * 100, 1
       )
     END
     FROM diagnosticos_gestacao dg
     JOIN transferencias_embrioes te ON te.id = dg.transferencia_embriao_id
     JOIN protocolo_receptoras pr ON pr.id = te.protocolo_receptora_id
     JOIN receptoras r ON r.id = pr.receptora_id
     WHERE r.fazenda_id = p_fazenda_id
       AND dg.tipo_diagnostico = 'DG'
    )::NUMERIC AS taxa_prenhez;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Stats do prestador de serviço
CREATE OR REPLACE FUNCTION get_provider_stats(p_user_id UUID)
RETURNS TABLE(
  total_aspiracoes BIGINT,
  total_tes BIGINT,
  total_embrioes BIGINT,
  total_clientes BIGINT,
  taxa_aproveitamento NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(DISTINCT la.id) FROM lotes_aspiracao la
     WHERE la.created_by = p_user_id)::BIGINT AS total_aspiracoes,
    (SELECT count(*) FROM transferencias_embrioes te
     WHERE te.created_by = p_user_id)::BIGINT AS total_tes,
    (SELECT count(*) FROM embrioes e
     JOIN aspiracoes_doadoras ad ON ad.id = e.aspiracao_doadoras_id
     JOIN lotes_aspiracao la ON la.id = ad.lote_aspiracao_id
     WHERE la.created_by = p_user_id
       AND e.classificacao IN ('A','B','C','BE','BN','BX','BL','BI'))::BIGINT AS total_embrioes,
    (SELECT count(DISTINCT c.id) FROM clientes c
     JOIN fazendas f ON f.cliente_id = c.id
     JOIN doadoras d ON d.fazenda_id = f.id
     JOIN aspiracoes_doadoras ad ON ad.doadora_id = d.id
     JOIN lotes_aspiracao la ON la.id = ad.lote_aspiracao_id
     WHERE la.created_by = p_user_id)::BIGINT AS total_clientes,
    (SELECT CASE
       WHEN count(*) = 0 THEN 0
       ELSE round(
         count(*) FILTER (WHERE dg.resultado IN ('PRENHE', 'PRENHE_RETOQUE'))::NUMERIC
         / count(*)::NUMERIC * 100, 1
       )
     END
     FROM diagnosticos_gestacao dg
     JOIN transferencias_embrioes te ON te.id = dg.transferencia_embriao_id
     WHERE te.created_by = p_user_id
       AND dg.tipo_diagnostico = 'DG'
    )::NUMERIC AS taxa_aproveitamento;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Entregar SQL ao usuário**

Apresentar o arquivo `sql/profile_refactor_migration.sql` ao usuário para executar no Supabase Dashboard → SQL Editor.

**Step 3: Commit**

```bash
git add sql/profile_refactor_migration.sql
git commit -m "feat: add profile refactor SQL migration (fazenda_profiles, RPCs, roles)"
```

---

## Task 2: Types — Atualizar tipos TypeScript

**Files:**
- Modify: `src/lib/types.ts` (linhas 18-34 UserProfile, linhas 982-1043 ProfileSection types)

**Step 1: Adicionar novos campos ao UserProfile**

Em `src/lib/types.ts`, adicionar ao `UserProfile` (após linha 33):

```typescript
export interface UserProfile {
  // ... campos existentes ...
  profile_roles?: string[];       // ['cliente', 'prestador']
  specialties?: string[];         // ['FIV', 'IATF', 'TE', ...]
  service_description?: string;   // descrição profissional
}
```

**Step 2: Adicionar interface FazendaProfile**

Após as interfaces existentes de Fazenda (~linha 75):

```typescript
export interface FazendaProfile {
  id: string;
  fazenda_id: string;
  owner_id: string;
  slug?: string;
  foto_url?: string;
  descricao?: string;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined data
  fazenda?: Fazenda;
}
```

**Step 3: Adicionar novos section types**

Atualizar `ProfileSectionType` (linha 982):

```typescript
export type ProfileSectionType =
  | 'text'
  | 'animal_showcase'
  | 'photo_gallery'
  | 'stats'
  | 'fazenda_highlight'
  | 'production_stats'
  | 'service_stats'
  | 'specialties'
  | 'service_portfolio'
  | 'fazenda_links';
```

**Step 4: Adicionar fazenda_profile_id ao ProfileSection**

```typescript
export interface ProfileSection {
  // ... campos existentes ...
  fazenda_profile_id?: string;  // se preenchido, seção pertence a perfil de fazenda
}
```

**Step 5: Adicionar novos content types**

```typescript
export interface ProductionStatsContent {
  fazenda_id: string;
  visibility: Record<string, boolean>; // toggle por métrica
}

export interface ServiceStatsContent {
  visibility: Record<string, boolean>;
}

export interface SpecialtiesContent {
  description: string;
  specialties: string[];
}

export interface ServicePortfolioContent {
  items: Array<{
    foto_url: string;
    caption?: string;
    resultado?: string;
  }>;
}

export interface FazendaLinksContent {
  show_stats?: boolean;
}
```

Atualizar union type `ProfileSectionContent`:

```typescript
export type ProfileSectionContent =
  | TextSectionContent
  | AnimalShowcaseContent
  | PhotoGalleryContent
  | StatsSectionContent
  | FazendaHighlightContent
  | ProductionStatsContent
  | ServiceStatsContent
  | SpecialtiesContent
  | ServicePortfolioContent
  | FazendaLinksContent;
```

**Step 6: Adicionar tipos de stats retornados pelas RPCs**

```typescript
export interface FazendaStats {
  total_doadoras: number;
  total_receptoras: number;
  total_embrioes: number;
  total_aspiracoes: number;
  taxa_prenhez: number;
}

export interface ProviderStats {
  total_aspiracoes: number;
  total_tes: number;
  total_embrioes: number;
  total_clientes: number;
  taxa_aproveitamento: number;
}
```

**Step 7: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Sem erros novos (podem existir warnings pré-existentes)

**Step 8: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add types for profile refactor (FazendaProfile, new section types, stats)"
```

---

## Task 3: Remover Banner e refatorar Avatar

**Files:**
- Delete: `src/components/profile/ProfileBanner.tsx`
- Delete: `src/components/profile/ProfileBannerUpload.tsx`
- Modify: `src/components/profile/ProfileAvatar.tsx`
- Modify: `src/components/profile/ProfileAvatarUpload.tsx`
- Modify: `src/components/profile/ProfilePage.tsx`
- Modify: `src/components/profile/ProfilePublicView.tsx`
- Modify: `src/components/profile/ProfileHeader.tsx`

**Step 1: Refatorar ProfileAvatar.tsx para container quadrado**

Alterar `rounded-full` para `rounded-xl` e `object-cover` para `object-contain`:

```typescript
// ProfileAvatar.tsx — alterações:

// Prop nova: shape
interface ProfileAvatarProps {
  nome?: string;
  avatarPath?: string | null;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';  // NEW — default 'square'
  className?: string;
  onClick?: () => void;
}

// No render: usar shape para decidir rounded
const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
const imgFit = shape === 'circle' ? 'object-cover' : 'object-contain';

// className principal:
cn(
  sizeMap[size],
  shapeClass,
  'overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white select-none',
  !imageUrl && `bg-gradient-to-br ${getGradient(nome)}`,
  imageUrl && 'bg-muted',
  onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all',
  className
)

// img tag:
<img src={imageUrl} alt={nome || 'Avatar'} className={`w-full h-full ${imgFit}`} loading="lazy" />
```

**Step 2: Refatorar ProfileAvatarUpload.tsx**

Alterar overlay de `rounded-full` para respeitar o shape:

```typescript
// ProfileAvatarUpload.tsx — alterações:
// Overlay div: trocar 'rounded-full' por 'rounded-xl'
<div className={cn(
  'absolute inset-0 rounded-xl flex items-center justify-center transition-opacity',
  isLoading ? 'bg-black/40 opacity-100' : 'bg-black/30 opacity-0 group-hover:opacity-100 cursor-pointer'
)} ...>
```

E passar `shape="square"` para `ProfileAvatar`:
```typescript
<ProfileAvatar nome={nome} avatarPath={currentPath} avatarUrl={previewUrl} size="xl" shape="square" ... />
```

**Step 3: Refatorar ProfileHeader.tsx com avatar inline e badges de role**

Reescrever o header para incluir avatar + badges de role:

```typescript
// ProfileHeader.tsx — novo layout
import { MapPin, Pencil, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProfileAvatar from './ProfileAvatar';
import ProfileAvatarUpload from './ProfileAvatarUpload';
import type { UserProfile } from '@/lib/types';

interface ProfileHeaderProps {
  profile: Pick<UserProfile, 'nome' | 'bio' | 'localizacao' | 'user_type' | 'avatar_url' | 'profile_roles' | 'telefone'>;
  isOwner: boolean;
  onEdit?: () => void;
}

function getRoleBadges(profile: ProfileHeaderProps['profile']) {
  const roles = profile.profile_roles?.length
    ? profile.profile_roles
    : [profile.user_type === 'cliente' ? 'cliente' : 'prestador'];

  return roles.map(role => ({
    key: role,
    label: role === 'cliente' ? 'Produtor' : role === 'prestador' ? 'Prestador de Serviço' : 'Admin',
    variant: role === 'cliente' ? 'secondary' : 'outline',
  }));
}

export default function ProfileHeader({ profile, isOwner, onEdit }: ProfileHeaderProps) {
  return (
    <div className="px-4 md:px-6">
      <div className="flex items-start gap-4">
        {/* Avatar/Logo */}
        <div className="shrink-0">
          {isOwner ? (
            <ProfileAvatarUpload nome={profile.nome} currentPath={profile.avatar_url} />
          ) : (
            <ProfileAvatar nome={profile.nome} avatarPath={profile.avatar_url} size="xl" shape="square" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight truncate">
              {profile.nome}
            </h1>
            {isOwner && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar
              </Button>
            )}
          </div>

          {/* Role badges */}
          <div className="flex flex-wrap gap-1.5">
            {getRoleBadges(profile).map(b => (
              <Badge key={b.key} variant={b.variant as any} className="text-[11px]">
                {b.label}
              </Badge>
            ))}
          </div>

          {profile.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-1">
              {profile.bio}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
            {profile.localizacao && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.localizacao}
              </span>
            )}
            {profile.telefone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {profile.telefone}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Atualizar ProfilePage.tsx — remover banner, usar novo header**

Remover import do `ProfileBannerUpload` (linha 14).
Remover import do `ProfileAvatarUpload` (linha 15) — agora está dentro do ProfileHeader.
Remover bloco `{/* Banner + Avatar */}` (linhas 110-120).
Remover `pt-8` do ProfileHeader (já não tem offset do banner).

```typescript
// ProfilePage.tsx — alterações:
// 1. Remover import: ProfileBannerUpload (linha 14)
// 2. Remover import: ProfileAvatarUpload (linha 15)
// 3. Remover linhas 110-120 (banner + avatar overlay)
// 4. Passar avatar_url e profile_roles ao ProfileHeader:
<ProfileHeader
  profile={profile}
  isOwner={true}
  onEdit={() => setEditDrawerOpen(true)}
/>
```

O layout fica:
```
ProfileHeader (com avatar inline)
  ↓
Hub shortcuts
  ↓
Sections
  ↓
Anuncios
  ↓
Add section button
```

**Step 5: Atualizar ProfilePublicView.tsx — remover banner**

Remover import do `ProfileBanner` (linha 9).
Remover linhas 44-49 (render do `ProfileBanner`).
Passar `avatar_url` ao ProfileHeader.

```typescript
// ProfilePublicView.tsx — alterações:
// 1. Remover import: ProfileBanner (linha 9)
// 2. Importar ProfileAvatar (para mostrar no header)
// 3. Remover linhas 44-49 (ProfileBanner render)
// 4. usePublicProfile query: adicionar 'profile_roles', 'telefone' ao select
// 5. Passar dados completos ao ProfileHeader
```

**Step 6: Deletar arquivos de banner**

```bash
rm src/components/profile/ProfileBanner.tsx
rm src/components/profile/ProfileBannerUpload.tsx
```

**Step 7: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Sem erros

**Step 8: Verificar visualmente no browser**

Run: `npm run dev`
- Abrir `/` → perfil deve mostrar avatar quadrado + nome + badges, sem banner
- Abrir `/perfil/:slug` → mesmo layout sem banner

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: remove banner, refactor avatar to square container, add role badges to header"
```

---

## Task 4: Hooks — Fazenda Profile e Stats

**Files:**
- Create: `src/hooks/useFazendaProfile.ts`
- Modify: `src/hooks/useProfile.ts`

**Step 1: Criar useFazendaProfile.ts**

```typescript
/**
 * Hooks para Perfil de Fazenda
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';
import type { FazendaProfile, FazendaStats, ProviderStats } from '@/lib/types';

/** Perfil da fazenda por slug (público) */
export function useFazendaProfileBySlug(slug: string | null) {
  return useQuery({
    queryKey: ['fazenda-profile', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('fazenda_profiles')
        .select('*, fazenda:fazendas(*)')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (error) throw error;
      return data as (FazendaProfile & { fazenda: any }) | null;
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}

/** Perfis de fazenda do usuário logado (via cliente_id) */
export function useMyFazendaProfiles(clienteId: string | null) {
  return useQuery({
    queryKey: ['my-fazenda-profiles', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      // Buscar fazendas do cliente
      const { data: fazendas, error: fErr } = await supabase
        .from('fazendas')
        .select('id, nome, sigla, localizacao')
        .eq('cliente_id', clienteId);
      if (fErr) throw fErr;
      if (!fazendas?.length) return [];

      // Buscar perfis existentes
      const fazendaIds = fazendas.map(f => f.id);
      const { data: profiles, error: pErr } = await supabase
        .from('fazenda_profiles')
        .select('*')
        .in('fazenda_id', fazendaIds);
      if (pErr) throw pErr;

      // Merge: fazenda + perfil (se existir)
      return fazendas.map(f => ({
        fazenda: f,
        profile: (profiles || []).find(p => p.fazenda_id === f.id) as FazendaProfile | undefined,
      }));
    },
    enabled: !!clienteId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Criar ou atualizar perfil de fazenda */
export function useUpsertFazendaProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      id?: string;
      fazenda_id: string;
      descricao?: string;
      foto_url?: string;
      is_public?: boolean;
    }) => {
      if (!user) throw new Error('Não autenticado');

      if (data.id) {
        const { data: result, error } = await supabase
          .from('fazenda_profiles')
          .update({
            descricao: data.descricao,
            foto_url: data.foto_url,
            is_public: data.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)
          .eq('owner_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return result as FazendaProfile;
      } else {
        const { data: result, error } = await supabase
          .from('fazenda_profiles')
          .insert({
            fazenda_id: data.fazenda_id,
            owner_id: user.id,
            descricao: data.descricao,
            foto_url: data.foto_url,
            is_public: data.is_public ?? true,
          })
          .select()
          .single();
        if (error) throw error;
        return result as FazendaProfile;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-fazenda-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fazenda-profile'] });
    },
    onError: (error) => handleError(error, 'Erro ao salvar perfil da fazenda'),
  });
}

/** Stats de produção por fazenda (RPC) */
export function useFazendaStats(fazendaId: string | null) {
  return useQuery({
    queryKey: ['fazenda-stats', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return null;
      const { data, error } = await supabase.rpc('get_fazenda_stats', {
        p_fazenda_id: fazendaId,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as FazendaStats | null;
    },
    enabled: !!fazendaId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Stats do prestador de serviço (RPC) */
export function useProviderStats(userId: string | null) {
  return useQuery({
    queryKey: ['provider-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('get_provider_stats', {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data?.[0] ?? null) as ProviderStats | null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Step 2: Atualizar useProfile.ts — suportar fazenda_profile_id nas seções**

Em `useProfileSections`, adicionar overload para fazenda:

```typescript
/** Listar seções de um perfil de fazenda */
export function useFazendaSections(fazendaProfileId: string | null, publicOnly = false) {
  return useQuery({
    queryKey: ['fazenda-sections', fazendaProfileId, publicOnly],
    queryFn: async () => {
      if (!fazendaProfileId) return [];

      let query = supabase
        .from('profile_sections')
        .select('*')
        .eq('fazenda_profile_id', fazendaProfileId)
        .eq('active', true)
        .order('sort_order');

      if (publicOnly) {
        query = query.eq('is_public', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProfileSection[];
    },
    enabled: !!fazendaProfileId,
    staleTime: 2 * 60 * 1000,
  });
}
```

Em `useUpsertSection`, adicionar suporte ao `fazenda_profile_id`:

```typescript
// No mutationFn, aceitar fazenda_profile_id opcional:
mutationFn: async (section: {
  id?: string;
  section_type: ProfileSection['section_type'];
  title: string;
  content: ProfileSectionContent;
  sort_order?: number;
  is_public?: boolean;
  fazenda_profile_id?: string;  // NEW
}) => {
  // No insert, incluir fazenda_profile_id:
  // Se fazenda_profile_id preenchido, user_id pode ser null
}
```

**Step 3: Atualizar usePublicProfile — adicionar profile_roles e telefone ao select**

```typescript
// usePublicProfile — adicionar ao select:
.select('id, nome, bio, avatar_url, banner_url, profile_slug, profile_public, localizacao, user_type, cliente_id, profile_roles, telefone, specialties, service_description')
```

**Step 4: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/hooks/useFazendaProfile.ts src/hooks/useProfile.ts
git commit -m "feat: add fazenda profile hooks, stats RPCs, fazenda sections support"
```

---

## Task 5: Novos componentes de seção — Stats de Produção

**Files:**
- Create: `src/components/profile/sections/ProductionStatsSection.tsx`
- Create: `src/components/profile/sections/StatsVisibilityConfig.tsx`

**Step 1: Criar StatsVisibilityConfig.tsx**

Componente reutilizável para toggles de visibilidade por métrica:

```typescript
/**
 * Dialog de configuração de visibilidade por métrica.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  useEffect(() => { setLocal(visibility); }, [visibility, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Visibilidade das Estatísticas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {metrics.map(m => (
            <div key={m.key} className="flex items-center justify-between">
              <Label>{m.label}</Label>
              <Switch
                checked={local[m.key] !== false}
                onCheckedChange={v => setLocal(prev => ({ ...prev, [m.key]: v }))}
              />
            </div>
          ))}
          <Button className="w-full" onClick={() => { onSave(local); onOpenChange(false); }}>
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Criar ProductionStatsSection.tsx**

```typescript
/**
 * Stats de produção reais por fazenda — dados do sistema.
 */
import { Heart, Baby, Dna, FlaskConical, TrendingUp } from 'lucide-react';
import { useFazendaStats } from '@/hooks/useFazendaProfile';
import type { ProductionStatsContent } from '@/lib/types';

interface ProductionStatsSectionProps {
  content: ProductionStatsContent;
}

const METRICS = [
  { key: 'total_doadoras', label: 'Doadoras', icon: Heart, color: 'text-pink-500' },
  { key: 'total_receptoras', label: 'Receptoras', icon: Baby, color: 'text-violet-500' },
  { key: 'total_embrioes', label: 'Embriões', icon: Dna, color: 'text-primary-500' },
  { key: 'total_aspiracoes', label: 'Aspirações', icon: FlaskConical, color: 'text-amber-500' },
  { key: 'taxa_prenhez', label: 'Taxa Prenhez', icon: TrendingUp, color: 'text-emerald-500', suffix: '%' },
];

export default function ProductionStatsSection({ content }: ProductionStatsSectionProps) {
  const { data: stats, isLoading } = useFazendaStats(content.fazenda_id);
  const visibility = content.visibility || {};

  const visibleMetrics = METRICS.filter(m => visibility[m.key] !== false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats || visibleMetrics.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem estatísticas disponíveis.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visibleMetrics.map(m => {
        const Icon = m.icon;
        const value = stats[m.key as keyof typeof stats];
        return (
          <div key={m.key} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <div className="flex justify-center mb-1">
              <Icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <p className="text-lg font-extrabold text-foreground">
              {value != null ? `${value}${m.suffix || ''}` : '--'}
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {m.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/profile/sections/ProductionStatsSection.tsx src/components/profile/sections/StatsVisibilityConfig.tsx
git commit -m "feat: add ProductionStatsSection with real system data and visibility config"
```

---

## Task 6: Novos componentes de seção — Prestador de Serviço

**Files:**
- Create: `src/components/profile/sections/ServiceStatsSection.tsx`
- Create: `src/components/profile/sections/SpecialtiesSection.tsx`
- Create: `src/components/profile/sections/ServicePortfolioSection.tsx`

**Step 1: Criar ServiceStatsSection.tsx**

Similar ao ProductionStatsSection mas usando `useProviderStats`:

```typescript
import { FlaskConical, Dna, Users, TrendingUp, Syringe } from 'lucide-react';
import { useProviderStats } from '@/hooks/useFazendaProfile';
import type { ServiceStatsContent } from '@/lib/types';

const METRICS = [
  { key: 'total_aspiracoes', label: 'Aspirações', icon: FlaskConical, color: 'text-amber-500' },
  { key: 'total_tes', label: 'Transferências', icon: Syringe, color: 'text-blue-500' },
  { key: 'total_embrioes', label: 'Embriões', icon: Dna, color: 'text-primary-500' },
  { key: 'total_clientes', label: 'Clientes', icon: Users, color: 'text-violet-500' },
  { key: 'taxa_aproveitamento', label: 'Aproveitamento', icon: TrendingUp, color: 'text-emerald-500', suffix: '%' },
];

// Mesma estrutura do ProductionStatsSection, trocando useFazendaStats por useProviderStats
// e usando o userId do owner do perfil como parâmetro
```

**Step 2: Criar SpecialtiesSection.tsx**

```typescript
import { Badge } from '@/components/ui/badge';
import type { SpecialtiesContent } from '@/lib/types';

interface SpecialtiesSectionProps {
  content: SpecialtiesContent;
}

export default function SpecialtiesSection({ content }: SpecialtiesSectionProps) {
  return (
    <div className="space-y-3">
      {content.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{content.description}</p>
      )}
      {content.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {content.specialties.map(s => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Criar ServicePortfolioSection.tsx**

```typescript
import { useProfileUrl } from '@/hooks/useStorageUrl';
import type { ServicePortfolioContent } from '@/lib/types';

interface ServicePortfolioSectionProps {
  content: ServicePortfolioContent;
}

export default function ServicePortfolioSection({ content }: ServicePortfolioSectionProps) {
  if (!content.items?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum trabalho adicionado ainda.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {content.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="aspect-square bg-muted">
            <img src={item.foto_url} alt={item.caption || ''} className="w-full h-full object-cover" loading="lazy" />
          </div>
          {(item.caption || item.resultado) && (
            <div className="p-2">
              {item.caption && <p className="text-xs text-foreground font-medium line-clamp-2">{item.caption}</p>}
              {item.resultado && <p className="text-[11px] text-muted-foreground mt-0.5">{item.resultado}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/profile/sections/ServiceStatsSection.tsx src/components/profile/sections/SpecialtiesSection.tsx src/components/profile/sections/ServicePortfolioSection.tsx
git commit -m "feat: add service provider section components (stats, specialties, portfolio)"
```

---

## Task 7: Fazenda Links Section + Atualizar Dispatcher

**Files:**
- Create: `src/components/profile/sections/FazendaLinksSection.tsx`
- Modify: `src/components/profile/ProfileSectionCard.tsx`
- Modify: `src/components/profile/ProfileSectionEditor.tsx`

**Step 1: Criar FazendaLinksSection.tsx**

Cards de fazendas no perfil da pessoa, linkando para `/fazenda/:slug`:

```typescript
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { useMyFazendaProfiles, useFazendaStats } from '@/hooks/useFazendaProfile';
import type { FazendaLinksContent } from '@/lib/types';

interface FazendaLinksSectionProps {
  content: FazendaLinksContent;
  clienteId?: string;
}

function FazendaCard({ fazenda, profile, showStats }: { fazenda: any; profile: any; showStats: boolean }) {
  const navigate = useNavigate();
  const { data: stats } = useFazendaStats(showStats ? fazenda.id : null);
  const slug = profile?.slug;

  return (
    <button
      onClick={() => slug && navigate(`/fazenda/${slug}`)}
      className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/50 transition-all group"
    >
      <h4 className="text-sm font-bold text-foreground truncate">{fazenda.nome}</h4>
      {fazenda.localizacao && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="w-3 h-3" />
          {fazenda.localizacao}
        </p>
      )}
      {showStats && stats && (
        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
          <div><p className="text-sm font-bold">{stats.total_doadoras}</p><p className="text-[10px] text-muted-foreground">Doadoras</p></div>
          <div><p className="text-sm font-bold">{stats.total_embrioes}</p><p className="text-[10px] text-muted-foreground">Embriões</p></div>
        </div>
      )}
      {slug && (
        <div className="flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Ver perfil <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

export default function FazendaLinksSection({ content, clienteId }: FazendaLinksSectionProps) {
  const { data: fazendaProfiles = [] } = useMyFazendaProfiles(clienteId ?? null);

  if (!fazendaProfiles.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma fazenda cadastrada.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fazendaProfiles.map(({ fazenda, profile }) => (
        <FazendaCard
          key={fazenda.id}
          fazenda={fazenda}
          profile={profile}
          showStats={content.show_stats !== false}
        />
      ))}
    </div>
  );
}
```

**Step 2: Atualizar ProfileSectionCard.tsx — adicionar novos tipos**

Adicionar imports e cases para os novos section types:

```typescript
// Novos imports:
import ProductionStatsSection from './sections/ProductionStatsSection';
import ServiceStatsSection from './sections/ServiceStatsSection';
import SpecialtiesSection from './sections/SpecialtiesSection';
import ServicePortfolioSection from './sections/ServicePortfolioSection';
import FazendaLinksSection from './sections/FazendaLinksSection';

// Novos cases no render (após os existentes):
{section.section_type === 'production_stats' && (
  <ProductionStatsSection content={content as any} />
)}
{section.section_type === 'service_stats' && (
  <ServiceStatsSection content={content as any} userId={section.user_id} />
)}
{section.section_type === 'specialties' && (
  <SpecialtiesSection content={content as any} />
)}
{section.section_type === 'service_portfolio' && (
  <ServicePortfolioSection content={content as any} />
)}
{section.section_type === 'fazenda_links' && (
  <FazendaLinksSection content={content as any} />
)}
```

**Step 3: Atualizar ProfileSectionEditor.tsx — novos tipos no select**

Adicionar labels e ícones para os novos tipos, e seus respectivos `buildContent` defaults:

```typescript
// Novos imports de ícones:
import { Briefcase, Award, FolderOpen, Building2 } from 'lucide-react';

// Adicionar ao sectionTypeLabels:
production_stats: { label: 'Stats de Produção', icon: <BarChart3 className="w-4 h-4" /> },
service_stats: { label: 'Stats de Serviços', icon: <Briefcase className="w-4 h-4" /> },
specialties: { label: 'Especialidades', icon: <Award className="w-4 h-4" /> },
service_portfolio: { label: 'Portfolio', icon: <FolderOpen className="w-4 h-4" /> },
fazenda_links: { label: 'Minhas Fazendas', icon: <Building2 className="w-4 h-4" /> },

// Adicionar ao buildContent():
case 'production_stats':
  return { fazenda_id: '', visibility: {} };
case 'service_stats':
  return { visibility: {} };
case 'specialties':
  return { description: '', specialties: [] };
case 'service_portfolio':
  return { items: [] };
case 'fazenda_links':
  return { show_stats: true };
```

**Step 4: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add fazenda links section, update dispatcher and editor with new section types"
```

---

## Task 8: Perfil de Fazenda — Página e Rota

**Files:**
- Create: `src/components/profile/FazendaProfilePage.tsx`
- Create: `src/components/profile/FazendaProfileHeader.tsx`
- Create: `src/pages/FazendaProfile.tsx`
- Modify: `src/App.tsx`

**Step 1: Criar FazendaProfileHeader.tsx**

```typescript
/**
 * Header do perfil de fazenda — foto, nome, localidade, dono.
 */
import { MapPin, Pencil, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ProfileAvatar from './ProfileAvatar';
import type { FazendaProfile, Fazenda } from '@/lib/types';

interface FazendaProfileHeaderProps {
  fazendaProfile: FazendaProfile;
  fazenda: Fazenda;
  ownerName?: string;
  ownerSlug?: string;
  isOwner: boolean;
  onEdit?: () => void;
}

export default function FazendaProfileHeader({
  fazendaProfile, fazenda, ownerName, ownerSlug, isOwner, onEdit,
}: FazendaProfileHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ProfileAvatar
            nome={fazenda.nome}
            avatarPath={fazendaProfile.foto_url}
            size="xl"
            shape="square"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight truncate">
              {fazenda.nome}
            </h1>
            {isOwner && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar
              </Button>
            )}
          </div>

          {fazenda.localizacao && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{fazenda.localizacao}</span>
            </div>
          )}

          {fazendaProfile.descricao && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mt-1">
              {fazendaProfile.descricao}
            </p>
          )}

          {ownerName && (
            <button
              onClick={() => ownerSlug && navigate(`/perfil/${ownerSlug}`)}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              {ownerName}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Criar FazendaProfilePage.tsx**

Página completa do perfil de fazenda com seções:

```typescript
/**
 * Página do perfil público de uma fazenda.
 */
import { useParams } from 'react-router-dom';
import { useFazendaProfileBySlug } from '@/hooks/useFazendaProfile';
import { useFazendaSections } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import FazendaProfileHeader from './FazendaProfileHeader';
import ProfileSectionsView from './ProfileSectionsView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function FazendaProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: profileData, isLoading: profileLoading } = useFazendaProfileBySlug(slug ?? null);
  const { data: sections = [], isLoading: sectionsLoading } = useFazendaSections(
    profileData?.id ?? null,
    user?.id !== profileData?.owner_id // publicOnly se não é dono
  );

  const isOwner = user?.id === profileData?.owner_id;

  if (profileLoading || sectionsLoading) return <LoadingSpinner />;

  if (!profileData) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-foreground">Fazenda não encontrada</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Este perfil não existe ou é privado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <FazendaProfileHeader
        fazendaProfile={profileData}
        fazenda={profileData.fazenda}
        isOwner={isOwner}
      />

      <ProfileSectionsView
        sections={sections}
        isOwner={isOwner}
      />

      {sections.length === 0 && (
        <div className="px-4 md:px-6">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Este perfil de fazenda ainda não tem seções.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Criar página wrapper src/pages/FazendaProfile.tsx**

```typescript
import FazendaProfilePage from '@/components/profile/FazendaProfilePage';

export default function FazendaProfile() {
  return <FazendaProfilePage />;
}
```

**Step 4: Adicionar rota em App.tsx**

Após a rota `/perfil/:slug` (linha 186), adicionar:

```typescript
const FazendaProfile = lazy(() => import('./pages/FazendaProfile'));

// Na seção de rotas:
<Route path="/fazenda/:slug" element={<FazendaProfile />} />
```

**Step 5: Verificar compilação**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add fazenda profile page with public URL (/fazenda/:slug)"
```

---

## Task 9: Profile Edit Drawer — Suporte a Roles e Especialidades

**Files:**
- Modify: `src/components/profile/ProfileEditDrawer.tsx`
- Modify: `src/hooks/useProfile.ts` (useUpdateProfile mutation)

**Step 1: Atualizar useUpdateProfile para aceitar novos campos**

Em `useProfile.ts`, atualizar o tipo aceito pelo `mutationFn`:

```typescript
mutationFn: async (updates: Partial<Pick<UserProfile,
  'nome' | 'bio' | 'avatar_url' | 'banner_url' | 'profile_slug' | 'profile_public' | 'telefone' | 'localizacao'
  | 'profile_roles' | 'specialties' | 'service_description'  // NOVOS
>>) => { ... }
```

**Step 2: Atualizar ProfileEditDrawer.tsx**

Adicionar campos para `profile_roles` (checkboxes), `specialties` (tags input), e `service_description` (textarea):

```typescript
// Novos campos no state do form:
const [form, setForm] = useState({
  nome: '',
  bio: '',
  telefone: '',
  localizacao: '',
  profile_slug: '',
  profile_public: true,
  profile_roles: [] as string[],        // NEW
  specialties: [] as string[],           // NEW
  service_description: '',               // NEW
});

// No useEffect sync:
profile_roles: profile.profile_roles || [],
specialties: profile.specialties || [],
service_description: profile.service_description || '',

// No handleSave:
profile_roles: form.profile_roles,
specialties: form.specialties.filter(Boolean),
service_description: form.service_description.trim() || undefined,

// Novos campos no JSX (após Localização, antes do Slug):

{/* Roles */}
<div className="space-y-2">
  <Label>Tipo de perfil</Label>
  <div className="space-y-2">
    {[
      { value: 'cliente', label: 'Produtor / Cliente' },
      { value: 'prestador', label: 'Prestador de Serviço' },
    ].map(role => (
      <label key={role.value} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.profile_roles.includes(role.value)}
          onChange={(e) => {
            const roles = e.target.checked
              ? [...form.profile_roles, role.value]
              : form.profile_roles.filter(r => r !== role.value);
            setForm(f => ({ ...f, profile_roles: roles }));
          }}
          className="rounded border-border"
        />
        <span className="text-sm">{role.label}</span>
      </label>
    ))}
  </div>
</div>

{/* Especialidades (só se prestador) */}
{form.profile_roles.includes('prestador') && (
  <>
    <div className="space-y-2">
      <Label>Descrição profissional</Label>
      <Textarea
        value={form.service_description}
        onChange={(e) => setForm(f => ({ ...f, service_description: e.target.value }))}
        placeholder="Descreva sua experiência e serviços..."
        rows={3}
      />
    </div>
    <div className="space-y-2">
      <Label>Especialidades</Label>
      {/* Tags input com sugestões pré-definidas */}
      <div className="flex flex-wrap gap-1.5">
        {SPECIALTY_OPTIONS.map(s => (
          <Badge
            key={s}
            variant={form.specialties.includes(s) ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
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
```

Constante com especialidades pré-definidas:
```typescript
const SPECIALTY_OPTIONS = [
  'FIV', 'IATF', 'TE', 'Aspiração', 'Sexagem',
  'Ultrassonografia', 'Ginecologia', 'Andrologia',
  'Nutrição', 'Genética', 'Consultoria',
];
```

**Step 3: Verificar compilação e testar visualmente**

Run: `npx tsc --noEmit 2>&1 | head -20`
Run: `npm run dev` → Abrir perfil → Editar → verificar campos de role e especialidades

**Step 4: Commit**

```bash
git add src/components/profile/ProfileEditDrawer.tsx src/hooks/useProfile.ts
git commit -m "feat: add profile roles, specialties, and service description to edit drawer"
```

---

## Task 10: Verificação final e cleanup

**Step 1: Verificar todos os imports não utilizados**

Run: `npx tsc --noEmit 2>&1 | grep -i "unused\|not used"`

**Step 2: Verificar build de produção**

Run: `npm run build 2>&1 | tail -20`
Expected: Build sem erros

**Step 3: Testar fluxo completo no browser**

- `/` → perfil pessoal sem banner, avatar quadrado, badges
- Editar perfil → selecionar roles, adicionar especialidades
- Adicionar seção "Stats de Produção" → verificar dados reais
- Adicionar seção "Minhas Fazendas" → cards com stats
- `/fazenda/:slug` → perfil da fazenda com seções
- `/perfil/:slug` → perfil público sem banner

**Step 4: Commit final**

```bash
git add -A
git commit -m "chore: profile refactor cleanup and verification"
```
