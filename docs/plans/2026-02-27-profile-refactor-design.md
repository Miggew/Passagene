# Refatoração do Perfil — Design Doc

**Data:** 2026-02-27
**Status:** Aprovado

---

## Resumo

Separar o sistema de perfil em dois tipos: **Perfil de Pessoa** e **Perfil de Fazenda**. Remover o banner, reformatar o avatar para container quadrado (suporte a logos), adicionar suporte a perfis duais (cliente + prestador), e implementar controle granular de visibilidade por métrica.

---

## Decisões Tomadas

| Decisão | Escolha |
|---|---|
| Perfil dual (cliente + prestador) | Tudo numa página só, separado por seções |
| Banner | Eliminado completamente |
| Avatar/Logo | Container quadrado com `object-contain`, `rounded-xl` |
| Estatísticas | Dados reais do sistema, puxados automaticamente |
| Privacidade | Controle granular por métrica/seção |
| Perfil de prestador | Portfolio completo (stats + especialidades + galeria) |
| Fazendas no perfil | Cards de fazenda com stats, linkando para perfil próprio |
| Perfil de fazenda | URL própria (`/fazenda/:slug`), seções customizáveis |
| Permissões fazenda | Dono (cliente) + admin |
| Abordagem técnica | Incremental — evoluir o sistema de seções existente |

---

## Arquitetura

### Dois Tipos de Perfil

```
Perfil de Pessoa (/perfil/:slug)
├── Header: logo quadrado, nome, bio, badges [Cliente] [Prestador]
├── Seções customizáveis:
│   ├── Fazendas (cards linkando para /fazenda/:slug)
│   ├── Especialidades & Descrição (prestador)
│   ├── Stats de serviços (prestador)
│   ├── Portfolio (prestador)
│   ├── Texto livre, galeria, showcase de animais
│   └── Anúncios (marketplace)
└── Controle granular de visibilidade

Perfil de Fazenda (/fazenda/:slug)
├── Header: foto/logo da fazenda, nome, localidade, link ao dono
├── Seções customizáveis:
│   ├── Stats de produção (dados reais do sistema)
│   ├── Galeria de fotos
│   ├── Showcase de doadoras/touros
│   ├── Texto livre
│   └── Localização (opcional)
└── Gerenciado por: dono (cliente) + admin
```

---

## Layout — Perfil de Pessoa

### Header (sem banner)

```
┌──────────────────────────────────────────────────┐
│  ┌────────┐                                      │
│  │        │  Nome do Usuário / Empresa            │
│  │  LOGO  │  📍 Localização                       │
│  │        │  [Cliente] [Prestador]  ← badges      │
│  └────────┘  Bio curta (2 linhas max)             │
│              📞 Telefone  ✏️ Editar               │
└──────────────────────────────────────────────────┘
```

- Logo/Avatar: `rounded-xl`, `w-20 h-20` mobile, `w-28 h-28` desktop
- `object-contain` para logos, `object-cover` para fotos
- Fundo `bg-muted` para imagens com transparência
- Upload: clique no logo, ícone sutil de edição no canto inferior

### Seções de Produtor (role: cliente)

**Fazenda Cards:**
```
┌─────────────────────┐  ┌─────────────────────┐
│  📷 Foto fazenda     │  │  📷 Foto fazenda     │
│  ─────────────────── │  │  ─────────────────── │
│  Fazenda São José    │  │  Fazenda Boa Vista   │
│  📍 Uberaba - MG     │  │  📍 Araguaína - TO   │
│  🐄 45 doadoras      │  │  🐄 22 doadoras      │
│  🧬 312 embriões     │  │  🧬 156 embriões     │
│  📊 68% prenhez      │  │  📊 72% prenhez      │
│  [Ver perfil →]      │  │  [Ver perfil →]      │
└─────────────────────┘  └─────────────────────┘
```

### Seções de Prestador (role: prestador)

**Especialidades & Descrição:**
- Texto livre para descrição profissional
- Tags de especialidade (lista pré-definida + custom): FIV, IATF, TE, Aspiração, Sexagem, etc.

**Stats de Serviços:**
- Calculadas do sistema: aspirações, TEs, embriões, clientes atendidos, taxa aproveitamento
- Toggle granular por métrica

**Portfolio:**
- Galeria de trabalhos com legenda
- Resultados notáveis

---

## Layout — Perfil de Fazenda

### Header

```
┌──────────────────────────────────────────────────┐
│  ┌────────┐                                      │
│  │  FOTO  │  Fazenda São José                    │
│  │ FAZENDA│  📍 Uberaba - MG                     │
│  │        │  Dono: João Silva → link perfil       │
│  └────────┘  ✏️ Editar (se dono/admin)            │
└──────────────────────────────────────────────────┘
```

### Seções customizáveis (mesmo sistema do perfil de pessoa)
- Stats de produção (dados reais)
- Galeria de fotos
- Showcase de animais
- Texto livre
- Todas com controle de visibilidade

---

## Controle de Privacidade

