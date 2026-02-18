---
name: design-autentico
description: Skill de UI/UX baseada na identidade visual Reversa da logo PassaGene.
---

# Diretrizes de Design Autêntico (PassaGene)

Estas regras foram derivadas da engenharia reversa dos assets oficiais da marca (`logosimples.svg` e `logoescrito.svg`).

## 1. Cores: O DNA da Marca
Extraído dos vetores originais. Use estes códigos exatos.

- **Primary Brand (Vibrant)**: `#09C972` (Verde PassaGene)
    - *Uso*: Botões principais, ícones ativos, estados de sucesso, highlights.
- **Secondary Brand (Deep)**: `#049357` (Verde Floresta)
    - *Uso*: Bordas de destaque, textos em fundos claros, estados de hover.
- **Surface Tints (Fundos com Alma)**:
    - **Light Mode**: Nunca `#FFFFFF`. Use `#F2FBF7` (Um off-white tintado com 2% da Primary).
    - **Dark Mode**: Nunca `#000000`. Use `#051F15` (Um preto profundo tintado com verde).

## 2. Geometria: Orgânica e Fluida
A análise do Símbolo (Escudo + Hélice) revela curvas suaves e contínuas. Não há ângulos agressivos de 90º.

- **Regra de Borda (Border-Radius)**:
    - **Cards e Containers**: `rounded-2xl` (16px) ou `rounded-3xl` (24px).
    - **Botões**: `rounded-full` (Pílula completa).
    - **Inputs**: `rounded-xl` (12px).
- **Proibido**: Cantos vivos (`rounded-none` ou `rounded-sm`). A marca é biológica, não mecânica.

## 3. Tipografia: Tech & Humana
A fonte da logo é uma Sans-Serif geométrica com toques humanistas.

- **Fonte de Títulos (H1-H4)**: **Outfit** (Google Fonts).
    - *Por que?*: É a "irmã gêmea" da tipografia da logo. Possui a mesma estrutura geométrica nos caracteres 'G', 'e' e 'a', mas com terminais amigáveis.
    - *Peso*: Use Bold (700) ou SemiBold (600) para impacto.
- **Fonte de Corpo**: **Inter** ou **Public Sans**.
    - Mantém a legibilidade técnica necessária para dados genéticos.

## 4. UX Writing: O Cientista Amigo
- **Tom de Voz**: Profissional, mas próximo. Como um geneticista explicando algo complexo para um amigo.
- **Exemplos**:
    - ❌ "Dados processados com sucesso."
    - ✅ "Análise genética concluída!"
    - ❌ "Erro 500."
    - ✅ "Tivemos um problema no laboratório virtual. Tente novamente."

## 5. Ícones
- Use `Lucide React` com traços arredondados (`stroke-width={2}` ou `1.5`) para combinar com a geometria da marca.
