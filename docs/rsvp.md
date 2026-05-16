# RSVP — individual e em grupo

O sistema oferece **dois caminhos públicos** de confirmação de presença. Ambos coexistem; cada convidado pode ter ou não estar em um grupo.

## 1. RSVP individual (clássico)

Rota: `/rsvp/[token]` onde `token = Guest.rsvpToken` (cuid gerado na criação).

- Mostra o nome do convidado, escolha CONFIRMED / DECLINED / MAYBE.
- Se CONFIRMED e `plusOnesAllowed > 0`, pergunta quantos +1.
- Permite informar restrição alimentar e recado.

Action: `publicRsvpRespond` em [src/app/actions/guestActions.ts](../src/app/actions/guestActions.ts).

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

## Quando usar cada um

- **Indivíduo importante (padrinho, parente próximo, parceiro de trabalho):** use o link individual.
- **Família com responsável claro (pais, sogros, primos):** use o grupo — menos atrito para o responsável.
- **Mistura:** OK, podem coexistir. Um convidado em grupo também tem `rsvpToken` próprio, mas é raro mandar os dois links.

## Campo legado `Guest.groupName`

Continua existindo como string livre. Não é usado para o link de grupo. Considere migrar entrada por entrada e remover em versão futura.
