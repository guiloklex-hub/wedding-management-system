# 📨 Notificações (Email + WhatsApp)

O Wedding Finance Planner envia lembretes e avisos por **dois canais**
independentes que funcionam em paralelo: **email (SMTP via Nodemailer)** e
**WhatsApp (Baileys embutido)**.

## Eventos notificados

| Evento | Quando dispara | Email | WhatsApp |
|---|---|---|---|
| `ACCOUNT_CREATED` | Admin cria conta de outro usuário | ✅ | ✅ |
| `PASSWORD_RESET` | Usuário pede reset (link expira em 60 min) | ✅ | ✅ |
| `PASSWORD_RESET_BY_ADMIN` | Admin redefine senha de outro usuário | ✅ | ✅ |
| `PAYMENT_DUE` | Pagamento vence em até 3 dias | ✅ | ✅ |
| `PAYMENT_OVERDUE` | Pagamento já passou da data | ✅ | ✅ |
| `TASK_DUE` | Tarefa vence em até 2 dias | ✅ | ✅ |
| `TASK_OVERDUE` | Tarefa já passou da data | ✅ | ✅ |

Cada envio é registrado em `NotificationLog`:
- `status` = `OK` | `ERROR`
- `errorMsg` em caso de falha
- `kind` + `refType` + `refId` permitem **idempotência por dia** (um pagamento
  X nunca recebe duas notificações `PAYMENT_DUE` no mesmo dia).

## Configuração SMTP

Pode ser feita em duas formas:

### Via `.env` (recomendado)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false           # true para porta 465
SMTP_USER=seu@gmail.com
SMTP_PASS=sua-app-password  # NÃO use a senha normal do Gmail
SMTP_FROM="\"Wedding Finance\" <noreply@seudominio.com>"
APP_URL=https://seu.dominio  # usado para montar links em emails
```

### Via interface

Acesse **Ajustes › Casamento** — botão "Configurar SMTP".

### Como gerar App Password no Gmail

1. Ative verificação em 2 etapas em
   <https://myaccount.google.com/security>.
2. Crie a app password em <https://myaccount.google.com/apppasswords>.
3. Use a senha de 16 caracteres gerada em `SMTP_PASS`.

> ⚠️ **Não** funciona com a senha normal da conta. Google exige App Password
> para clientes SMTP desde 2022.

### Provedores alternativos

| Provedor | Host | Porta | Notas |
|---|---|---|---|
| Gmail | smtp.gmail.com | 587 | precisa App Password |
| Outlook/Office 365 | smtp.office365.com | 587 | basic auth costuma estar desativado — use OAuth ou SMTP relay |
| SendGrid | smtp.sendgrid.net | 587 | username = `apikey` |
| Amazon SES | email-smtp.us-east-1.amazonaws.com | 587 | gerar credenciais SMTP no console |
| Mailgun | smtp.mailgun.org | 587 | usar domínio sandbox para testes |

## Conectando WhatsApp

> 💡 Importante: o sistema usa **Baileys**, um cliente WhatsApp Web não
> oficial. Ele **abre uma sessão paralela à do seu celular** (semelhante a
> usar WhatsApp Web). Não é WhatsApp Business API.

### Passos

1. Acesse `/dashboard/settings` logado como **ADMIN**.
2. Aba **WhatsApp** → botão **Conectar**.
3. Aparece um **QR Code** na tela.
4. No celular: WhatsApp → Configurações → Aparelhos conectados → Conectar um
   aparelho → escanear o QR.
5. Status muda para **Conectado (+55 11 9XXXX-XXXX)**.
6. Sessão fica salva em `./.whatsapp-auth/` (gitignored — não commitar).

### Enviar teste

Botão **Enviar teste** dispara uma mensagem para o número do próprio admin.

### Reconectar

Se a sessão expirar (acontece a cada algumas semanas, ou se você desconectar do
celular), repita os passos acima. O sistema continua funcionando — apenas o
WhatsApp para de enviar até reconectar.

## Cron de lembretes

Os lembretes recorrentes (`PAYMENT_DUE`, `PAYMENT_OVERDUE`, `TASK_*`) são
disparados pelo endpoint:

```
GET /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

Não há scheduler embutido — você precisa configurar **um cron externo** que
chame esse endpoint periodicamente (sugestão: a cada 30 minutos).

### Linux/macOS — crontab

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3005/api/cron/reminders >> /var/log/wfv-cron.log 2>&1
```

### Windows — Agendador de Tarefas

Veja a seção 8 de [instalacao-windows.md](instalacao-windows.md).

### Segurança

- Comparação do Bearer token usa `timingSafeEquals`
  ([src/lib/timing-safe.ts](../src/lib/timing-safe.ts)).
- Gere o secret com:
  - `openssl rand -hex 32` (Linux/Mac)
  - `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (qualquer)

## Templates

Templates de email vivem em [src/lib/notifications/templates.ts](../src/lib/notifications/templates.ts)
(ou diretório similar). Para alterar visual/copy, edite lá. **Sempre passe
dados de usuário por um helper de escape de HTML** quando montar emails — XSS
em emails é vetor real (alguns clientes renderizam HTML).

## Solução de problemas

Veja [troubleshooting.md](troubleshooting.md).

### Email não chega

1. Verifique `NotificationLog` no banco (`npm run db:studio`).
2. Confirme que `SMTP_*` estão setadas (`Settings › Casamento`).
3. Para Gmail: confirme que é uma **App Password**, não a senha normal.
4. Tente um **Enviar teste** em Ajustes (recurso futuro — por enquanto:
   crie uma tarefa com deadline em 1 minuto e rode o cron).

### WhatsApp não envia

1. Status em Ajustes → WhatsApp mostra "Conectado"? Se não, reconecte.
2. O telefone primário do destinatário tem WhatsApp? Sem WhatsApp, falha em
   silêncio (mas grava `NotificationLog`).
3. Não use o **mesmo número** para enviar e receber — Baileys rejeita.

### Idempotência confusa

Se o mesmo lembrete não chega: verifique se `NotificationLog` já tem entrada
de sucesso para hoje. Se sim, foi pulado por design.
