# 🐂 Análise: Estrutura de Campos para Catálogo de Touros Multi-Raça

## 📊 Análise dos Catálogos Fornecidos

### Raça Holandesa (Dairy Holstein)
**Campos Principais:**
- **Produção:** Leite kg, Gordura kg, Gordura %, Proteína kg, Proteína %, Eficiência Alimentar, BMR, Eficiência em Metano
- **Saúde/Reprodução:** Perm. Rebanho, C.C.S., Facilidade de Parto, Fertilidade Filhas, Facilidade de Parto Materna, Velocidade Ordenha, Temperamento, Persistência Lactação, Resistência à Mastite, Resistência a Doenças Metabólicas, Immunity Bezerra, Escore de Condição Corporal
- **Genéticos:** NM$ (Net Merit), TPI (Total Performance Index), PTAT, UDC, FLC, BWC, GPA LPI, PRO$
- **Conformação:** 21+ traços (Estatura, Largura Peito, Profundidade Corpo, Sistema Mamário detalhado, Pernas & Pés, etc.)
- **Caseínas:** Beta Caseína (A1A2, A2A2), Kappa Caseína (AA, BB, AB)

### Raça Nelore
**Campos Principais:**
- **SUMÁRIO ANCP:** MP120, DPN, DP210, DP365, DP450, DPE365, DPE450, DIPP, DSTAY, D3P, DAOL, DACAB, MGTe, MGTeCR, MGTeRE, MGTeCD, MGTeF1
- **SUMÁRIO ABCZ PMGZ:** PM-EM, PN-ED, PD-ED, PA-ED, PS-ED, IPP (DIAS), PE365 (cm), PE450 (cm), STAY (%), EC, PREC, MUSC S, ADL (cm), ACAB (mm), MARM (%)
- **GENEPLUS:** PN, P120, TM120, PD, TMD, PS, GPD, STAY, PES, IPP, AOL, EGS, MAR, CAR, IQG
- **Medidas Físicas:** CC, AG, CG, LG, PT, PC, CE (medidas corporais em cm)

### Raça Girolando
**Campos Principais:**
- **Produção:** GPTA Leite (kg), Idade ao 1º Parto, Intervalo de Partos, Longevidade
- **Índices Específicos:** IPPLG (Índice de Produção e Persistência na Lactação), IETG (Índice de Eficiência Tropical), IFPG (Índice Facilidade de Parto), IREG (Composto Reprodução), CSMG (Composto Sistema Mamário)
- **Pesos:** PTAPN (Peso ao Nascimento), PTAPG (Período Gestacional)
- **Caseínas:** Beta Caseína, Beta Lactoglobulina, Kappa Caseína
- **Composição Genética:** 5/8 Holandês + 3/8 Gir (varia)

### Raça Gir Leiteiro
**Campos Principais:**
- **Produção:** GPTA Leite (similar ao Holandês)
- **PTA Leite:** Valores de produção de leite
- **Pedigree Detalhado:** Com lactações das fêmeas

### Raça Guzerá
**Campos Principais:**
- Campos similares ao Nelore (raça de corte)
- Foco em estrutura corporal e conformação racial

---

## 🎯 Problema Identificado

**Cada raça tem:**
1. ✅ Campos COMUNS (nome, registro, raça, pedigree básico, foto)
2. ❌ Campos ESPECÍFICOS diferentes (genéticos, produção, conformação)
3. ❌ Alguns campos têm NOMES diferentes mas SIGNIFICADO similar
4. ❌ Alguns campos são EXCLUSIVOS de certas raças

---

## 💡 Soluções Propostas

### **Opção 1: Campos Comuns + JSONB para Campos Dinâmicos** ⭐ RECOMENDADO

**Vantagens:**
- ✅ Flexível - permite qualquer campo por raça
- ✅ Escalável - fácil adicionar novas raças
- ✅ Busca via índices GIN no PostgreSQL
- ✅ Mantém estrutura relacional para campos comuns

**Desvantagens:**
- ⚠️ Validação precisa ser feita no frontend
- ⚠️ Busca por campos dinâmicos mais complexa (mas possível)

**Estrutura:**
```sql
CREATE TABLE touros (
    -- Campos COMUNS (todos os touros)
    id UUID PRIMARY KEY,
    registro TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    raca TEXT NOT NULL, -- Chave para determinar schema dinâmico
    data_nascimento DATE,
    
    -- Pedigree básico (comum)
    pai_registro TEXT,
    pai_nome TEXT,
    mae_registro TEXT,
    mae_nome TEXT,
    genealogia_texto TEXT,
    
    -- Mídia e links (comum)
    foto_url TEXT,
    link_catalogo TEXT,
    link_video TEXT, -- YouTube, etc.
    
    -- Campos dinâmicos por raça (JSONB)
    dados_geneticos JSONB, -- Todos os genéticos específicos da raça
    dados_producao JSONB,  -- Dados de produção específicos
    dados_conformacao JSONB, -- Conformação física
    medidas_fisicas JSONB, -- Medidas corporais (Nelore, etc.)
    
    -- Metadados
    disponivel BOOLEAN DEFAULT true,
    observacoes TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Exemplo de JSONB para Holandesa:**
```json
{
  "dados_geneticos": {
    "nm_dolares": 2443,
    "tpi": 3609,
    "ptat": 2.96,
    "udc": 1.8,
    "flc": 0.1,
    "bwc": 0.5,
    "gpa_lpi": 1868,
    "pro_dolar": 1939
  },
  "dados_producao": {
    "leite_kg": 1058,
    "gordura_kg": 63,
    "gordura_porcent": 0.09,
    "proteina_kg": 46,
    "proteina_porcent": 0.04,
    "eficiencia_alimentar": 100,
    "bmr": 96
  },
  "dados_conformacao": {
    "conformacao_geral": 5,
    "forca_leiteira": 4,
    "sistema_mamario": 5,
    "pernas_pes": -1,
    "estatura": 1,
    "largura_peito": 3
  },
  "caseinas": {
    "beta_caseina": "A2A2",
    "kappa_caseina": "BB"
  }
}
```

**Exemplo de JSONB para Nelore:**
```json
{
  "dados_geneticos": {
    "sumario_ancp": {
      "mp120": 72,
      "dpn": 15.2,
      "dp365": 180.5,
      "mgete": 0.5
    },
    "sumario_abcz_pmgz": {
      "pe365": 850,
      "pe450": 1050,
      "stay": 85,
      "marm": 3.5
    }
  },
  "medidas_fisicas": {
    "cc": 163,
    "ag": 155,
    "cg": 54,
    "lg": 48,
    "pt": 222,
    "pc": 83,
    "ce": 42,
    "idade_medicao": 23,
    "peso_medicao": 839
  }
}
```

---

### **Opção 2: Tabela Auxiliar de Campos por Raça**

**Estrutura:**
```sql
-- Tabela principal (campos comuns)
CREATE TABLE touros (...);

