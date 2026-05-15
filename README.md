This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Notificações (Email + WhatsApp)

O sistema envia notificações por **email (SMTP via Nodemailer)** e **WhatsApp
(Baileys embutido)**. Os dois canais funcionam em paralelo sempre que o
usuário tiver email e telefone cadastrados.

### Eventos notificados

- `ACCOUNT_CREATED` — admin cria conta, envia credenciais ao novo usuário.
- `PASSWORD_RESET` — fluxo de "esqueci minha senha" (link expira em 60 min).
- `PASSWORD_RESET_BY_ADMIN` — admin redefine senha de outro usuário.
- `PAYMENT_DUE` / `PAYMENT_OVERDUE` — pagamentos próximos do vencimento (até 3
  dias) e atrasados.
- `TASK_DUE` / `TASK_OVERDUE` — tarefas próximas do deadline (até 2 dias) e
  atrasadas.

Cada envio é registrado em `NotificationLog` (sucesso ou falha + mensagem
de erro). Lembretes recorrentes são idempotentes por dia: um pagamento `X`
nunca recebe duas notificações `PAYMENT_DUE` no mesmo dia.

### Configuração SMTP

Defina no `.env`:

```bash
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM="\"Wedding Finance\" <noreply@dominio.com>"
APP_URL="https://seu.dominio"   # usado para montar links em emails/WhatsApp
```

### Conectando WhatsApp

1. Acesse `/dashboard/settings` como **ADMIN**.
2. Aba **WhatsApp** → botão **Conectar**.
3. Escaneie o QR Code que aparece na tela com o app do WhatsApp do número
   que vai disparar mensagens (WhatsApp → Configurações → Aparelhos
   conectados → Conectar um aparelho).
4. Status muda para `Conectado (<número>)`. A sessão fica persistida em
   `./.whatsapp-auth/` (já no `.gitignore`).
5. Use **Enviar teste** para validar.

### Cron de lembretes

Endpoint: `GET /api/cron/reminders` — protegido por
`Authorization: Bearer ${CRON_SECRET}` (comparação timing-safe).

Recomendado rodar a cada 30 minutos via crontab do servidor:

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer SEU_SECRET" \
  http://localhost:3005/api/cron/reminders >> /var/log/wfv-cron.log 2>&1
```

Gere o secret com `openssl rand -hex 32` e coloque em `CRON_SECRET` no `.env`.

## Conta de usuário

O cadastro público foi removido. **Somente admins criam contas** em
`/dashboard/settings` → **Time** → **Novo usuário**. O sistema gera uma senha
temporária, envia por email e/ou WhatsApp para o novo usuário e exige a
troca no primeiro login.

Esqueceu a senha? Acesse `/forgot-password` e o link de redefinição é enviado
por email e WhatsApp simultaneamente (quando ambos os contatos existem).

