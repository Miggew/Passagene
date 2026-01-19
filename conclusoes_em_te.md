# 🔍 Análise: Status EM_TE - Descobertas Importantes

## 📊 Resultados da QUERY 5 (Comparação EM_TE vs PASSO2_FECHADO)

### EM_TE:
- **10 protocolos**
- **36 receptoras totais**
- **26 receptoras utilizadas** (72.2%)
- **10 receptoras ainda NÃO utilizadas** (27.8%)

### PASSO2_FECHADO:
- **4 protocolos**
- **6 receptoras totais**
- **0 receptoras utilizadas** (0%)
- **Todas as receptoras foram descartadas ou não foram servidas**

---

## 💡 Conclusões Importantes

### 1. **EM_TE é um Status Intermediário Real**
- ✅ **66.67% dos protocolos** estão com `EM_TE`
- ✅ Status mais comum no sistema
- ✅ Não é um erro ou status obsoleto

### 2. **Critérios para EM_TE (Hipótese):**
Com base nos dados, `EM_TE` parece ser definido quando:
1. ✅ Protocolo iniciou o 2º passo (`passo2_data` preenchido)
2. ✅ **Pelo menos uma receptora foi marcada como `UTILIZADA`** (Transferência realizada)
3. ⚠️ **Nem todas as receptoras foram `UTILIZADA` ainda** (protocolo em andamento)

### 3. **Diferença entre EM_TE e PASSO2_FECHADO:**
- **EM_TE**: Protocolo com receptoras que já receberam TE, mas ainda há receptoras pendentes
- **PASSO2_FECHADO**: Protocolo completamente finalizado (todas as receptoras foram avaliadas no 2º passo, mesmo que descartadas)

### 4. **Onde EM_TE é Definido:**
Como não há:
- ❌ Trigger customizado
- ❌ View que calcula dinamicamente (precisamos verificar ainda)
- ❌ Função explícita no código TypeScript

**Hipótese:** O status `EM_TE` pode ser definido:
- Por uma **função RPC no banco** (`fechar_protocolo`?)
- **Quando receptoras são marcadas como `UTILIZADA`** na Transferência de Embriões
- Por uma **trigger em `protocolo_receptoras`** que atualiza o protocolo quando `status = 'UTILIZADA'`

---

## 🎯 Próximos Passos para Confirmar

Execute as queries do arquivo `investigar_criterios_em_te.sql` para:
1. Ver detalhes de cada protocolo `EM_TE`
2. Comparar com `PASSO2_FECHADO` 
3. Verificar se todos os `EM_TE` têm:
   - `passo2_data` preenchido
   - Pelo menos uma receptora `UTILIZADA`
   - Nem todas as receptoras `UTILIZADA`

---

## 📋 Recomendações Imediatas para o Código

1. **Adicionar `EM_TE` aos filtros da página de Protocolos:**
   - Opção no filtro rápido: "Em TE" ou "Pós-TE"
   - Ou incluir em "Aguardando 2º Passo" se ainda há receptoras pendentes

2. **Tratar `EM_TE` na interface:**
   - Mostrar badge apropriado
   - Permitir ações relevantes (ver relatório, continuar TE, etc.)

3. **Documentar oficialmente:**
   - `EM_TE` = Protocolo com Transferências de Embriões realizadas, mas ainda em andamento
   - Distinguir de `PASSO2_FECHADO` que é protocolo completamente finalizado