```
┌──────────────────────────────────────────────┐
│  ⚙️ Visibilidade das Estatísticas            │
│  ──────────────────────────────────────────── │
│  👁 Total de doadoras          [████ ON ]     │
│  👁 Embriões produzidos        [████ ON ]     │
│  🚫 Taxa de prenhez            [  OFF███]     │
│  👁 Aspirações realizadas      [████ ON ]     │
└──────────────────────────────────────────────┘
```

- Acessível via ícone de engrenagem em cada seção de stats
- Toggle individual por métrica
- Salvo como `visibility_config: Record<string, boolean>` no `content` JSONB

---

## Banco de Dados

### `user_profiles` — Alterações

```sql
ALTER TABLE user_profiles
  ADD COLUMN profile_roles text[] DEFAULT '{}',
  ADD COLUMN specialties text[] DEFAULT '{}',
  ADD COLUMN service_description text;
```

### Nova tabela `fazenda_profiles`

```sql
CREATE TABLE fazenda_profiles (
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
```

### `profile_sections` — Alterações

```sql
ALTER TABLE profile_sections
  ADD COLUMN fazenda_profile_id UUID REFERENCES fazenda_profiles(id) ON DELETE CASCADE;
```

- `user_id` preenchido → seção do perfil de pessoa
- `fazenda_profile_id` preenchido → seção do perfil de fazenda
- Constraint: exatamente um dos dois deve ser NOT NULL

### Novos section_types

- `'fazenda_links'` — grid de cards de fazendas no perfil da pessoa
- `'production_stats'` — stats reais de produção (por fazenda)
- `'service_stats'` — stats de serviços do prestador
- `'specialties'` — especialidades e descrição profissional
- `'service_portfolio'` — galeria de portfolio

### RPCs novas

```sql
-- Stats de produção por fazenda
CREATE FUNCTION get_fazenda_stats(p_fazenda_id UUID)
RETURNS TABLE(
  total_doadoras BIGINT,
  total_receptoras BIGINT,
  total_embrioes BIGINT,
  total_aspiracoes BIGINT,
  taxa_prenhez NUMERIC
);

-- Stats agregadas do produtor (todas as fazendas)
CREATE FUNCTION get_producer_stats(p_cliente_id UUID)
RETURNS TABLE(...);

-- Stats do prestador de serviço
CREATE FUNCTION get_provider_stats(p_user_id UUID)
RETURNS TABLE(
  total_aspiracoes BIGINT,
  total_tes BIGINT,
  total_embrioes BIGINT,
  total_clientes BIGINT,
  taxa_aproveitamento NUMERIC
);
```

### RLS (Row Level Security)

**`fazenda_profiles`:**
- Owner: full CRUD
- Admin: full CRUD
- Público (`is_public = true`): SELECT para todos

---

## Componentes

### Novos

| Componente | Descrição |
|---|---|
| `FazendaProfilePage.tsx` | Página completa do perfil de fazenda |
| `FazendaProfileHeader.tsx` | Header da fazenda (foto, nome, local, dono) |
| `FazendaLinksSection.tsx` | Cards de fazendas no perfil da pessoa |
| `ProductionStatsSection.tsx` | Stats reais de produção com toggles |
| `ServiceStatsSection.tsx` | Stats do prestador com toggles |
| `SpecialtiesSection.tsx` | Especialidades + descrição profissional |
| `ServicePortfolioSection.tsx` | Galeria de portfolio |
| `StatsVisibilityConfig.tsx` | Dialog de toggles de visibilidade por métrica |

### Modificados

| Componente | Mudança |
|---|---|
| `ProfilePage.tsx` | Remover banner, usar avatar quadrado, mostrar badges de role |
| `ProfileAvatar.tsx` | Refatorar para `rounded-xl`, `object-contain` |
| `ProfileHeader.tsx` | Adicionar badges, remover referência ao banner |
| `ProfileSectionCard.tsx` | Suportar novos section_types |
| `ProfileSectionEditor.tsx` | Opções de novos tipos de seção |

### Deletados

| Componente | Motivo |
|---|---|
| `ProfileBanner.tsx` | Banner eliminado |
| `ProfileBannerUpload.tsx` | Banner eliminado |

---

## Rotas

```
/perfil/:slug          → Perfil de pessoa (público)
/fazenda/:slug         → Perfil de fazenda (público)
/                      → Perfil próprio (owner view, já existe)
```

---

## Hooks

### Novos

- `useFazendaProfile(slug)` — fetch perfil da fazenda por slug
- `useFazendaStats(fazendaId)` — stats reais de produção
- `useProviderStats(userId)` — stats de serviços
- `useUpdateFazendaProfile()` — mutation para editar perfil da fazenda
- `useFazendaSections(fazendaProfileId)` — seções do perfil da fazenda

### Modificados

- `useProfileSections` — suportar `fazenda_profile_id`
- `useUpsertSection` — suportar associação com fazenda

---

## Fora de Escopo (futuro)

- Mapa com localização da fazenda
- Avaliações/reviews de prestadores
- Comparativo entre fazendas
- Dashboard de KPIs (Fase 5)
