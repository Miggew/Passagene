# Design System v3 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the ~20% gap between DESIGN-SYSTEM.md v3 and the actual codebase, focusing on DNA gradient identity, component alignment, and consistency.

**Architecture:** Pure CSS/Tailwind refactor — no structural changes. All work happens in `src/index.css`, `tailwind.config.ts`, and existing component files. Zero new files except potential icon components.

**Tech Stack:** Tailwind CSS, CSS Custom Properties, React components (existing shadcn/ui customizations)

**Current State:** Codebase is ~80% aligned. Fonts, color tokens, dark mode, glass panels all correct. Gaps: hardcoded gradients, button variant naming, inconsistent DNA gradient usage, design doc navigation mismatch.

---

### Task 1: Extract DNA Gradient to CSS Variables

**Files:**
- Modify: `src/index.css`

**Why:** The green→gold gradient (`linear-gradient(135deg, #34D399, #D4A24C)`) is hardcoded in LogoPassagene, LoaderDNA, VoiceFAB, and glass-panel rim. Centralizing it ensures one change propagates everywhere.

**Step 1: Add gradient variables to `:root` in index.css**

Inside `:root` (light mode), add:

```css
--gradient-dna: linear-gradient(135deg, #34D399, #D4A24C);
--gradient-dna-subtle: linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(212, 162, 76, 0.10));
--gradient-dna-border: linear-gradient(135deg, rgba(52, 211, 153, 0.25), rgba(212, 162, 76, 0.15));
--gradient-dna-text: linear-gradient(135deg, #09C972, #D4A24C);
```

