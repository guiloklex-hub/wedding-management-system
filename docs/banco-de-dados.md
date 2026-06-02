# 🗄️ Banco de Dados

O Wedding Finance Planner usa **SQLite** via **Prisma ORM**. SQLite é leve,
sem servidor, e perfeito para o uso esperado (1 casal = 1 instância,
algumas centenas de registros).

## Por que SQLite?

- Zero dependências externas.
- Um único arquivo (`prisma/dev.db`) — fácil de backup e migrar.
- Suficiente para escala esperada (1 casal, ~500 convidados, ~50
  fornecedores, ~200 pagamentos).
- Migração futura para MySQL/Postgres é viável trocando `provider` no
  schema.

## Comandos do dia-a-dia

```bash
# Aplicar mudanças do schema (sem dropar dados)
npx prisma db push --skip-generate

# Regerar o client TypeScript
npx prisma generate

# Atalho npm que faz os dois
npm run db:push

# Abrir a UI web do Prisma Studio (http://localhost:5555)
npm run db:studio

# Rodar o seed (idempotente)
npm run db:seed
```

## `db push` vs `migrate dev` — por quê não usamos migrations?

O projeto usa o fluxo **schema-first** (`prisma db push`) em vez de
**migrations** (`prisma migrate dev`). Motivos:

- Casamento é projeto **curto** (~12 a 18 meses). Manter pasta `migrations/`
  com dezenas de arquivos custa caro para pouco benefício.
- Quem clona o projeto roda `./setup.sh`, que aplica o schema atual de uma
  vez. Não precisa rejogar histórico.
- Para mudanças destrutivas, **avise no PR** e oriente o usuário a fazer
  backup antes do `db push`.

> ⚠️ Se o projeto crescer (multi-tenant, várias instâncias), migrar para
> `prisma migrate` será necessário. Discuta antes de fazer.

## Schema atual

Arquivo: [prisma/schema.prisma](../prisma/schema.prisma).

### Modelos (resumo)

| Modelo | Propósito |
|---|---|
| `User` | Usuário do sistema (admins do casamento). Suporta 2FA, mustChangePassword, archivedAt, `locale` (pt-BR/en/es). |
| `PasswordResetToken` | Tokens de reset (hash sha256, expira em 60min). |
| `NotificationLog` | Histórico de envios (email + WhatsApp), idempotência por dia. |
| `SecuritySettings` | Singleton: lista de roles que exigem 2FA, tamanho mínimo de senha. |
| `EventSettings` | Singleton: dados do casamento (data, contingência, moeda, nomes, plano B, `defaultLocale`). Inclui Save the Date: `weddingWebsiteUrl`, `giftRegistryUrl`, `saveTheDateMessage`, `saveTheDateFilePath/Mime/Name` (a arte). |
| `Vendor` | Fornecedores com status, categoria, notas, contratos, anexos. |
| `VendorContact` | Múltiplos contatos por fornecedor (com isPrimary). |
| `VendorNote` | Histórico de notas livre por fornecedor. |
| `Contract` | Contratos versionados (status, valor, datas, exclusões). |
| `Attachment` | Anexos (vendors, contratos, locais). |
| `Venue` | Locais (capacidade, preço, prós/contras, visitação). |
| `VenueChecklistItem` | Itens de checklist por local (ordenável). |
| `BudgetItem` | Itens orçamentários (estimado vs realizado, vinculado a Vendor). |
| `Payment` | Pagamentos (parcelado, status, vencimento, método). |
| `Asset` | Caixa/poupança (entradas e saídas). |
| `Income` | Receitas (salário, donativos, frequência). |
| `SavingsGoal` | Metas financeiras (target, data, isActive). |
| `Honeymoon` | Singleton: lua de mel. |
| `HoneymoonItem` | Itens da lua de mel (atividade, vôo, hospedagem). |
| `TrousseauItem` | Enxoval (cômodo, prioridade, status compra). |
| `Guest` | Convidados (RSVP, +1s, dietary, padrinho, checkin, `language` opcional para RSVP localizado, `rsvpTokenExpiresAt` opcional, `age` opcional para crianças). Relação M:N com `GuestTag` via `GuestTagOnGuest`. |
| `GuestGroup` | Convite de família com `rsvpToken` único e `rsvpTokenExpiresAt` opcional. `rsvpPin` opcional (informativo, vindo de imports externos). |
| `GuestTag` | Tags de convidados (Padrinhos, Florista, etc.), com `name @unique` e `color` opcional. |
| `GuestTagOnGuest` | Junction table M:N entre `Guest` e `GuestTag` (`@@id([guestId, tagId])`, cascade no delete). |
| `SeatingTable` | Mesa do evento (capacidade, forma, posição x/y). |
| `Gift` | Presentes (cash/item, status recebimento). |
| `Task` | Tarefas (status, prioridade, responsável, deadline). |
| `AuditLog` | Auditoria (entity, action, payload, userId). |
| `Broadcast` | Campanha de envio em massa (`kind`, ex.: `SAVE_THE_DATE`; `status`, `total`). Reaproveitável para o convite formal futuro. |
| `BroadcastRecipient` | Item da fila de um `Broadcast` (`refType`/`refId`, `phone`, `email`, `status` PENDING/SENT/FAILED/SKIPPED). Cascade no delete do `Broadcast`. |

### Convenções

- **IDs:** `cuid()` (string opaca).
- **Soft delete:** muitos modelos têm `deletedAt: DateTime?`. Filtre por
  `deletedAt: null` ao consultar.
- **Timestamps:** `createdAt @default(now())` e `updatedAt @updatedAt` quase
  sempre presentes.
