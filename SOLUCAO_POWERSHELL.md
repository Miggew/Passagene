# 🔧 Solução: Política de Execução do PowerShell

## Problema
```
PSSecurityException: A execução de scripts foi desabilitada neste sistema
```

## ✅ Solução Rápida (Recomendada)

### Opção 1: Executar PowerShell como Administrador (Mais Seguro)

1. **Feche o PowerShell atual**

2. **Abra PowerShell como Administrador:**
   - Pressione `Win + X`
   - Selecione "Windows PowerShell (Admin)" ou "Terminal (Admin)"
   - OU clique com botão direito no PowerShell e escolha "Executar como administrador"

3. **Execute este comando:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

4. **Confirme digitando:** `S` e pressione Enter

5. **Agora instale o pnpm:**
   ```powershell
   npm install -g pnpm
   ```

6. **Verifique:**
   ```powershell
   pnpm --version
   ```

---

### Opção 2: Usar CMD (Prompt de Comando) ao invés de PowerShell

1. **Abra o CMD (Prompt de Comando):**
   - Pressione `Win + R`
   - Digite: `cmd`
   - Pressione Enter

2. **Execute:**
   ```cmd
   npm install -g pnpm
   ```

3. **Verifique:**
   ```cmd
   pnpm --version
   ```

**Vantagem:** CMD não tem restrições de política de execução.

---

### Opção 3: Alterar Política Temporariamente (Apenas para esta sessão)

No PowerShell atual, execute:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Depois execute:
```powershell
npm install -g pnpm
```

**Nota:** Esta mudança só vale para esta sessão do PowerShell.

---

## 🎯 Após Instalar o pnpm

### 1. Instalar Dependências do Projeto
```powershell
cd C:\Users\Miguel\Desktop\PassaGene\Passagene
pnpm install
```

### 2. Iniciar a Aplicação
```powershell
pnpm dev
```

---

## 📝 Explicação das Políticas

- **Restricted** (Padrão): Não permite executar scripts
- **RemoteSigned**: Permite scripts locais, mas scripts baixados precisam ser assinados
- **Bypass**: Remove todas as restrições (não recomendado)

**Recomendação:** Use `RemoteSigned` que é seguro e permite instalar pacotes npm.

---

## 🆘 Se Nada Funcionar

Use npm diretamente (sem pnpm):

```powershell
npm install
npm run dev
```

O projeto funcionará normalmente, apenas usando npm ao invés de pnpm.

---

**Boa sorte! 🚀**