These are the same in both light and dark mode (the gradient itself doesn't change, only surrounding surfaces do).

**Step 2: Update glass-panel rim light to use the variable**

In the `.glass-panel::after` rule, replace the hardcoded green→white→gold gradient with `var(--gradient-dna-border)` applied to the rim.

**Step 3: Verify visually**

Run: `npm run dev`
Check: Glass panels, TopBar, cards should look identical (no visual change — this is a refactor).

**Step 4: Commit**

```bash
git add src/index.css
git commit -m "refactor: extract DNA gradient to CSS custom properties"
```

---

### Task 2: Apply DNA Gradient Variables to Components

**Files:**
- Modify: `src/components/ui/LogoPassagene.tsx`
- Modify: `src/components/ui/LoaderDNA.tsx`
- Modify: `src/components/ui/GeniaLogo.tsx`

**Why:** These components hardcode `linear-gradient(135deg, #34D399, #D4A24C)`. Replace with `var(--gradient-dna)`.

**Step 1: Update LogoPassagene.tsx**

Find the inline style with hardcoded gradient and replace:
```tsx
// Before
background: 'linear-gradient(135deg, #34D399, #D4A24C)'
// After
background: 'var(--gradient-dna)'
```

**Step 2: Update LoaderDNA.tsx**

In the `getColors()` function, premium variant:
```tsx
// Before
bg: 'linear-gradient(135deg, #34D399, #D4A24C)',
// After
bg: 'var(--gradient-dna)',
```

**Step 3: Update GeniaLogo.tsx**

Same pattern — replace hardcoded gradient with CSS var.

**Step 4: Verify visually**

Run: `npm run dev`
Check: Logo, loader, and Genia logo should look identical.

**Step 5: Commit**

```bash
git add src/components/ui/LogoPassagene.tsx src/components/ui/LoaderDNA.tsx src/components/ui/GeniaLogo.tsx
git commit -m "refactor: use CSS var for DNA gradient in brand components"
```

---

### Task 3: Enhance DNA Gradient Presence in Interactive Elements

**Files:**
- Modify: `src/index.css`

**Why:** User wants more green+gold blend throughout. Currently DNA gradient only appears in logo, loader, FAB, and glass panel rim. Should also appear in: active tab indicators, focus rings, progress bars, and hover accents.

**Step 1: Add DNA gradient utility classes**

In `@layer utilities` section of index.css, add:

```css
/* DNA gradient accents */
.border-dna {
  border-image: var(--gradient-dna-border) 1;
}

.bg-dna-subtle {
  background: var(--gradient-dna-subtle);
}

.text-dna {
  background: var(--gradient-dna-text);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* DNA gradient progress bar fill */
.progress-dna {
  background: var(--gradient-dna);
}

/* DNA glow for focus states */
.ring-dna {
  box-shadow: 0 0 0 2px var(--bg-primary),
              0 0 0 4px rgba(52, 211, 153, 0.2),
              0 0 12px rgba(212, 162, 76, 0.08);
}
```

**Step 2: Update button gold variant glow**

In `.btn-primary-gold:hover`, add dual-color glow:
```css
box-shadow: 0 0 20px rgba(212, 162, 76, 0.2), 0 0 40px rgba(52, 211, 153, 0.08);
```

**Step 3: Verify**

Run: `npm run dev`
New utility classes available. No visual change yet (they need to be applied in subsequent tasks).

**Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: add DNA gradient utility classes for broader identity presence"
```

---

### Task 4: Align Button Variants with v3 Spec

**Files:**
- Modify: `src/components/ui/button.tsx`

**Why:** Design system v3 defines `primary` as the main green button. Current code uses `default` for this role. Need to alias or rename.

**Step 1: Read current button.tsx variants**

Read `src/components/ui/button.tsx` to understand current variant map.

**Step 2: Add `primary` variant**

Add a `primary` variant that matches v3 spec:
```
bg-green-500 text-white hover:bg-green-600 shadow-sm hover:shadow-glow-green
```

Keep `default` as alias pointing to the same styles for backward compatibility across existing pages.

**Step 3: Ensure `gold` variant matches v3**

```
bg-gold-400 text-green-950 hover:bg-gold-500 shadow-sm hover:shadow-glow-gold
```

**Step 4: Ensure `success` variant exists**

```
bg-green-500 text-white hover:shadow-glow-green
```

**Step 5: Verify**

Run: `npm run dev`
Check: Existing buttons unchanged. New variant names available.

**Step 6: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "feat: align button variants with design system v3 spec"
```

---

### Task 5: Apply Accent Card Patterns

**Files:**
- Modify: `src/components/ui/card.tsx`

**Why:** v3 defines `accent-green` (border-l-3 green) and `accent-gold` (border-l-3 gold) card variants. These differentiate lab modules from business modules visually.

**Step 1: Read current card.tsx**

Understand current variant system.

**Step 2: Add accent variants**

Add to card variant map:
```tsx
'accent-green': 'border-l-[3px] border-l-green-500',
'accent-gold': 'border-l-[3px] border-l-gold-400',
'stat': 'p-4', // compact stat card
'interactive': 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all',
```

**Step 3: Verify**

Run: `npm run dev`
New card variants available. No visual change until applied to pages.

**Step 4: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "feat: add accent-green, accent-gold, stat, interactive card variants"
```

---

### Task 6: Update Table Styling to v3 Spec

**Files:**
- Modify: `src/index.css` (add table utility styles if needed)

**Why:** v3 specifies: no zebra stripes, hover `bg-green-50 dark:bg-green-950/30`, IDs in `font-mono text-green-600`, monetary values in `font-mono text-gold-600`, headers in `text-[11px] uppercase tracking-wider`.

**Step 1: Add table utility classes**

```css
/* v3 Table patterns */
.table-row-hover {
  @apply transition-colors duration-150 hover:bg-green-50 dark:hover:bg-green-950/30;
}

.table-header-cell {
  @apply text-[11px] font-semibold uppercase tracking-wider text-muted;
}

.table-id {
  @apply font-mono text-xs font-medium text-green-600 dark:text-green-400;
}

.table-money {
  @apply font-mono font-semibold text-gold-600 dark:text-gold-400;
}
```

**Step 2: Verify**

Classes available globally.

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add v3 table utility classes (hover, header, id, money)"
```

---

### Task 7: Update Design Doc Navigation Section

**Files:**
- Modify: `DESIGN-SYSTEM.md`

**Why:** Section 6 describes a sidebar-based navigation, but the real app uses TopBar + HubTabs + floating VoiceFAB. The design doc must match reality.

**Step 1: Rewrite Section 6**

Replace the sidebar description with the actual navigation structure:
- TopBar (glass-panel, logo, greeting, badge, avatar dropdown)
- HubTabs (horizontal tabs below topbar, scrollable on mobile)
- VoiceFAB (floating Gen.IA button, bottom-right, hidden on /genia)
- No sidebar, no bottom navigation bar

**Step 2: Update the architecture diagram**

```
+---------------------------------------------+
|  TopBar (fixa, glass-panel)                  |
+---------------------------------------------+
|  HubTabs (horizontal, scrollable)            |
+---------------------------------------------+
|                                              |
|          Conteudo da pagina                  |
|                                              |
+---------------------------------------------+
                               [VoiceFAB]  (floating)
```

**Step 3: Verify**

Read the updated section. It should accurately describe `MainLayout.tsx`, `TopBar.tsx`, `MobileNav.tsx`, and `HubTabs.tsx`.

**Step 4: Commit**

```bash
git add DESIGN-SYSTEM.md
git commit -m "docs: update navigation section to match real app structure (no sidebar)"
```

---

### Task 8: Enhance Genia Chat Styling Alignment

**Files:**
- Modify: `src/pages/ConsultorIA.tsx` (or wherever chat messages are rendered)

**Why:** v3 specifies exact message styling. User messages should be `bg-green-500 text-white rounded-2xl rounded-br-md`. Genia responses should have DNA gradient progress bars and `font-mono text-gold-500` for monetary values.

**Step 1: Read ConsultorIA.tsx message rendering**

Understand current bubble styles.

**Step 2: Align user bubble**

Ensure:
```
ml-auto max-w-[85%] md:max-w-[70%]
bg-green-500 text-white
rounded-2xl rounded-br-md
px-4 py-3 text-sm
```

**Step 3: Align Genia bubble**

Ensure:
```
max-w-[90%] md:max-w-[80%]
bg-card border border-border
rounded-2xl rounded-bl-md
px-5 py-4
```

**Step 4: Ensure rich content styling**

- Monetary values: `font-mono font-semibold text-gold-500`
- Scores: `font-mono font-bold` + semantic color
- Inline code: `font-mono text-xs bg-muted/50 rounded-md px-2 py-1`

**Step 5: Verify**

Run: `npm run dev`, navigate to `/genia`
Check: Message bubbles match v3 spec.

**Step 6: Commit**

```bash
git add src/pages/ConsultorIA.tsx
git commit -m "style: align Genia chat bubbles and rich content with design system v3"
```

---

### Task 9: Tailwind Config Alignment

**Files:**
- Modify: `tailwind.config.ts`

**Why:** Ensure the Tailwind config exposes all v3 tokens that are missing. Add `shadow-glow-green` and `shadow-glow-gold` if not present.

**Step 1: Read current tailwind.config.ts**

Verify which v3 tokens exist.

**Step 2: Add missing shadow tokens**

```ts
'glow-green': '0 0 20px rgba(9, 201, 114, 0.15)',
'glow-gold': '0 0 20px rgba(212, 162, 76, 0.15)',
```

**Step 3: Add missing color tokens if needed**

Ensure `gold-400`, `gold-500`, `gold-600` are accessible via Tailwind classes.

**Step 4: Verify**

Run: `npm run dev`
No visual change — tokens now available.

**Step 5: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add missing v3 shadow and color tokens to Tailwind config"
```

---

### Task 10: Final Audit & Cleanup

**Files:**
- Read-only audit across all modified files

**Why:** Verify all changes work together. Check for regressions in both light and dark mode.

**Step 1: Visual audit checklist**

Run `npm run dev` and verify:
- [ ] Glass panels show DNA gradient rim (unchanged)
- [ ] Logo uses CSS var gradient (unchanged appearance)
- [ ] LoaderDNA premium variant uses CSS var (unchanged appearance)
- [ ] VoiceFAB breathing glow works (unchanged)
- [ ] New button variants render correctly
- [ ] New card accent variants available
- [ ] Table utility classes applied correctly
- [ ] Genia chat messages match v3 spec
- [ ] Dark mode: all elements correct
- [ ] Light mode: all elements correct

**Step 2: Build check**

```bash
npm run build
```

Should compile without errors or warnings.

**Step 3: Final commit**

If any cleanup needed during audit:
```bash
git add -A
git commit -m "chore: design system v3 implementation cleanup"
```

---

## Execution Order & Dependencies

```
Task 1 (CSS vars)
  → Task 2 (Apply to components)
  → Task 3 (New utility classes)

Task 4 (Buttons) — independent
Task 5 (Cards) — independent
Task 6 (Tables) — independent
Task 7 (Design doc) — independent

Task 3 → Task 8 (Genia chat — uses new utilities)
Task 4 + Task 5 → Task 9 (Tailwind config — needs to know what's missing)

All → Task 10 (Final audit)
```

Tasks 4, 5, 6, 7 can run in parallel. Tasks 1→2→3 must be sequential. Task 8 depends on 3. Task 10 is always last.

---

## Out of Scope (Future Work)

- **Custom icon set** (~15 icons) — requires design work first, not a code task
- **New pages/modules** — this plan only touches existing code
- **Structural refactors** — no navigation changes, no new components
- **Performance optimization** — not related to design system
