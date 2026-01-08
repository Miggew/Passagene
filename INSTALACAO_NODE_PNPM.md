# 📦 Guia de Instalação - Node.js e pnpm

## Problema
O comando `pnpm` não é reconhecido porque o pnpm não está instalado no seu sistema.

---

## 🔧 Solução: Instalar Node.js e pnpm

### Opção 1: Instalação Rápida (Recomendada)

#### Passo 1: Instalar Node.js
1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (Long Term Support) - recomendada
3. Execute o instalador
4. Durante a instalação, marque a opção **"Add to PATH"** (adicionar ao PATH)
5. Conclua a instalação

#### Passo 2: Verificar Instalação
Abra um **novo** PowerShell e execute:

```powershell
node --version
npm --version
```

Deve mostrar as versões instaladas.

#### Passo 3: Instalar pnpm
No PowerShell, execute:

```powershell
npm install -g pnpm
```

#### Passo 4: Verificar pnpm
```powershell
pnpm --version
```

Deve mostrar a versão do pnpm (ex: `8.10.0`).

---

### Opção 2: Instalar pnpm via Script (Alternativa)

Se você já tem Node.js instalado mas o pnpm não funciona:

#### Windows (PowerShell):
```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

Depois, **feche e reabra** o PowerShell.

---

## ✅ Após Instalação

### 1. Instalar Dependências do Projeto
No diretório do projeto, execute:

```powershell
cd C:\Users\Miguel\Desktop\PassaGene\Passagene
pnpm install
```

### 2. Iniciar a Aplicação
```powershell
pnpm dev
```

A aplicação deve iniciar em: `http://localhost:5173`

---

## 🐛 Problemas Comuns

### Erro: "pnpm não é reconhecido" após instalação
**Solução:**
1. Feche o PowerShell atual
2. Abra um **novo** PowerShell
3. Tente novamente

### Erro: "npm não é reconhecido"
**Solução:**
- Node.js não está instalado ou não está no PATH
- Reinstale o Node.js e marque "Add to PATH"

### Erro: "Permission denied" ao instalar pnpm
**Solução:**
Execute o PowerShell como **Administrador**:
1. Clique com botão direito no PowerShell
2. Selecione "Executar como administrador"
3. Execute: `npm install -g pnpm`

---

## 🔍 Verificar se Está Tudo OK

Execute estes comandos e todos devem funcionar:

```powershell
node --version    # Deve mostrar: v18.x.x ou v20.x.x
npm --version    # Deve mostrar: 9.x.x ou 10.x.x
pnpm --version   # Deve mostrar: 8.x.x ou 9.x.x
```

---

## 📝 Alternativa: Usar npm ao invés de pnpm

Se você não conseguir instalar o pnpm, pode usar npm:

```powershell
npm install
npm run dev
```

**Nota:** O projeto está configurado para usar pnpm, mas npm também funciona.

---

## 🆘 Ainda com Problemas?

Se nada funcionar, me informe:
1. Qual versão do Windows você está usando?
2. Você já tem Node.js instalado?
3. Qual erro exato aparece?

---

**Boa sorte! 🚀**
