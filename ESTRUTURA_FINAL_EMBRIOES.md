# Estrutura Final: Sistema de Embriões - Decisões Confirmadas

## ✅ DECISÕES FINAIS

1. **Identificação**: `{doadora_registro}_{touro}_{classificacao}_{numero_embriao}`
   - Exemplo: "ABC123_PIETRO_EX_1", "ABC123_PIETRO_EX_2"
   - Doadora: registro da doadora (da aspiração)
   - Touro: nome da dose de sêmen
   - Classificação: classificação do embrião (EX, BL, etc)
   - Número: sequencial do embrião (1, 2, 3...)

2. **Vídeo**: Opcional (não obrigatório)

3. **Múltiplos Vídeos**: Permitido (quando quantidade grande de embriões)

4. **Formato de Vídeo**: 
   - **Recomendado**: MP4 (H.264/AAC)
   - **Resolução**: 1080p (1920x1080) ou superior
   - **Qualidade**: Alta (para análise de IA)
   - **Formato alternativo**: MOV também aceito
   - **Justificativa**: 
     - MP4/H.264: Padrão universal, boa compressão, compatível com IA
     - Compatível com celulares modernos
     - Boa qualidade para análise de detalhes

5. **Tamanho Máximo**: 500MB por vídeo (30 segundos)

---

## 📐 IDENTIFICAÇÃO DO EMBRIÃO

### Formato
```
{doadora_registro}_{nome_touro}_{classificacao}_{numero}
```

### Exemplo
- Doadora: "ABC123"
- Touro (dose sêmen): "PIETRO"
- Classificação: "EX" (Excelente)
- Número: 1, 2, 3...
- **Resultado**: "ABC123_PIETRO_EX_1", "ABC123_PIETRO_EX_2", etc.

### Regras
- Gerar automaticamente quando classificar
- Se classificação ainda não foi informada, usar identificação temporária
- Número é sequencial por acasalamento (1, 2, 3...)

---

## 🎬 SISTEMA DE VÍDEOS

### Formato Recomendado
- **Container**: MP4
- **Codec de Vídeo**: H.264 (AVC)
- **Codec de Áudio**: AAC (opcional, pode ser sem áudio)
- **Resolução**: 1080p (1920x1080) ou superior
- **Frame Rate**: 30fps ou 60fps
- **Tamanho máximo**: 500MB
- **Duração**: ~30 segundos

### Formato Alternativo
- MOV (QuickTime) também aceito
- Mesmas especificações de codec

### Validação no Upload
- Verificar formato (MP4, MOV)
- Verificar tamanho (max 500MB)
- Opcional: Validar codec/resolução

---

## 📊 ESTRUTURA ATUALIZADA

### Identificação Automática

**Lógica**:
1. Quando classificar embrião, gerar identificação
2. Buscar: doadora (via acasalamento → aspiração), touro (via acasalamento → dose_semen)
3. Formato: `{doadora_registro}_{touro_nome}_{classificacao}_{numero}`

**Numeração**:
- Contar embriões do mesmo acasalamento que já têm classificação
- Numeração: 1, 2, 3... (sequencial)

---

## 🔄 FLUXO DE IDENTIFICAÇÃO

```
1. Criar embriões (status FRESCO, identificacao = NULL)
2. Classificar embrião (obrigatório)
3. Gerar identificação automaticamente:
   - Buscar doadora (aspiração → doadora → registro)
   - Buscar touro (acasalamento → dose_semen → nome)
   - Buscar classificação (campo classificacao)
   - Contar embriões do mesmo acasalamento com classificação
   - Gerar: {registro}_{touro}_{classificacao}_{numero}
4. Salvar identificação
```

---

## 💾 ARMAZENAMENTO DE VÍDEOS

### Supabase Storage

**Bucket**: `embrioes-media` (criar)

**Estrutura de pastas**:
```
embrioes-media/
  acasalamentos/
    {acasalamento_id}/
      video_1.mp4
      video_2.mp4
      ...
```

**Configurações**:
- Público: Não (precisa autenticação para acessar)
- Tamanho máximo: 500MB por vídeo
- Tipos aceitos: video/mp4, video/quicktime
- Formato recomendado: MP4 (H.264/AAC), 1080p ou superior

### Formato de Vídeo Recomendado

- **Container**: MP4
- **Codec de Vídeo**: H.264 (AVC)
- **Codec de Áudio**: AAC (opcional, pode ser sem áudio)
- **Resolução**: 1080p (1920x1080) ou superior
- **Frame Rate**: 30fps ou 60fps
- **Tamanho máximo**: 500MB
- **Duração**: ~30 segundos
- **Qualidade**: Alta (para análise de IA)

**Formato alternativo**: MOV (QuickTime) também aceito com mesmas especificações

### Validação no Upload

- Verificar formato (MP4, MOV)
- Verificar tamanho (max 500MB)
- Opcional: Validar codec/resolução

---

## 📝 PRÓXIMOS PASSOS DE IMPLEMENTAÇÃO

1. ✅ Estrutura de dados confirmada
2. ⏭️ Criar migrations SQL
3. ⏭️ Configurar Supabase Storage
4. ⏭️ Implementar geração de identificação
5. ⏭️ Implementar upload de vídeos
6. ⏭️ Redesenhar interface
