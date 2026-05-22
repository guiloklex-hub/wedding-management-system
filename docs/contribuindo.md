# 🤝 Contribuindo

Obrigado por considerar contribuir com o Wedding Finance Planner! Este projeto
é open-source (MIT) e qualquer ajuda é bem-vinda — código, documentação,
tradução, testes, sugestões.

## Antes de começar

1. Leia o **README.md** principal e o [AGENTS.md](../AGENTS.md) — esse
   último é a fonte de verdade técnica.
2. Veja se sua ideia já não está em uma issue aberta.
3. Para mudanças grandes (refatoração, módulo novo), abra uma issue de
   discussão **antes** de codar.

## Tipos de contribuição

| Tipo | Onde |
|---|---|
| Reportar bug | GitHub Issues — template "Bug" |
| Sugerir feature | GitHub Issues — template "Feature" |
| Corrigir bug | Pull Request |
| Adicionar feature | Pull Request (depois de discutir em issue) |
| Melhorar doc | Pull Request direto (encorajado!) |
| Tradução | Ainda não há i18n — abra issue se quiser puxar |

## Setup local

```bash
git clone https://github.com/guiloklex-hub/wedding-management-system.git
cd wedding-management-system
./setup.sh        # ou .\setup.ps1 no Windows
npm run dev
```

## Fluxo de trabalho

1. **Fork** do repositório no GitHub.
2. **Branch nova:** `git checkout -b feature/minha-melhoria`.
3. **Código + testes** (rode `npm run test` em watch enquanto desenvolve).
4. **Lint:** `npm run lint` — precisa passar sem warnings.
5. **Tipos:** `npx tsc --noEmit` — sem erros.
6. **Build:** `npm run build` — sem erros.
7. **Commit:** mensagem clara em português ou inglês:
   - `feat(payments): adicionar suporte a pagamento parcial`
   - `fix(rsvp): corrigir contagem de +1s quando guest cancela`
   - `docs(notificacoes): atualizar instruções de App Password do Gmail`
   - `refactor(cashflow): extrair cálculo de heatmap`
8. **Push** e abrir **Pull Request**.

## Padrões de código

### TypeScript

- **Strict mode** — `tsconfig.json` já está com `"strict": true`.
- **Proibido `any`** em tipos de contrato (Server Actions, payloads,
  retornos públicos). Use `unknown` + narrow se realmente precisa.
- Prefira tipos derivados do Prisma:
  ```typescript
  import type { Vendor } from "@prisma/client";
  ```

### Server Components vs Client Components

- **Padrão: Server Component.**
- `"use client"` apenas para componentes com:
  - state (`useState`, `useReducer`, etc.)
  - eventos de DOM (`onClick`, `onChange`)
  - hooks de navegação (`usePathname`, `useRouter`)

### Server Actions

```typescript
"use server";

import { auth } from "@/auth";
import { z } from "zod";

const Schema = z.object({ ... });

export async function minhaAction(
  _state: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Não autorizado" };

  const parsed = Schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    // ... lógica
    await audit("Entidade", id, "ACTION", payload);
    revalidatePath("/dashboard/algo");
    return { success: true };
  } catch (err) {
    console.error("[minhaAction]", err);
    return { success: false, error: "Erro ao processar" };
  }
}
```

### Datas

- **Salvar em UTC** (`new Date()` ou ISO string).
- **Exibir em pt-BR** via `formatDateBR()` /
  `formatDateTimeBR()` de [src/lib/format.ts](../src/lib/format.ts).
- Em cálculos baseados em fuso (cron, vencimentos), considere
  `America/Sao_Paulo`.

### Dinheiro

- Para cálculos com **percentuais** ou **splits**, prefira aritmética em
  centavos (inteiros). Float-point dá erro de centavo.

### Imports

- Use alias `@/` (mapeia para `src/`).
- Ordem: libs externas → libs internas → relativos.

### Lint

```bash
npm run lint            # ESLint
npm run lint -- --fix   # corrige automaticamente o que dá
```

Não deixe warnings novos. Se um warning for legitimamente inevitável,
adicione um `// eslint-disable-next-line <regra> — motivo aqui`.

## Testes

```bash
npm run test            # watch mode
npm run test:run        # single run (CI)
npm run test:coverage   # cobertura
```

**Quando escrever teste:**
- Lógica de domínio (cashflow, recurrence, validators) → teste unitário.
- Server Action com regra complexa → teste de integração mockando Prisma.
- Bug fix → teste de regressão que falha antes do fix.

**Estilo:**
- Arquivos `*.test.ts` ao lado do código.
- Use `vitest` + `@testing-library/react` para componentes.

## Documentação

> 📚 Documentação desatualizada é **bug grave** neste projeto.

Toda mudança que afete o usuário final deve atualizar:

1. **`docs/`** — o arquivo da área tocada.
2. **`/dashboard/help`** (`src/lib/help-content.ts`) — adicione passo-a-passo
   ou FAQ se for relevante.
3. **`README.md`** — apenas se for marco de produto (novo módulo, mudança em
   variáveis de ambiente, etc.).
4. **`AGENTS.md`** — se afetar convenções de desenvolvimento.

## Pull Request

Use o template padrão. Inclua:

- **Resumo** em 1-3 bullets.
- **Test plan** (como verificar manualmente que funciona).
- **Screenshots/GIFs** se for UI.
- **Breaking changes** se houver.

PR pequenos são **muito** preferíveis a PRs gigantes. Se sua mudança
ultrapassar ~500 linhas, considere quebrar.

## Comunicação

- Tom amigável e direto.
- Em pt-BR ou en, escolha um por PR e mantenha consistência.
- Maintainers podem demorar até alguns dias para responder. Paciência.

## Licença

Ao contribuir, você concorda que seu código será distribuído sob a mesma
**licença MIT** do projeto.