-- Tabela de campos específicos
CREATE TABLE touro_campos_dinamicos (
    id UUID PRIMARY KEY,
    touro_id UUID REFERENCES touros(id),
    raca TEXT NOT NULL,
    campo_nome TEXT NOT NULL,
    campo_valor TEXT, -- ou NUMERIC, DATE conforme tipo
    campo_tipo TEXT, -- 'texto', 'numero', 'data', 'booleano'
    campo_categoria TEXT, -- 'genetico', 'producao', 'conformacao'
    created_at TIMESTAMP
);
```

**Desvantagens:**
- ❌ Mais complexo para consultas
- ❌ Pode gerar muitas linhas por touro
- ❌ Menos performático

---

### **Opção 3: Campos Genéricos com Nomes Flexíveis**

**Estrutura:**
```sql
CREATE TABLE touros (
    -- Campos comuns
    ...
    
    -- Campos genéricos numericos (até 20 campos)
    valor_genetico_1 NUMERIC,
    valor_genetico_2 NUMERIC,
    ...
    valor_genetico_20 NUMERIC,
    
    -- Campos de texto (labels)
    label_genetico_1 TEXT,
    label_genetico_2 TEXT,
    ...
);
```

**Desvantagens:**
- ❌ Limitado a número fixo de campos
- ❌ Sem validação de tipo
- ❌ Difícil de manter

---

## ✅ RECOMENDAÇÃO: Opção 1 (Campos Comuns + JSONB)

### Por quê?
1. **Flexibilidade Total:** Suporta qualquer raça sem alterar schema
2. **Performance:** PostgreSQL JSONB é otimizado e indexável
3. **Manutenibilidade:** Schema claro e organizado
4. **Escalabilidade:** Fácil adicionar novas raças

### Como Funcionaria:

1. **Frontend:** 
   - Definições de campos por raça em TypeScript
   - Formulário dinâmico baseado na raça selecionada
   - Validação por raça

2. **Backend (Supabase):**
   - Armazenamento JSONB
   - Índices GIN para busca rápida
   - Validação via triggers (opcional)

3. **UI:**
   - Renderização condicional por raça
   - Seções organizadas (Genéticos, Produção, Conformação)
   - Tabelas formatadas por tipo de dado

---

## 🔧 Próximos Passos Sugeridos

1. **Definir Schema de Campos por Raça** (TypeScript)
2. **Criar Componente de Formulário Dinâmico**
3. **Implementar Renderização Condicional na Página de Detalhes**
4. **Adicionar Validação por Raça**
5. **Criar Índices GIN para Busca Rápida**

---

## 📝 Campos que SEMPRE estarão na Tabela Principal

Estes campos são comuns a TODAS as raças:

- `id`, `registro`, `nome`, `raca`
- `data_nascimento`
- `pai_registro`, `pai_nome`, `mae_registro`, `mae_nome`
- `genealogia_texto`
- `foto_url`, `link_catalogo`, `link_video`
- `proprietario`, `fazenda_nome` (opcional - pode ir em JSONB se variar muito)
- `disponivel`, `observacoes`
- `created_at`, `updated_at`

---

## ❓ Perguntas para Decidir

1. **Proprietário/Fazenda:** Varia muito ou é sempre o mesmo?
2. **Vídeos:** Será comum ter links de vídeo? (vi no catálogo)
3. **Badges/Classificações:** Como "A2A2", "GENOMAX", etc. - fixo ou dinâmico?
4. **Medidas Físicas:** Apenas Nelore ou outras raças também?
5. **Busca:** Precisará buscar/filtrar por campos genéticos específicos?

---

## 🎨 Sugestão de Implementação Visual

Na página de detalhes, organizar em **abas ou seções**:

```
[Foto Grande]
[Informações Básicas]
  ├─ Registro, Nome, Raça
  ├─ Nascimento
  └─ Proprietário/Fazenda

[Abas ou Seções]
  ├─ 🧬 Genéticos (campos dinâmicos por raça)
  ├─ 📊 Produção (campos dinâmicos)
  ├─ 🏃 Conformação (se aplicável)
  ├─ 📏 Medidas (se aplicável - Nelore)
  ├─ 👨‍👩‍👧 Pedigree
  └─ 📝 Outros (links, observações)
```

---

Qual opção você prefere? Ou quer combinar abordagens?