- **Singletons:** `EventSettings`, `Honeymoon`, `SecuritySettings` usam
  `id: String @id @default("singleton")`. Sempre via `upsert`.

### Índices

Adicionados em [prisma/schema.prisma](../prisma/schema.prisma) para cobrir
queries de listagem e do cron de lembretes:

| Modelo | Índices |
|---|---|
| `Vendor` | `[status, deletedAt]`, `[categoryKey]`, `[deletedAt]` |
| `Payment` | `[vendorId]`, `[status, dueDate]`, `[deletedAt, status, dueDate]` |
| `Asset` | `[goalId]`, `[date]`, `[deletedAt]` |
| `Income` | `[status, expectedDate]`, `[deletedAt]` |
| `BudgetItem` | `[vendorId, deletedAt]` |
| `Gift` | `[status]`, `[guestId]`, `[deletedAt]` |
| `Task` | `[status, deadline]`, `[deadline]`, `[vendorId]`, `[venueId]`, `[deletedAt]` |
| `Contract` | `[vendorId]`, `[vendorId, status]` |
| `NotificationLog` | `[kind, refType, refId]`, `[createdAt]`, `[kind, status, createdAt]` |
| `AuditLog` | `[entity, entityId]`, `[createdAt]`, `[userId, createdAt]` |

Em SQLite o ganho concreto é menor que em Postgres, mas mantém o plano de
queries estável (eviota table scans nas listagens autenticadas e no
agregado `groupBy` que faz a idempotência do cron — veja
[notificacoes.md](notificacoes.md)).

## Inspeção rápida

### Prisma Studio (UI)

```bash
npm run db:studio
```

Abre <http://localhost:5555> com uma tabela editável de cada modelo.

### CLI (sqlite3)

```bash
sqlite3 prisma/dev.db
sqlite> .tables
sqlite> SELECT id, name, email, role FROM User;
sqlite> .exit
```

### A partir do Node (REPL)

```bash
node
> const { PrismaClient } = require('@prisma/client');
> const p = new PrismaClient();
> await p.eventSettings.findUnique({ where: { id: 'singleton' } });
```

## Alterando o schema

1. Edite `prisma/schema.prisma`.
2. Rode `npx prisma db push --skip-generate`.
3. Rode `npx prisma generate`.
4. Atualize código que use o modelo alterado.
5. **Atualize a doc:** este arquivo + [modulos.md](modulos.md) se for
   visível ao usuário.

> 🚨 Para alterações **destrutivas** (drop coluna, mudar tipo), faça backup
> antes (`cp prisma/dev.db prisma/dev.db.bak`). O `prisma db push` perguntará
> se quer continuar.

## Performance

A partir da v0.3.0 o singleton em [src/lib/prisma.ts](../src/lib/prisma.ts)
aplica automaticamente, na primeira inicialização do PrismaClient:

- `PRAGMA journal_mode = WAL` — permite reads concorrentes durante writes.
- `PRAGMA busy_timeout = 5000` — espera até 5s antes de dar `SQLITE_BUSY`
  quando há contenção (útil quando o cron de reminders escreve junto com o
  usuário).

Se você quiser verificar manualmente:

```bash
sqlite3 prisma/dev.db "PRAGMA journal_mode"   # deve retornar 'wal'
```

WAL gera dois arquivos auxiliares ao lado do `dev.db`: `dev.db-wal` e
`dev.db-shm`. Inclua os três no backup ou use `VACUUM INTO` para gerar um
snapshot consolidado.

## Soft delete via Prisma Client Extension

16 modelos têm `deletedAt: DateTime?`. Em vez de escrever
`where: { deletedAt: null }` em cada query, o singleton aplica uma
**Client Extension** (`$extends`) que:

- Injeta `deletedAt: null` automaticamente em `findMany`, `findFirst`,
  `findFirstOrThrow`, `count`, `aggregate`, `groupBy`.
- Em `findUnique`/`findUniqueOrThrow`, pós-filtra: se o registro encontrado
  tiver `deletedAt != null`, retorna `null` (ou lança em `OrThrow`).
- Em `delete` e `deleteMany`, converte automaticamente para `update`
  setando `deletedAt = new Date()` — ou seja, todo `.delete()` em modelo
  com `deletedAt` vira soft delete sem mudar código existente.

Lista de modelos soft delete (constante `SOFT_DELETE_MODELS` em
[src/lib/prisma.ts](../src/lib/prisma.ts)):

`Vendor`, `VendorContact`, `VendorNote`, `Contract`, `Attachment`,
`Venue`, `BudgetItem`, `Payment`, `Asset`, `Income`, `SavingsGoal`,
`HoneymoonItem`, `TrousseauItem`, `Guest`, `Gift`, `Task`, `SeatingTable`,
`GuestGroup`.

> Se precisar ler **registros soft-deletados** (telas de "lixeira"), passe
> `where: { deletedAt: { not: null } }` explicitamente — a extension só
> injeta `null` quando você **não** especifica o campo.

## Migração para outro banco

Se quiser sair do SQLite (ex.: para MySQL/Postgres na nuvem):

1. Mude `provider = "mysql"` (ou `"postgresql"`) em `schema.prisma`.
2. Ajuste `DATABASE_URL`.
3. Reveja tipos: SQLite trata DateTime como string ISO, MySQL como
   `DATETIME`. Para a maioria dos casos o Prisma cuida da tradução.
4. Use `prisma migrate dev` a partir daí (mais seguro em bancos
   "de verdade").
5. Exporte os dados antigos com `npm run db:studio` ou
   `sqlite3 prisma/dev.db .dump > dump.sql`, e importe no novo banco.
