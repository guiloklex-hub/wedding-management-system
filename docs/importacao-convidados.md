# Importação de Convidados

O sistema oferece **dois caminhos** para importar listas de convidados:

1. **Texto colado** (legado, ainda disponível) — botão "Prefere colar texto?" dentro de `/dashboard/guests/import` ou via a Server Action `bulkImportGuests`.
2. **Arquivo XLSX** vindo de outros sistemas de planejamento — fluxo em duas etapas (upload + preview com diff + commit).

## 1. Fluxo de arquivo (`/dashboard/guests/import`)

### Sistemas suportados

| Origem | ID interno | Detecção |
|--------|-----------|----------|
| Wedy   | `wedy`    | Lê o header da primeira planilha; precisa ter ≥6 das 9 colunas conhecidas. |

A detecção é automática quando o select de origem está em "Detectar automaticamente". O usuário pode forçar uma origem específica caso a planilha tenha sido editada e o header esteja parcialmente alterado.

### Limites

- Arquivo: até **5 MB** ([`GUEST_IMPORT_MAX_BYTES`](../src/lib/file-validation.ts)).
- Linhas: até **2000** por importação ([`MAX_IMPORT_ROWS`](../src/app/actions/guestActions.ts)).
- Rate limit: 5 uploads/minuto por usuário, 15/minuto por IP.
- Sessão de preview: 10 minutos ([`GUEST_IMPORT_CACHE_TTL_MS`](../src/lib/guest-import-cache.ts)).

### Etapas

1. **Upload + parse**: o arquivo é validado por magic bytes (ZIP `PK\x03\x04`), parseado em memória pelo importer apropriado, e cada linha é classificada contra o banco em:
   - `new` — não existe convidado com esse nome.
   - `duplicate_same` — existe convidado com mesmo nome, mesmo grupo, e telefone/email batem.
   - `duplicate_diff` — existe convidado com mesmo nome mas dados divergem.
2. **Preview**: tela mostra contadores, tags detectadas (com aviso sobre criação automática), grupos detectados (com PIN se houver) e uma amostra de até 30 linhas filtrável por classificação.
3. **Modo + commit**: usuário escolhe entre `CREATE_NEW_ONLY` (padrão), `UPSERT_BY_NAME` ou `CREATE_ALL_DUPLICATES`, confirma, e tudo é gravado em uma única `prisma.$transaction` com timeout de 30s.

Cada commit gera um registro em `AuditLog` (`entity=Guest`, `entityId=bulk-import-file`, `action=BULK_CREATE`) com `source`, `mode` e contadores.

## 2. Mapeamento Wedy → schema

| Coluna Wedy | Campo no sistema | Observações |
|-------------|------------------|-------------|
| Nome do convite | `GuestGroup.name` + `Guest.groupName` | Cria `GuestGroup` se não existir (lookup por nome exato). |
| Nome completo do convidado | `Guest.name` | Truncado a 160 chars. Linha sem nome é descartada. |
| Status | `Guest.rsvpStatus` | Mapeamento: `Sem resposta`/`Convidado`→`INVITED`, `Confirmado`/`Vai`→`CONFIRMED`, `Recusado`/`Não vai`→`DECLINED`, `Talvez`→`MAYBE`, `Não convidado`→`NOT_INVITED`. Desconhecidos viram `INVITED` com badge `*` no preview. |
| Telefone | `Guest.phone` | Truncado a 40 chars. Comparação para diff usa só dígitos. |
| E-mail | `Guest.email` | Truncado a 160 chars. Comparação case-insensitive. |
| Tags | `GuestTag` + `GuestTagOnGuest` | Split por vírgula, trim, máximo 20 tags por linha. Cada tag única vira `GuestTag` (case-insensitive no lookup). Tag bate regex `/^(padrinho\|padrinhos\|madrinha\|madrinhas\|padrinho\/madrinha)$/i` → marca `Guest.isPadrinho=true` (OR, nunca apaga). |
| Faixa etária | `Guest.isChild` | `Criança`→true; demais valores→false. |
| Idade exata | `Guest.age` | Apenas inteiros 0-17. `Idade desconhecida` e outras strings → null. |
| Pin do convite | `GuestGroup.rsvpPin` | Aceita 4-8 chars alfanuméricos. **Informativo apenas** — o link público continua usando `rsvpToken` cuid. Em grupos que já existem, sobrescreve só quando o pin atual é null. |
| (não importado) | `Guest.side` | Sempre `null`. O Wedy usa Tags com nomes dos noivos para indicar lado, mas isso não é universal — preencher manualmente depois. |

