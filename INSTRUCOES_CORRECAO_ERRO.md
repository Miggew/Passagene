# 🔧 Correção do Erro: Constraint status_atual

## ⚠️ PROBLEMA IDENTIFICADO

O erro mostra:
```
new row for relation "embrioes" violates check constraint "embrioes_status_atual_chk"
```

A constraint `embrioes_status_atual_chk` no banco de dados **não permite o valor 'FRESCO'**.

## ✅ SOLUÇÃO

Execute o arquivo SQL: **`fix_constraint_status_embrioes.sql`**

### Passos:

1. Abra o Supabase Dashboard
2. Vá em "SQL Editor"
3. Abra o arquivo `fix_constraint_status_embrioes.sql`
4. Copie todo o conteúdo
5. Cole no SQL Editor
6. Clique em "Run"
7. Aguarde a execução
8. **Tente criar os embriões novamente**

## O que o script faz:

1. Remove a constraint antiga `embrioes_status_atual_chk` (que não aceita 'FRESCO')
2. Cria uma nova constraint `check_embrioes_status` que aceita:
   - 'FRESCO'
   - 'CONGELADO'
   - 'TRANSFERIDO'
   - 'DESCARTADO'

## Após executar:

- Os embriões poderão ser criados com status 'FRESCO'
- O erro 400 não deve mais aparecer
- Tente salvar a quantidade de embriões novamente
