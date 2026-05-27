# Mapa de Assentos (Seating Chart)

A partir da v0.3.0 o sistema tem uma tela visual para distribuir convidados em mesas. Acesse em `/dashboard/wedding-day/seating`.

**Acesso na UI:** item "Mapa de assentos" no menu lateral (grupo Casamento, logo abaixo de "Dia D") e card de atalho no topo da página `/dashboard/wedding-day`.

## Modelo de dados

- **`SeatingTable`** — uma mesa do salão. Tem `name`, `capacity` (assentos disponíveis), `shape` (`ROUND` | `RECT` | `SQUARE`), `sortOrder` (ordem de exibição no grid), `x`/`y` (reservados para um futuro canvas livre — não usados pela UI atual) e `notes`. Soft delete via `deletedAt`.
- **`Guest.tableId`** — FK opcional para `SeatingTable`. Quando o convidado é desalocado, vira `null`.

> O campo legado `Guest.tableNumber` (string) continua existindo mas não é mais usado para alocação. Considere migrar entrada por entrada e remover em versão futura.

## Fluxo

1. **Criar mesa** — botão "Nova mesa", informa nome, capacidade e formato. A mesa nasce sem convidados.
2. **Alocar convidado** — o pool lateral lista convidados com `rsvpStatus = CONFIRMED` e `tableId = null`, ordenados por nome. Arraste o chip para uma mesa.
3. **Capacidade** — considera +1 confirmados. Convidado com `plusOnesConfirmed = 2` ocupa 3 assentos. Drop em mesa cheia falha silenciosamente com toast.
4. **Reordenar mesas** — cada card tem uma alça (ícone `GripVertical` no cabeçalho). Arraste pela alça para mudar a ordem das mesas no grid; a nova ordem é persistida em `sortOrder`. Só a alça inicia o arrasto da mesa, então os chips de convidado dentro do card continuam clicáveis/arrastáveis.
5. **Desalocar** — solte o chip de volta no pool. O `tableId` volta a ser `null`.
6. **Excluir mesa** — soft delete. Convidados que estavam nela são desalocados em transação.

## Server actions ([src/app/actions/seatingTableActions.ts](../src/app/actions/seatingTableActions.ts))

- `createSeatingTable(_, formData)` — cria mesa.
- `updateSeatingTable(_, formData)` — edita nome/capacidade/formato/notas.
- `deleteSeatingTable(tableId)` — soft delete + desaloca convidados em transação.
- `reorderSeatingTables(orderedIds)` — grava `sortOrder` sequencial (índice no array) para cada mesa, em transação. Valida a lista com Zod (1–200 ids, cada um ≤ 64 chars).
- `updateTablePosition(tableId, x, y)` — reservada para um futuro canvas livre; não é usada pela UI atual.
- `assignGuestToTable(guestId, tableId | null)` — valida capacidade antes de gravar.

Todas exigem permissão de edição (`denyIfNoEdit`) e gravam `AuditLog` (entity `SeatingTable` ou `Guest`, action `CREATE` / `UPDATE` / `DELETE` / `REORDER` / `ASSIGN_TABLE` / `UNASSIGN_TABLE`).

A ordenação inicial em [page.tsx](../src/app/dashboard/wedding-day/seating/page.tsx) é `orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]` — mesas antigas (todas com `sortOrder = 0`) caem no desempate por data de criação.

## Dependência

- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — biblioteca de drag-and-drop. Sensores: PointerSensor + KeyboardSensor para acessibilidade.

## Coexistência de dois arrastos no mesmo `DndContext`

Cada card de mesa é, ao mesmo tempo, um item **sortable** (reordenável) e um **droppable** que recebe convidados. Para o `over` nunca ficar ambíguo, o `DndContext` usa uma `collisionDetection` customizada (`seatingCollision` em [seating-client.tsx](../src/app/dashboard/wedding-day/seating/seating-client.tsx)) que filtra os candidatos pelo tipo do item ativo:

- arrastando um **convidado** (`type: "guest"`) → considera só droppables de convidado (`type: "table"` e `type: "pool"`) via `pointerWithin`;
- arrastando uma **mesa** (`type: "table-sort"`) → considera só os itens sortable via `closestCenter`.

## Limitações conhecidas

- A reordenação é por grid (não há canvas com posição livre x/y). Os campos `x`/`y` existem no schema mas ficam reservados para uma evolução futura.
- Sem regras automáticas de proximidade (ex.: "criança junto ao responsável") — pode virar feature.
