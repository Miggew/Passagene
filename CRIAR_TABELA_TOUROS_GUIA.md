# 📋 Guia: Criar Tabela de Touros no Supabase

## ⚠️ Erro Atual
O erro `404 (Not Found)` acontece porque a tabela `touros` ainda não foi criada no banco de dados.

## ✅ Solução: Executar Script SQL

### Passo 1: Acessar SQL Editor no Supabase

1. Abra o dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto (twsnzfzjtjdamwwembzp)
3. No menu lateral esquerdo, clique em **"SQL Editor"**

### Passo 2: Criar Nova Query

1. Clique no botão **"New query"** (ou use `Ctrl+N`)
2. Uma nova aba será aberta

### Passo 3: Copiar e Colar o Script

1. Abra o arquivo `criar_tabela_touros.sql` neste projeto
2. **Selecione TODO o conteúdo** do arquivo (Ctrl+A)
3. **Copie** (Ctrl+C)
4. **Cole** no SQL Editor do Supabase (Ctrl+V)

### Passo 4: Executar o Script

1. Clique no botão **"Run"** (ou pressione `Ctrl+Enter`)
2. Aguarde alguns segundos
3. Deve aparecer: ✅ **"Success. No rows returned"**

### Passo 5: Verificar se Funcionou

Execute esta query de verificação:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'touros';
```

**Resultado esperado:** Deve retornar 1 linha com `touros`

---

## 🔍 Verificar Estrutura da Tabela (Opcional)

Para ver todas as colunas criadas:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'touros'
ORDER BY ordinal_position;
```

**Deve retornar:** Todas as colunas criadas (id, registro, nome, raca, nm_dolares, tpi, ptat, etc.)

---

## ✅ Após Executar

1. **Recarregue a página** do menu Touros no aplicativo
2. O erro `404` deve desaparecer
3. Agora você poderá:
   - Ver a lista de touros (vazia inicialmente)
   - Cadastrar novos touros
   - Editar touros existentes

---

## 🆘 Se Algo Der Errado

### Erro: "relation already exists"
- A tabela já existe! Isso significa que o script foi executado antes.
- Pule para o Passo 5 (verificação) para confirmar.

### Erro: "permission denied"
- Verifique se você tem permissão de administrador no projeto Supabase
- Entre em contato com o administrador do projeto se necessário.

### Erro: "syntax error"
- Verifique se copiou o script completo
- Certifique-se de que não há caracteres estranhos
- Tente copiar e colar novamente

---

## 📝 Próximo Passo

Após criar a tabela, você pode:

1. **Cadastrar o primeiro touro**:
   - Clique em "Novo Touro" no menu
   - Preencha os campos básicos (Registro e Nome são obrigatórios)
   - Clique em "Cadastrar Touro"

2. **Cadastrar doses de sêmen**:
   - Agora os clientes podem ter doses dos touros cadastrados
   - Vá em "Doses de Sêmen" para vincular touros aos clientes
