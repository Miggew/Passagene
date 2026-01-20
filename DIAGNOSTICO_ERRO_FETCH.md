# Diagnóstico: Erro "Failed to fetch (api.supabase.com)"

## Possíveis Causas

### 1. **Problema de Conexão de Rede**
- Verifique sua conexão com a internet
- Tente acessar https://twsnzfzjtjdamwwembzp.supabase.co no navegador
- Verifique se há firewall ou proxy bloqueando a conexão

### 2. **Credenciais do Supabase Expiradas ou Incorretas**
- Verifique se a chave anon ainda é válida
- Acesse o painel do Supabase e verifique as credenciais
- As chaves podem ter sido regeneradas

### 3. **Problema Temporário com a API do Supabase**
- O Supabase pode estar com problemas temporários
- Verifique o status: https://status.supabase.com/

### 4. **Problema de CORS**
- Verifique as configurações de CORS no painel do Supabase
- A URL de origem pode não estar autorizada

### 5. **Problema com a URL da API**
- Verifique se a URL está correta: `https://twsnzfzjtjdamwwembzp.supabase.co`

## Soluções

### Solução 1: Verificar Conexão e Credenciais

1. **Teste a conexão direta:**
   ```bash
   curl https://twsnzfzjtjdamwwembzp.supabase.co/rest/v1/
   ```

2. **Verifique as credenciais no Supabase:**
   - Acesse: https://supabase.com/dashboard/project/twsnzfzjtjdamwwembzp
   - Vá em Settings > API
   - Confirme se a URL e a chave `anon/public` estão corretas

### Solução 2: Usar Variáveis de Ambiente (Recomendado)

1. **Crie um arquivo `.env.local` na raiz do projeto:**
   ```env
   VITE_SUPABASE_URL=https://twsnzfzjtjdamwwembzp.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_chave_aqui
   ```

2. **Atualize `src/lib/supabase.ts`:**
   ```typescript
   const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://twsnzfzjtjdamwwembzp.supabase.co';
   const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sua_chave_fallback';
   
   if (!supabaseUrl || !supabaseAnonKey) {
     throw new Error('Variáveis de ambiente do Supabase não configuradas');
   }
   
   export const supabase = createClient(supabaseUrl, supabaseAnonKey);
   ```

3. **Reinicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   # ou
   pnpm dev
   ```

### Solução 3: Verificar Configurações do Supabase

1. **CORS no Supabase:**
   - Settings > API > CORS Origins
   - Adicione sua URL de desenvolvimento: `http://localhost:5173` (ou a porta que você usa)

2. **Row Level Security (RLS):**
   - Verifique se as políticas RLS não estão bloqueando as requisições
   - Para desenvolvimento, pode ser necessário desabilitar temporariamente

### Solução 4: Verificar Console do Navegador

1. Abra o DevTools (F12)
2. Vá na aba Network
3. Tente fazer uma requisição
4. Veja o erro detalhado na requisição que falhou

### Solução 5: Testar Conexão Manualmente

Execute no console do navegador:
```javascript
const testSupabase = async () => {
  try {
    const response = await fetch('https://twsnzfzjtjdamwwembzp.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3c256ZnpqdGpkYW13d2VtYnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMDczODEsImV4cCI6MjA4Mjg4MzM4MX0.EFmjLPT_Mnl4cv2qcH5vq5_zmo47fGWFjQdGGwidsNY',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3c256ZnpqdGpkYW13d2VtYnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMDczODEsImV4cCI6MjA4Mjg4MzM4MX0.EFmjLPT_Mnl4cv2qcH5vq5_zmo47fGWFjQdGGwidsNY'
      }
    });
    console.log('Status:', response.status);
    console.log('OK:', response.ok);
  } catch (error) {
    console.error('Erro:', error);
  }
};

testSupabase();
```

## Próximos Passos

1. Verifique se o problema é temporário (aguarde alguns minutos e tente novamente)
2. Verifique as credenciais no painel do Supabase
3. Teste a conexão manualmente
4. Verifique o console do navegador para erros mais detalhados
5. Se o problema persistir, entre em contato com o suporte do Supabase
