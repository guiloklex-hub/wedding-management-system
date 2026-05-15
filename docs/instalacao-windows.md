# 🪟 Instalação em Windows nativo (sem WSL)

Guia para usar o Wedding Finance Planner em Windows 10 ou 11 **sem precisar do
WSL**. Tudo roda em PowerShell.

> 💡 Se você prefere ambiente Linux dentro do Windows, veja
> [instalacao-wsl.md](instalacao-wsl.md). Ambos funcionam — escolha o que for
> mais confortável.

> ⏱️ Tempo total: 10 a 15 minutos (incluindo a instalação do Node).

---

## 1. Instalar Node.js 20+

### Opção A — via instalador oficial (mais simples)

1. Baixe o **LTS** em <https://nodejs.org/>
2. Execute o `.msi` e clique **Next** até concluir.
3. Abra um **PowerShell novo** e confirme:
   ```powershell
   node --version   # esperado: v20.x.x ou superior
   npm --version
   ```

### Opção B — via winget (Windows 11)

```powershell
winget install OpenJS.NodeJS.LTS
```

> ⚠️ Se aparecer `node não é reconhecido como comando`, feche e reabra o
> PowerShell. Se persistir, reinicie o Windows.

---

## 2. Instalar o Git

Se ainda não tem:

```powershell
winget install Git.Git
```

Ou baixe em <https://git-scm.com/download/win>.

---

## 3. Clone o projeto

Abra o **PowerShell** (não precisa ser Admin) na pasta onde quer guardar o
projeto (ex.: `C:\Projetos`):

```powershell
cd C:\Projetos
git clone https://github.com/SEU_USUARIO/wfv-management-system.git
cd wfv-management-system
```

---

## 4. Permitir scripts do PowerShell

O Windows bloqueia scripts `.ps1` por padrão. Libere apenas para o seu usuário
(seguro e revogável):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Quando perguntar, responda **Y** (Sim).

> 🔒 Se preferir não mudar a política, pule este passo e rode o setup com:
> ```powershell
> powershell -ExecutionPolicy Bypass -File .\setup.ps1
> ```

---

## 5. Rode o setup automatizado

```powershell
.\setup.ps1
```

O script:

1. ✅ Verifica Node 20+
2. ✅ Cria um `.env` com `NEXTAUTH_SECRET` e `CRON_SECRET` aleatórios
3. ✅ Roda `npm install`
4. ✅ Aplica o schema (`prisma db push`)
5. ✅ Gera o Prisma Client
6. ✅ Roda o seed

### Opções do script

| Comando | Função |
|---|---|
| `.\setup.ps1` | Setup completo para desenvolvimento |
| `.\setup.ps1 -Prod` | Setup de produção + build + PM2 |
| `.\setup.ps1 -ResetDb` | Apaga o banco SQLite local |
| `.\setup.ps1 -SkipDeps` | Não roda `npm install` |
| `.\setup.ps1 -SkipSeed` | Não roda o seed |

---

## 6. Inicie o servidor

```powershell
npm run dev
```

Abra <http://localhost:3005> no navegador.

---

## 7. Primeiro acesso

1. Faça login com **admin@admin.com** / **admin**.
2. Defina uma nova senha.
3. Preencha o **Assistente de Configuração** (nomes, data, moeda, contingência).
4. Pronto! Bem-vindo(a) ao Dashboard.

---

## 8. (Opcional) Cron de lembretes no Windows

O Windows usa o **Agendador de Tarefas** em vez do crontab.

1. Abra **Agendador de Tarefas** (procurar no menu Iniciar).
2. **Criar Tarefa…**
3. **Geral:** dê um nome (ex.: `Wedding Finance Reminders`) e marque
   "Executar mesmo se o usuário não estiver conectado".
4. **Disparadores:** novo → "Diariamente" → "Repetir tarefa a cada: 30 minutos
   por um período de: 1 dia".
5. **Ações:** novo → "Iniciar um programa":
   - **Programa/script:** `powershell.exe`
   - **Argumentos:** `-Command "Invoke-WebRequest -Uri 'http://localhost:3005/api/cron/reminders' -Headers @{'Authorization'='Bearer SEU_CRON_SECRET'} -UseBasicParsing | Out-Null"`
6. Salve. Pronto.

> Substitua `SEU_CRON_SECRET` pelo valor de `CRON_SECRET` no `.env`.

---

## 9. (Opcional) Rodar como serviço Windows

Para que o app inicie automaticamente com o Windows:

### Via PM2 + pm2-windows-service

```powershell
npm install -g pm2 pm2-windows-service
pm2-service-install
.\setup.ps1 -Prod   # build + pm2 start
pm2 save
```

### Via NSSM (alternativa simples)

1. Baixe **NSSM** em <https://nssm.cc/download>.
2. `nssm install WeddingFinance`
3. Configure:
   - **Path:** `C:\Program Files\nodejs\npm.cmd`
   - **Arguments:** `start`
   - **Startup directory:** `C:\Projetos\wfv-management-system`
4. Inicie: `nssm start WeddingFinance`.

---

## 10. Atualizar o projeto

```powershell
git pull
.\setup.ps1 -SkipSeed
```

---

## Problemas comuns no Windows

Veja [troubleshooting.md](troubleshooting.md) (seção Windows).

- **`Set-ExecutionPolicy` bloqueado por GPO empresarial:** use o `-ExecutionPolicy Bypass`.
- **`bcrypt` falhando no install:** o projeto usa `bcryptjs` (puro JS), então
  não há binário nativo para compilar — não deveria dar problema. Se der, rode
  `npm install --no-optional` e abra uma issue.
- **Porta 3005 já em uso:** mude em `package.json` (scripts `dev` e `start`).
