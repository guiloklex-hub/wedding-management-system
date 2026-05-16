# Mapa de Assentos (Seating Chart)

A partir da v0.3.0 o sistema tem uma tela visual para distribuir convidados em mesas. Acesse em `/dashboard/wedding-day/seating`.

## Modelo de dados

- **`SeatingTable`** — uma mesa do salão. Tem `name`, `capacity` (assentos disponíveis), `shape` (`ROUND` | `RECT` | `SQUARE`), `x`/`y` (posição no canvas) e `notes`. Soft delete via `deletedAt`.
- **`Guest.tableId`** — FK opcional para `SeatingTable`. Quando o convidado é desalocado, vira `null`.

> O campo legado `Guest.tableNumber` (string) continua existindo mas não é mais usado para alocação. Considere migrar entrada por entrada e remover em versão futura.

## Fluxo

1. **Criar mesa** — botão "Nova mesa", informa nome, capacidade e formato. A mesa nasce sem convidados.
2. **Alocar convidado** — o pool lateral lista convidados com `rsvpStatus = CONFIRMED` e `tableId = null`, ordenados por nome. Arraste o chip para uma mesa.
3. **Capacidade** — considera +1 confirmados. Convidado com `plusOnesConfirmed = 2` ocupa 3 assentos. Drop em mesa cheia falha silenciosamente com toast.
4. **Desalocar** — solte o chip de volta no pool. O `tableId` volta a ser `null`.
5. **Excluir mesa** — soft delete. Convidados que estavam nela são desalocados em transação.

## Server actions ([src/app/actions/seatingTableActions.ts](../src/app/actions/seatingTableActions.ts))

- `createSeatingTable(_, formData)` — cria mesa.
- `updateSeatingTable(_, formData)` — edita nome/capacidade/formato/notas.
- `deleteSeatingTable(tableId)` — soft delete + desaloca convidados em transação.
- `updateTablePosition(tableId, x, y)` — para arrastar mesas no canvas (futuro).
- `assignGuestToTable(guestId, tableId | null)` — valida capacidade antes de gravar.

Todas exigem sessão (`auth()`) e gravam `AuditLog` (entity `SeatingTable` ou `Guest`, action `ASSIGN_TABLE` / `UNASSIGN_TABLE`).

## Dependência

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — biblioteca de drag-and-drop. Sensores: PointerSensor + KeyboardSensor para acessibilidade.

## Limitações conhecidas

- Posição x/y das mesas no canvas ainda não é arrastável (campos existem; UI não usa).
- Sem regras automáticas de proximidade (ex.: "criança junto ao responsável") — pode virar feature.
