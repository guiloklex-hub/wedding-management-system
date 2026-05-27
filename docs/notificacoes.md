# 📨 Notificações (Email + WhatsApp)

O Wedding Finance Planner envia lembretes e avisos por **dois canais**
independentes que funcionam em paralelo: **email (SMTP via Nodemailer)** e
**WhatsApp (Baileys embutido)**.

## Locale do destinatário (i18n)

Cada notificação é renderizada no idioma do destinatário (`User.locale`)
desde a v0.5.0. Os templates em
[src/lib/notifications/templates.ts](../src/lib/notifications/templates.ts)
são **async** e recebem `locale: Locale` em cada variante de
`RenderInput`. O orquestrador `notify()` aceita `target.locale` opcional;
quando não passado, usa `EventSettings.defaultLocale`.

**Importante:** dentro do template **nunca** chame `getLocale()` do
next-intl. Em cron jobs e webhooks, ele retorna o default porque não há
request lifecycle do destinatário. Sempre propague o locale lido do
banco. Veja [i18n.md](i18n.md) para o padrão completo.

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
| `GUEST_RSVP` | Convidado responde o RSVP (individual ou de grupo) | ✅ (gestores/noivos) | ✅ |
| `SYSTEM_WHATSAPP_DOWN` | Conexão WhatsApp caiu por > ~1 min, ou exige novo QR | ✅ (admins) | — |
| `SYSTEM_WHATSAPP_RECOVERED` | Conexão WhatsApp voltou após queda já avisada | ✅ (admins) | — |

`GUEST_RSVP` vai para todos os usuários ativos com role `ADMIN`/`GROOM`/`BRIDE`/`PLANNER`
(reusa o mesmo conjunto do cron de lembretes). É **best-effort** e **deduplicado por dia**
por `refId` (o convidado/grupo só gera uma notificação por dia, mesmo reabrindo o link).
O disparo é em `notifyRsvpResponse` ([src/lib/notifications/rsvp.ts](../src/lib/notifications/rsvp.ts)),
chamado por `publicRsvpRespond` e `publicRsvpRespondForGroup`.

Cada envio é registrado em `NotificationLog`:
- `status` = `SENT` | `FAILED`
- `errorMsg` em caso de falha
- `kind` + `refType` + `refId` permitem **idempotência por dia** (um pagamento
  X nunca recebe duas notificações `PAYMENT_DUE` no mesmo dia).

### Diagnóstico de envios (Ajustes › Notificações)

Gestores (ADMIN/GROOM/BRIDE) veem em **Ajustes › Notificações** os últimos 50 envios
(`NotificationLog`) com tipo, canal, destinatário, `status` (SENT/FAILED) e a mensagem de
erro do SMTP. Use isso para diagnosticar, por exemplo, falhas recorrentes quando o admin
ainda está com o e-mail placeholder `admin@admin.com` do seed — troque o e-mail em
**Ajustes › Time** (qualquer usuário) ou em **Perfil** (o seu, com confirmação de senha).

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

### Auto-ressurect e alertas por email

A integração sobe sozinha junto com o servidor (hook
[`src/instrumentation.ts`](../src/instrumentation.ts) do Next.js 16). Se a
conexão cair, o socket é reiniciado em **back-off exponencial**: 3s, 6s, 12s,
24s, 48s e teto de 60s. Um **watchdog** roda a cada 60s e força o restart se
algum erro inesperado interromper a cadeia de reconexão.

Além disso, **os admins ativos recebem email automaticamente** quando:

- A conexão fica fora do ar por mais de ~1 minuto (≥ 3 tentativas falhas
  consecutivas) — assunto começa com `🔌 WhatsApp instável`.
- O WhatsApp pede um novo QR Code (sessão expirada/invalidada) — assunto
  começa com `⚠ Ação necessária`.
- A sessão é desvinculada do celular (logout) — também `⚠ Ação necessária`.
- A conexão **volta** após uma queda já alertada — assunto `✅ WhatsApp voltou`.

Anti-spam: cada queda gera no máximo **1 email DOWN por dia** (idempotência
via `NotificationLog` + cooldown de 30 min em memória) e **1 email RECOVERED
por dia**, e somente se houve um DOWN antes no mesmo dia.

Variável de ambiente opcional `WHATSAPP_AUTOSTART="false"` desliga o autostart
(útil em dev).

## Cron de lembretes

Os lembretes recorrentes (`PAYMENT_DUE`, `PAYMENT_OVERDUE`, `TASK_*`) são
disparados pelo endpoint:

```
GET /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

Não há scheduler embutido — você precisa configurar **um cron externo** que
chame esse endpoint periodicamente (sugestão: a cada 30 minutos).

### Como o endpoint executa

Para evitar serializar dezenas de queries em loop, o handler:

1. Dispara **uma única `Promise.all`** com seis queries paralelas: lista de
   destinatários (`users` ativos com role notificável), idempotência
   batched (`loadNotifiedTodaySet` agrega um `findMany` por kind+refId+refType
   no `NotificationLog` do dia) e os quatro recortes de pagamentos/tarefas
   (vencendo, vencidos × payments, tasks).
2. Para cada item, consulta o `Set` de já-notificados — **sem ida ao banco
   por iteração**.
3. Envios para cada destinatário rodam em **`Promise.all`** dentro do mesmo
   evento. Antes era serial (`for ... await`), o que multiplicava latência
   por número de destinatários.

### Fuso horário consistente

A janela de "hoje" usa o helper `startOfTodayBRT()` em
[src/lib/notifications/log.ts](../src/lib/notifications/log.ts) — UTC-3,
sem depender do timezone do processo Node. O cron e a função
`wasNotifiedToday` usam **a mesma origem de "início do dia"**, então a
idempotência não vaza entre dias mesmo se o servidor estiver em UTC.

> Antes do hardening, `wasNotifiedToday` usava `new Date().setHours(0,…)`
> (timezone local do processo) enquanto o cron já operava em BRT — janelas
> deslocadas podiam disparar lembrete duplicado ao virar dia em UTC.

### Linux/macOS — crontab

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3005/api/cron/reminders >> /var/log/wedding-cron.log 2>&1
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
