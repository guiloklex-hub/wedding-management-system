# Comunicações e Avisos

O menu **Comunicações** (`/dashboard/communications`) reúne tudo o que o casal
envia aos convidados:

| Módulo | Rota | Para quê |
|---|---|---|
| Save the Date | `/dashboard/communications/save-the-date` | Anunciar a data para todos ([save-the-date.md](save-the-date.md)) |
| Convites Oficiais | `/dashboard/communications/invitations` | Convite formal com PIN e RSVP ([invitations.md](invitations.md)) |
| **Avisos** | `/dashboard/communications/announcements` | Lembretes e informações com texto livre, para um público escolhido |

As rotas antigas `/dashboard/save-the-date` e `/dashboard/invitations`
redirecionam com 308 (`redirects()` em [next.config.ts](../next.config.ts)).
O hub mostra o status do último envio de cada módulo e as abas no topo
(`communications/layout.tsx`) permitem alternar entre eles.

## Avisos

Um aviso é uma mensagem livre — **nenhuma tag é obrigatória** — enviada a um
público filtrado. Caso típico: lembrar só os **confirmados** do horário e do traje.

### Histórico e rascunhos

- Cada aviso é um `Broadcast` com `kind = "ANNOUNCEMENT"` (sem tabela nova).
- "Novo aviso" cria na hora um `Broadcast` em `status = "DRAFT"` e abre o editor
  em `/announcements/[id]`. O worker só processa `SENDING`, então rascunhos
  nunca são enviados sozinhos.
- Ao enviar, o rascunho passa atomicamente de `DRAFT` para `SENDING`
  (`updateMany` filtrado por status). Depois disso o aviso é **somente leitura**;
  use **Duplicar** para reaproveitar (o anexo é copiado para o novo aviso).
- Status: `DRAFT` → `SENDING` → `DONE` (ou `CANCELLED`).

### Mensagem

Tags opcionais (mesmos significados do Save the Date):

| Tag | Valor |
|---|---|
| `{nomes}` | nomes do casal |
| `{convidados}` | integrantes da família que recebem o aviso (só os que batem com o filtro) |
| `{data}` | data do casamento por extenso, no idioma do destinatário |
| `{local}` | primeiro local cadastrado (pré-selecionados primeiro) |
| `{site}` / `{site-presentes}` | links do site e da lista de presentes |
| `{link-rsvp}` | link de RSVP (nativo ou externo, conforme a configuração dos convites) |
| `{pin}` | PIN do RSVP — se usado, famílias sem PIN ficam de fora (`NO_PIN`) |

- A substituição é feita numa única passada
  ([announcement-message.ts](../src/lib/notifications/announcement-message.ts)):
  valores inseridos não são reprocessados e tags desconhecidas ficam como texto
  (o editor mostra um aviso, mas não bloqueia).
- O **título** vira o assunto do e-mail e o nome no histórico; não vai no WhatsApp.
- Anexo opcional (PNG, JPG, WEBP ou PDF até 10 MB), validado por
  `validateArtFile` ([src/lib/art-upload.ts](../src/lib/art-upload.ts)) e salvo
  em `uploads/announcement/<id>/`. O caminho do arquivo é definido só pelo servidor.

### Público

O filtro é aplicado **convidado a convidado** e depois agrupado por família
([announcement-recipients.ts](../src/lib/notifications/announcement-recipients.ts)):

- **Status de RSVP** — Confirmados (padrão), Pendentes (`INVITED`), Talvez,
  Recusaram. `NOT_INVITED` nunca recebe.
- **Tags** — "somente quem tem" (qualquer uma) e "excluir quem tem". A exclusão
  vale por convidado (diferente do Save the Date, que exclui a família inteira).
- **Lado** — Noivo, Noiva, Ambos, Sem lado (nenhum marcado = todos).
- **Padrinhos** — incluir, somente padrinhos ou excluir padrinhos.
- **Ajuste manual** — checkbox por linha na pré-lista; as famílias desmarcadas
  ficam em `excludedRefs` no rascunho.

Regras de envio:

- **Uma mensagem por família** (`GuestGroup`), no contato do grupo, citando só
  os integrantes elegíveis. Família sem nenhum elegível não aparece.
- Contato da família: `contactPhone`/`contactEmail` do grupo → primeiro
  integrante elegível com contato → qualquer integrante. O contato do grupo
  recebe mesmo que a pessoa dona dele não bata com o filtro.
- Convidados avulsos recebem uma mensagem cada.
- Telefones/e-mails repetidos: vale o primeiro (grupos antes de avulsos).
- A pré-lista é calculada no navegador com a mesma função pura usada pelo
  servidor; no envio o servidor recalcula tudo a partir do banco.

### Canal

Escolhido por aviso ([channel-policy.ts](../src/lib/notifications/channel-policy.ts)):

| Canal | Comportamento | Fica de fora |
|---|---|---|
| WhatsApp com e-mail de reserva (padrão) | Tenta WhatsApp; se falhar ou não houver telefone, e-mail | sem telefone e sem e-mail |
| Somente WhatsApp | Só WhatsApp, sem fallback | sem telefone válido |
| Somente e-mail | Só e-mail | sem e-mail |

### Envio, fila e relatório

- O snapshot do evento (casal, data, local, links, modo de RSVP) é congelado no
  `payloadJson` do `Broadcast` no início; cada `BroadcastRecipient` guarda seus
  nomes, idioma, contato, link e PIN. Alterações posteriores no evento não
  mudam um aviso em andamento.
- O worker ([broadcast-worker.ts](../src/lib/notifications/broadcast-worker.ts))
  processa **um broadcast por vez, entre todos os módulos**, do mais antigo para
  o mais novo. Se um Save the Date estiver em andamento, o aviso mostra "na fila".
- Apenas um aviso pode estar em envio por vez.
- O relatório permite reenviar falhas (com confirmação extra para
  `DELIVERY_STATE_UNKNOWN`), cancelar o que ainda está na fila, exportar CSV e
  duplicar.

### Permissões

| Ação | ADMIN / GROOM / BRIDE | PLANNER | FAMILY / VIEWER |
|---|---|---|---|
| Ver hub, histórico e relatórios | ✅ | ✅ | 🚫 redirect |
| Criar/editar/duplicar/excluir rascunho, enviar teste | ✅ | ✅ (`denyIfNoEdit`) | 🚫 |
| Iniciar, reenviar falhas, cancelar | ✅ | 🚫 (`denyIfNoManage`) | 🚫 |

### Server actions

[src/app/actions/announcementActions.ts](../src/app/actions/announcementActions.ts):
`createAnnouncementDraft`, `saveAnnouncementDraft`, `deleteAnnouncementDraft`,
`duplicateAnnouncement`, `sendTestAnnouncement`, `startAnnouncement`,
`getAnnouncementProgress`, `getAnnouncementRecipients`,
`resendFailedAnnouncement`, `cancelAnnouncement`, `exportAnnouncementCsv`.
O anexo é servido por `GET /api/announcements/[id]/art` (sessão + `canEdit`).

### Limitações conhecidas

- O backup JSON legado (`/api/backup`) não inclui broadcasts (vale para os três
  módulos); o backup `.wfpbackup` inclui banco e `uploads/`.
- A projeção para o app Android rotula todos os destinatários de broadcast como
  `INVITE_*`, independentemente do módulo.
- Sem agendamento: o envio começa ao confirmar.
