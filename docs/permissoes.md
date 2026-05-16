# Roles e Permissões

Roles atuais ([src/lib/permissions.ts](../src/lib/permissions.ts)):

| Role | Descrição |
|------|-----------|
| `ADMIN` | Gerencia usuários e segurança. Acesso total. |
| `GROOM` | Noivo. Edita tudo. |
| `BRIDE` | Noiva. Edita tudo. |
| `PLANNER` | Cerimonialista. Edita conteúdo do casamento — **sem acesso a finanças**. |
| `FAMILY` | Família. Somente leitura com acesso a detalhes. |
| `VIEWER` | Visualiza informações básicas. |

## Matriz de acesso (v0.3.0)

Os checks abaixo são aplicados via `requireFinanceAccess()` nas pages e `denyIfNoFinance()` nas server actions (ambos em [src/lib/finance-access.ts](../src/lib/finance-access.ts)).

| Área | ADMIN / GROOM / BRIDE | PLANNER | FAMILY / VIEWER |
|------|-----------------------|---------|------------------|
| Fornecedores | ✅ | ✅ | leitura |
| Locais | ✅ | ✅ | leitura |
| Tarefas | ✅ | ✅ | leitura |
| Convidados | ✅ | ✅ | leitura |
| Presentes | ✅ | ✅ | leitura |
| Dia D + Seating | ✅ | ✅ | leitura |
| Lua de mel | ✅ | ✅ | leitura |
| Enxoval | ✅ | ✅ | leitura |
| **Pagamentos** | ✅ | 🚫 redirect | 🚫 redirect |
| **Receitas** | ✅ | 🚫 redirect | 🚫 redirect |
| **Caixa (Assets)** | ✅ | 🚫 redirect | 🚫 redirect |
| **Metas** | 🚫 | 🚫 redirect | 🚫 redirect |
| **Insights / DRE** | ✅ | 🚫 redirect | 🚫 redirect |
| Ajustes | ✅ | ✅ (perfil) | perfil |

Roles com 🚫 são **redirecionadas para `/dashboard`** se tentarem acessar a página diretamente, e os links ficam **escondidos no menu** (Sidebar / MobileHeader / BottomNav usam `useVisibleLinks()`).

## API

### Em pages

```typescript
import { requireFinanceAccess } from "@/lib/finance-access";

export default async function MyFinancePage() {
  await requireFinanceAccess(); // redireciona se não autorizado
  // ...
}
```

### Em server actions

```typescript
import { denyIfNoFinance } from "@/lib/finance-access";

export async function myFinanceAction(): Promise<ActionResult> {
  const denied = await denyIfNoFinance();
  if (denied) return denied;
  // ...
}
```

## FAMILY e VIEWER

Estas roles **também** são bloqueadas das áreas financeiras (`canViewSensitiveFinance` cobre só ADMIN/GROOM/BRIDE). Não estão na matriz como casos diferentes do PLANNER porque o comportamento é idêntico para finanças. A diferença está em `canEdit()` (FAMILY/VIEWER não editam nada).

## Convidar planner / família

Ajustes › Time › "Convidar membro". Defina a role na criação. Comportamento de finanças aplica imediatamente.

## Anexos e contratos (v0.4.0)

Funções específicas em `src/lib/permissions.ts`:

| Função | Quem retorna `true` |
|--------|--------------------|
| `canUploadContract(role)` | ADMIN, GROOM, BRIDE, PLANNER |
| `canViewContract(role)` | ADMIN, GROOM, BRIDE, PLANNER |
| `canManageContract(role)` | ADMIN, GROOM, BRIDE |
| `canSignContract(role)` | ADMIN, GROOM, BRIDE |
| `canViewAttachmentKind(role, kind)` | varia por kind |
| `canUploadAttachmentKind(role, kind)` | `CONTRACT` exige upload-contract; demais exigem `canEdit` |

FAMILY e VIEWER **não acessam contratos** (kind `CONTRACT/INVOICE/RECEIPT`).
Veja [anexos.md](anexos.md) para a matriz completa.

## Relatórios de BI (v0.4.0)

O hub `/dashboard/reports` filtra cards por permissão:

- Itens financeiros (Lua de Mel) escondidos para roles sem
  `canViewSensitiveFinance`.
- Itens neutros (Funil, RSVP, Enxoval, Burndown) visíveis para todos.
- Audit Timeline (`/dashboard/reports/activity`) só para `canManageUsers`.

Dashboard principal (`/dashboard`) tem versão sanitizada para
FAMILY/VIEWER (KPIs operacionais em vez de R$, esconde Pie e lista de
pagamentos, mantém RSVP/Gifts mini cards). Detalhes em
[relatorios.md](relatorios.md).
