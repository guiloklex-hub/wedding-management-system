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
