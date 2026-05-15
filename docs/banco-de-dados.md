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
| `User` | Usuário do sistema (admins do casamento). Suporta 2FA, mustChangePassword, archivedAt. |
| `PasswordResetToken` | Tokens de reset (hash sha256, expira em 60min). |
| `NotificationLog` | Histórico de envios (email + WhatsApp), idempotência por dia. |
| `SecuritySettings` | Singleton: lista de roles que exigem 2FA, tamanho mínimo de senha. |
| `EventSettings` | Singleton: dados do casamento (data, contingência, moeda, nomes, plano B). |
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
| `Guest` | Convidados (RSVP, +1s, dietary, padrinho, checkin). |
| `Gift` | Presentes (cash/item, status recebimento). |
| `Task` | Tarefas (status, prioridade, responsável, deadline). |
| `AuditLog` | Auditoria (entity, action, payload, userId). |

### Convenções

- **IDs:** `cuid()` (string opaca).
- **Soft delete:** muitos modelos têm `deletedAt: DateTime?`. Filtre por
  `deletedAt: null` ao consultar.
- **Timestamps:** `createdAt @default(now())` e `updatedAt @updatedAt` quase
  sempre presentes.
- **Singletons:** `EventSettings`, `Honeymoon`, `SecuritySettings` usam
  `id: String @id @default("singleton")`. Sempre via `upsert`.

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

SQLite em modo padrão é serial — apenas uma transação write por vez.
Suficiente para 1 usuário simultâneo. Se você esperar muito tráfego (RSVP em
massa via link público), considere ativar **WAL mode**:

```bash
sqlite3 prisma/dev.db "PRAGMA journal_mode=WAL;"
```

Isso permite reads concorrentes durante writes.

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
