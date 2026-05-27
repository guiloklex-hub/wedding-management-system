# RSVP — individual e em grupo

O sistema oferece **dois caminhos públicos** de confirmação de presença. Ambos coexistem; cada convidado pode ter ou não estar em um grupo.

## Idioma do RSVP (v0.5.0+)

Ambas as rotas resolvem o idioma na ordem:

1. `?lang=` na URL (`?lang=en`, `?lang=es`, `?lang=pt-BR`).
2. `Guest.language` (campo opcional no banco, salvo via UI ou seed).
3. `EventSettings.defaultLocale` (configurado no onboarding).
4. `pt-BR` (default).

Cabeçalho, opções, placeholders e mensagens de retorno são renderizados no
idioma resolvido. A página é Server Component; o formulário client
recebe os labels prontos (RSVP individual) ou um `NextIntlClientProvider`
aninhado com as mensagens do locale (RSVP grupo). Veja
[i18n.md](i18n.md).

## 1. RSVP individual (clássico)

Rota: `/rsvp/[token]` onde `token = Guest.rsvpToken` (cuid gerado na criação).

- Mostra o nome do convidado, escolha CONFIRMED / DECLINED / MAYBE.
- Se CONFIRMED e `plusOnesAllowed > 0`, pergunta quantos +1.
- Permite informar restrição alimentar e recado.

Action: `publicRsvpRespond` em [src/app/actions/guestActions.ts](../src/app/actions/guestActions.ts).

## Expiração de tokens RSVP

Modelos `Guest` e `GuestGroup` têm o campo opcional `rsvpTokenExpiresAt:
DateTime?`. Quando preenchido, o link deixa de funcionar após esse instante.

- A query Prisma já filtra na origem com
  `OR: [{ rsvpTokenExpiresAt: null }, { rsvpTokenExpiresAt: { gt: now } }]`,
  então a página pública retorna **404** para tokens expirados.
- O server action (`publicRsvpRespond`, `publicRsvpRespondForGroup`) também
  rejeita com `"Link expirado"` caso o convidado tente um POST direto.
- `rsvpTokenExpiresAt = null` (default) significa **sem expiração** —
  registros legados continuam funcionando.

Recomendação operacional: rodar um script após o casamento setando
`rsvpTokenExpiresAt = eventDate + 7 dias` para todos os tokens, fechando a
janela de respostas retroativas.

## 2. RSVP de grupo (família)

Rota: `/rsvp/group/[token]` onde `token = GuestGroup.rsvpToken`.

**Novo modelo `GuestGroup`** (v0.3.0):

- `id`, `name` (ex.: "Família Silva"), `rsvpToken`, contato (nome/email/telefone) e notas.
- `guests` — relação 1:N (`Guest.groupId`).

A página pública lista **todos os membros do grupo** ordenados por nome. Para cada um:
- Botões CONFIRMED / DECLINED / MAYBE.
- Campo de +1 quando confirmou e tem `plusOnesAllowed > 0`.
- Campo de dieta quando confirmou.

O responsável envia tudo numa única submissão. Action: `publicRsvpRespondForGroup` em [src/app/actions/guestGroupActions.ts](../src/app/actions/guestGroupActions.ts).

### Anti-IDOR

A action recebe array `[{ guestId, status, plusOnesConfirmed, dietary }]`. Antes de aplicar, valida que **todos os guestIds pertencem ao grupo carregado pelo token**. Se algum não pertencer, rejeita a resposta inteira.

### Anti-replay

O update é `updateMany` com `where: { id, groupId: group.id }` dentro de `prisma.$transaction` — se um guestId for adulterado, o update simplesmente não acha o registro e a transação aborta.

## Gerenciamento de grupos

UI em `/dashboard/guests/groups`:

- Criar grupo (nome + contato).
- Adicionar/remover membros — `setGroupMembers({ groupId, guestIds })` substitui o membership inteiro do grupo em uma transação.
- Copiar link RSVP para enviar ao responsável.
- Ver contagem (sim / pendente / não) por grupo.

### Importação em massa (CSV)

A action `bulkImportGuests` aceita a coluna `Grupo` na 5ª posição
(`Nome,Telefone,Email,Lado,Grupo`). Quando preenchida:

- Busca `GuestGroup` existente pelo `name` exato (case-sensitive, `deletedAt: null`).
- Se não existir, cria o `GuestGroup` (apenas com `name` — contato fica em branco para o usuário completar depois).
- Associa o convidado ao grupo via `Guest.groupId` (e mantém `Guest.groupName` como string redundante).
- Linhas com o mesmo nome de grupo compartilham o mesmo `groupId`.

Tudo roda dentro de `prisma.$transaction` para não deixar estado parcial. O retorno
inclui `groupsCreated` além de `created` e `skipped`.

### Importação por arquivo XLSX (Wedy)

Além do texto colado, há a página `/dashboard/guests/import` que aceita arquivos
.xlsx exportados de outros sistemas (hoje: Wedy). Ela usa as Server Actions
`previewGuestImport` + `commitGuestImport`, traz tags (M:N via `GuestTag`), PIN
do convite no `GuestGroup.rsvpPin` e fluxo em 2 passos (preview com diff +
escolha de modo). Detalhes em [importacao-convidados.md](importacao-convidados.md).

## Campo `GuestGroup.rsvpPin`

Persistido **apenas como referência cruzada** ao convite original do Wedy ou
sistemas similares. Aceita 4-8 chars alfanuméricos. O link público continua
usando `rsvpToken` cuid — não há rota de login por PIN nesta versão.

## Quando usar cada um

- **Indivíduo importante (padrinho, parente próximo, parceiro de trabalho):** use o link individual.
- **Família com responsável claro (pais, sogros, primos):** use o grupo — menos atrito para o responsável.
- **Mistura:** OK, podem coexistir. Um convidado em grupo também tem `rsvpToken` próprio, mas é raro mandar os dois links.

## Campo legado `Guest.groupName`

Continua existindo como string livre, agora preenchido automaticamente em paralelo
ao `groupId` quando a importação CSV cria/associa um grupo. O link de RSVP coletivo
usa exclusivamente o `groupId`. Considere migrar entradas antigas (com `groupName`
mas sem `groupId`) executando uma rotina manual e remover o campo em versão futura.