## 3. Modos de commit

| Modo | Comportamento para `duplicate_same` | Quando usar |
|------|--------------------------------------|-------------|
| `CREATE_NEW_ONLY` (padrão) | Pula a linha (incrementa `skipped`). | Re-importação segura. |
| `UPSERT_BY_NAME` | Atualiza telefone, email, status, isChild, age, groupId, groupName, tags (substitui o conjunto) e seta `isPadrinho=true` se a tag de padrinho aparecer (OR). | Quando você atualizou dados no sistema externo e quer sincronizar. |
| `CREATE_ALL_DUPLICATES` | Cria assim mesmo (incrementa `created`). | Quando há homônimos em famílias diferentes que **não** devem ser fundidos. |

Linhas sem match (`new`) e linhas `duplicate_diff` sempre seguem para `create`, independentemente do modo.

## 4. Schema Prisma — modelos relacionados

```prisma
model GuestTag {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String?
  // ...
  guests    GuestTagOnGuest[]
}

model GuestTagOnGuest {
  guestId   String
  tagId     String
  guest     Guest    @relation(fields: [guestId], references: [id], onDelete: Cascade)
  tag       GuestTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([guestId, tagId])
}

model Guest {
  // ... campos existentes
  age   Int?
  tags  GuestTagOnGuest[]
}

model GuestGroup {
  // ... campos existentes
  rsvpPin  String?
}
```

## 5. FAQ

**O lado (NOIVO/NOIVA) é importado?** Não. O Wedy usa tags com os nomes dos noivos, o que não é universal. `Guest.side` fica `null` e pode ser editado depois.

**Status desconhecido vai pro lixo?** Não. Cai em `INVITED` com `rsvpStatusRaw` preservado no preview (badge `*` na coluna RSVP da amostra), e o status original aparece na payload do `AuditLog` via `rawSource`.

**A comparação de nome é case-sensitive?** Sim. "joão" e "João" são tratados como pessoas diferentes. Isso é conservador — evita fundir contas sem certeza.

**Posso reimportar o mesmo arquivo várias vezes?** Sim. O modo `CREATE_NEW_ONLY` é seguro: linhas duplicadas (mesmo nome + mesmo grupo) são puladas. Para atualizar dados existentes, use `UPSERT_BY_NAME`.

**O PIN do Wedy funciona como login?** Não nesta versão. O PIN é armazenado em `GuestGroup.rsvpPin` apenas como referência cruzada. O link público continua sendo o `rsvpToken` cuid (`/rsvp/group/[token]`).

**Como adicionar suporte a outro sistema?** Implementar um novo arquivo em `src/lib/guest-importers/<sistema>.ts` exportando um `Importer` (interface em [`types.ts`](../src/lib/guest-importers/types.ts)), adicionar a entrada em [`index.ts`](../src/lib/guest-importers/index.ts) e cobrir com testes em `<sistema>.test.ts`. A `Server Action` e a UI não precisam de mudança — o registry é descoberto automaticamente.

## 6. Sincronização com `bulkImportGuests` (legado)

A action de texto colado **não** foi removida. Continua disponível:

- Pela página `/dashboard/guests/import` → botão "Prefere colar texto bruto?".
- Mantém o layout fixo `Nome,Telefone,Email,Lado,Grupo`.
- Continua criando `GuestGroup` automaticamente, mas **não** importa tags nem PIN.

Considere depreciá-la em versão futura, quando a importação por arquivo cobrir todos os casos.
