# 🛠️ Solução de Problemas

Erros comuns e como resolvê-los. Antes de abrir uma issue, dê uma olhada aqui.

---

## Instalação

### `./setup.sh: Permission denied`

```bash
chmod +x setup.sh
./setup.sh
```

### `node: command not found`

Você ainda não instalou o Node 20+. Veja:

- [Linux](instalacao-linux.md#1-pré-requisitos)
- [Windows](instalacao-windows.md#1-instalar-nodejs-20)
- [WSL](instalacao-wsl.md#3-instalar-node-20-com-nvm)

### `Node.js X detectado. Este projeto requer Node 20 ou superior.`

Atualize via `nvm install 20` (Linux/macOS/WSL) ou pelo instalador oficial
(Windows). Confirme com `node -v`.

### `Set-ExecutionPolicy : Access denied` (Windows)

Política bloqueada por GPO. Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Sem mudar a política do sistema.

### `npm install` trava em pacote nativo

Se um pacote precisa compilar binários (em geral o `sharp`, `node-canvas`,
`bcrypt`):

- **Windows:** instale "Visual Studio Build Tools" — `winget install Microsoft.VisualStudio.2022.BuildTools` e marque "Desenvolvimento para desktop com C++".
- **Linux:** `sudo apt install build-essential python3`.
- **macOS:** `xcode-select --install`.

> 💡 Este projeto usa `bcryptjs` (puro JS), não `bcrypt` (nativo). Em
> teoria não precisa de toolchain C++.

---

## Banco de dados

### `Error: SQLITE_BUSY: database is locked`

Algum outro processo está com o banco aberto. Geralmente:
- Prisma Studio rodando em outra aba — feche.
- Servidor `next dev` antigo ainda vivo — mate com `kill` ou
  `Stop-Process`.

### `Error: Schema is not in sync`

Você editou `schema.prisma` e esqueceu de aplicar. Rode:

```bash
npx prisma db push --skip-generate
npx prisma generate
```

### `Error: Migration failed`

Esse projeto não usa migrations. Se você rodou `prisma migrate dev` por
acidente, ignore — o `db push` é a fonte de verdade.

### Schema mudou e quero zerar o banco

```bash
./setup.sh --reset-db
```

⚠️ Apaga **todos os dados**.

---

## Login

### "Credenciais inválidas" no primeiro login

- Use exatamente `admin@admin.com` e a senha do `ADMIN_PASSWORD` no `.env`
  (padrão: `admin`).
- Confira que o seed rodou: `npm run db:seed`.
- Verifique no Prisma Studio se o usuário existe:
  `User where email = "admin@admin.com"`.

### Loop infinito entre `/login` e `/dashboard`

Sintoma: você loga, é redirecionado pro dashboard, e volta pro login.

Causa comum: cookie de sessão não está sendo aceito pelo navegador.
- `NEXTAUTH_URL` está com `https` mas o servidor está em `http`?
- Você está atrás de proxy mas `AUTH_TRUST_HOST` não está `true`?
- Cookies de terceiros bloqueados? (não deveria afetar same-site)

Tente:
1. Apagar todos os cookies do domínio.
2. Recarregar e logar.
3. Verificar Network → resposta do `/api/auth/callback/credentials`.

### Esqueci a senha do admin

Sem SMTP configurado? Você pode resetar via banco:

```bash
node -e "
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('novaSenhaForte', 10);
  await p.user.update({ where: { email: 'admin@admin.com' }, data: { password: hash, mustChangePassword: true } });
  console.log('Senha redefinida');
  process.exit(0);
})();
"
```

---

## Onboarding (wizard)

### Stuck no `/dashboard/onboarding`

- Confirme que está logado como **ADMIN** (`User.role = 'ADMIN'`).
- Reload da página depois de completar — o JWT é atualizado via
  `update()`.
- Se persistir: limpar cookies e relogar.

### Quero re-executar o wizard

Limpe `onboardingCompletedAt`:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.eventSettings.update({ where: { id: 'singleton' }, data: { onboardingCompletedAt: null } });
  process.exit(0);
})();
"
```

Próximo login do admin abre o wizard de novo.

---

## Notificações

### Email não chega

1. **Verifique `NotificationLog`** no Prisma Studio. `status = OK`?
   Provavelmente foi enviado, problema é caixa de entrada/spam.
2. `status = ERROR`? Olhe `errorMsg`.
3. **Gmail:** confirme que `SMTP_PASS` é uma **App Password** (16
   caracteres, não a senha normal).
4. **Office 365:** SMTP basic costuma estar bloqueado. Use SendGrid ou
   Amazon SES como relay.

### WhatsApp não envia

1. Status em **Ajustes › WhatsApp** mostra "Conectado"?
   - Se não, escaneie de novo.
2. Sessão expirou? Acontece após algumas semanas, ou se você desconectou
   do celular. Reconecte.
3. Destinatário tem WhatsApp ativo no telefone cadastrado?
4. Não tente usar o **mesmo número** do remetente como destinatário —
   Baileys rejeita.

### Cron não dispara nada

- Confirme que o crontab está rodando: `systemctl status cron` (Linux).
- Teste manual:
  ```bash
  curl -v -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3005/api/cron/reminders
  ```
- 401? Bearer errado. 200 com `sent: 0`? Não há pagamentos/tarefas no
  range.

---

## WhatsApp (Baileys)

### "Stream errored: PreReplaceCount...", "Connection terminated"

Eventualmente Baileys reconecta sozinho. Se persistir:

```bash
rm -rf .whatsapp-auth/
pm2 restart wfv-management-system
# acessar Ajustes › WhatsApp e escanear de novo
```

Você precisará escanear o QR novamente.

### Mensagens demorando para chegar

Baileys envia em sequência com pequeno delay. Para volume alto, considere
migrar para WhatsApp Cloud API (paga, mas oficial e mais robusta).

---

## Performance

### Página demorando

- SQLite com poucos índices em queries grandes: aceite, ou ative WAL mode
  (`PRAGMA journal_mode=WAL`).
- Reload completo a cada navegação? `revalidatePath()` é amplo demais —
  ajuste para `revalidatePath('/dashboard/X')`.

### `next dev` lento na primeira navegação

Normal — Next.js compila sob demanda em dev. Use `npm run build && npm run start`
para sentir a velocidade real.

---

## Build / Deploy

### `Module not found: Can't resolve '@prisma/client'`

Rode `npx prisma generate` para gerar o client.

### `Type error: Cannot find module ...`

Geralmente algum import desatualizado depois de mudar schema. Rode
`npx prisma generate` e reinicie o `next dev`.

### `Error: dynamic = 'force-dynamic' is not assignable to ...`

Você está exportando `dynamic` em um arquivo que não é uma página/route
handler. Mova para a Page/Route correspondente.

### Build trava em "Linting and checking validity of types"

Verifique erros de tipo: `npx tsc --noEmit`. Corrija os reportados.

---

## Tailwind 4

### "Class não está sendo aplicada"

Tailwind 4 não tem mais `tailwind.config.js`. Tokens customizados via
`@theme` em [src/app/globals.css](../src/app/globals.css). Se você adicionou
algo novo:

```css
@theme {
  --color-rose-custom: #ff0066;
}
```

E use como `bg-rose-custom`. Faça hot reload.

---

## Reportar bug

Se nada aqui resolveu:

1. Reproduza o problema em ambiente limpo (`./setup.sh --reset-db`).
2. Anote: SO, versão do Node, versão do projeto (`git rev-parse HEAD`),
   comandos exatos, erro completo.
3. Abra issue em GitHub seguindo o template.
