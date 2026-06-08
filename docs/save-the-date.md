# Save the Date

Módulo para avisar os convidados da **data** do casamento — com uma arte
(imagem ou PDF) e uma mensagem curta — **antes** do convite formal. Rota:
`/dashboard/save-the-date`.

## Visão geral

1. **Configuração** (`EventSettings`):
   - `weddingWebsiteUrl` — Site dos noivos (link externo, ex.: Wedy).
   - `giftRegistryUrl` — Lista de presentes (link externo).
   - `saveTheDateMessage` — mensagem com variáveis (merge tags).
   - `saveTheDateFilePath` / `saveTheDateFileMime` / `saveTheDateFileName` — a
     arte, salva via [src/lib/storage.ts](../src/lib/storage.ts) (mesmo cofre de
     `uploads/`, ownerType `SAVE_THE_DATE`).
2. **Mensagem** — template `SAVE_THE_DATE` em
   [src/lib/notifications/templates.ts](../src/lib/notifications/templates.ts).
   Variáveis substituídas por destinatário: `{nomes}`, `{convidados}`, `{data}`,
   `{local}`. Sem mensagem custom, usa o texto padrão i18n
   (`notifications.SAVE_THE_DATE`). As linhas de **site** e **lista de
   presentes** são anexadas automaticamente quando preenchidas.
3. **Anexo** — a arte vai como **anexo** no WhatsApp (imagem com legenda ou
   documento PDF) e no e-mail (imagem inline via `cid`, ou PDF anexado). Ver
   `sendWhatsApp(phone, text, media?)` e o passthrough `media` em `notify()`.
4. **Destinatários** — uma mensagem por **grupo** (telefone/e-mail do grupo,
   citando os integrantes) + uma por **convidado avulso** (sem `groupId`).
   Quando o grupo **não tem** `contactPhone`/`contactEmail`, cai automaticamente
   para o telefone/e-mail do **primeiro integrante** que tiver (fallback) — assim
   uma família cujo contato ficou só no convidado ainda é alcançada. Telefones
   repetidos entre grupo e avulso são pulados. Telefone fora do formato enviável
   (`+` seguido de 10–15 dígitos) **não** entra como WhatsApp: cai para e-mail se
   houver, senão o destinatário fica `SKIPPED` com motivo `INVALID_PHONE` (a
   pré-lista reflete a realidade do envio). Lógica pura e testável em
   [src/lib/notifications/recipients.ts](../src/lib/notifications/recipients.ts).
   Motivos de skip: `EXCLUDED_TAG`, `ALREADY_SENT`, `DUPLICATE_PHONE`,
   `INVALID_PHONE`, `NO_CONTACT`.
5. **Envio em massa** — fila persistida (`Broadcast` + `BroadcastRecipient`)
   processada por um worker em processo com **throttle** anti-bloqueio.

## Fila e worker

- `Broadcast` (`kind = "SAVE_THE_DATE"`, `status` DRAFT|SENDING|PAUSED|DONE|CANCELLED)
  e `BroadcastRecipient` (`status` PENDING|SENT|FAILED|SKIPPED).
- Worker: [src/lib/notifications/broadcast-worker.ts](../src/lib/notifications/broadcast-worker.ts)
  — `setInterval` (mesmo padrão do watchdog do WhatsApp), processa **1**
  destinatário por tick a cada `BROADCAST_INTERVAL_MS` (env, padrão `4000`).
  Retomável: após restart só pega os `PENDING` (rearmado em
  [src/instrumentation.ts](../src/instrumentation.ts)).
- Backstop por cron: `GET /api/cron/broadcast` (header
  `Authorization: Bearer ${CRON_SECRET}`, timing-safe + rate limit) drena um
  lote pequeno com delay — útil se o servidor reiniciar sem UI aberta.

## Server Actions

[src/app/actions/saveTheDateActions.ts](../src/app/actions/saveTheDateActions.ts)
(todas exigem papel ADMIN/GROOM/BRIDE via `denyIfNoManage`):

- `saveSaveTheDateConfig` — salva links/mensagem e faz upload da arte
  (validação de MIME + magic bytes + 10 MB).
- `sendTestSaveTheDate({ channel })` — envia só para o próprio usuário
  (WhatsApp ou e-mail), com a arte.
- `startSaveTheDateBroadcast` — monta os destinatários, cria o `Broadcast` e
  arma o worker. Bloqueia se já houver envio em andamento.
- `getSaveTheDateBroadcastProgress` / `getActiveSaveTheDateBroadcast` — progresso
  (polling na UI).
- `resendFailedSaveTheDate` / `cancelSaveTheDateBroadcast`.

## Pré-requisitos e limites

- Defina **data** e **nomes do casal** (onboarding) antes de enviar.
- Telefones precisam de código do país (`+5511999990000`) para o WhatsApp; sem
  telefone válido, cai no e-mail; sem nenhum, o destinatário fica `SKIPPED`.
- Arte: PNG, JPG, WEBP ou PDF, até 10 MB.
- A arte é servida (preview na UI) por `GET /api/save-the-date/art` (autenticado).

## Iteração 2 — refinamentos

- **Exclusão por tag/padrinho**: `EventSettings.saveTheDateExcludeTagIds` (JSON de
  IDs de `GuestTag`) + `saveTheDateExcludePadrinhos` (Boolean). Regra **ANY**: um
  grupo é excluído se **qualquer** integrante tiver a tag/flag; avulso, se ele
  próprio tiver. Aplicada em `buildSaveTheDateRecipients(..., { excludeTagIds,
  excludePadrinhos })`.
- **Variáveis de link**: `{site}` → site dos noivos; `{site-presentes}` → lista de
  presentes. Quando usadas no corpo, entram inline; quando não, são anexadas ao
  fim (compatível). Helpers puros em
  [src/lib/notifications/std-message.ts](../src/lib/notifications/std-message.ts)
  (`interpolateBaseTags`, `applySiteTags`) — compartilhados por template e preview.
- **Teste para outro contato**: `sendTestSaveTheDate` aceita `to` (telefone `+55…`
  ou e-mail); vazio = próprio usuário.
- **E-mail sem branding**: no kind `SAVE_THE_DATE`, `wrapHtml` recebe cabeçalho =
  nomes do casal e rodapé vazio (sem "Wedding Finance" / "mensagem automática").
- **Pré-lista**: `getSaveTheDateRecipients()` devolve quem vai receber (canal +
  status) — renderizada em "Quem vai receber".
- **Não reenviar**: toggle `skipAlreadySent` em `startSaveTheDateBroadcast` —
  coleta `refId`s já `SENT` em broadcasts `SAVE_THE_DATE` e os pula.
- **Lista detalhada + CSV**: `getSaveTheDateBroadcastRecipients(broadcastId)` +
  exportação CSV na UI.
- **Normalização de telefone**: `normalizeMsisdn` (em `std-message.ts`) completa
  `+55` para números BR sem DDI e **preserva** qualquer número que já comece com
  `+` (ex.: `+1`, `+34`). Aplicada ao montar destinatários (o número normalizado
  é gravado em `BroadcastRecipient.phone`).
