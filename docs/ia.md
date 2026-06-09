# IA (Google Gemini)

Camada opcional de IA generativa. **Desligada por padrão** e construída com
opt-in em dois níveis, revisão humana obrigatória e degradação graciosa.

## Opt-in em dois níveis

A IA só funciona quando **ambos** estão ligados:

1. **Chave de API (servidor)** — variável `GEMINI_API_KEY`. Sem chave,
   `isAiEnabled()` é `false`, as Server Actions recusam e **a UI nem renderiza
   os botões de IA**.
2. **Toggle do casal (banco)** — `EventSettings.aiEnabled`, em
   **Ajustes › Casamento**. Consentimento explícito de enviar dados à nuvem.

O gate efetivo é `aiFeatureEnabled()` = `isAiEnabled() && EventSettings.aiEnabled`
([src/lib/ai/aiAccess.ts](../src/lib/ai/aiAccess.ts)).

## Variáveis de ambiente

| Variável | Padrão | Função |
|---|---|---|
| `GEMINI_API_KEY` | — | Chave da API. Vazia = IA desligada. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo. `gemini-2.5-flash-lite` p/ alto volume. |
| `GEMINI_TIMEOUT_MS` | `20000` | Timeout por chamada. |
| `GEMINI_MAX_OUTPUT_TOKENS` | `2048` | Teto de tokens de saída. |
| `AI_RATE_MAX` | `20` | Máx. de chamadas por janela (por usuário+recurso). |
| `AI_RATE_WINDOW_MS` | `300000` | Janela do rate limit (5 min). |

> ⚠️ A família `gemini-2.0-*` foi descontinuada (jun/2026). Use `gemini-2.5-*`.
> Confirme os modelos disponíveis na conta — eles giram rápido.

## Arquitetura

SDK: [`@google/genai`](https://www.npmjs.com/package/@google/genai) (o antigo
`@google/generative-ai` está depreciado). Camada em
[src/lib/ai/](../src/lib/ai/):

| Arquivo | Papel |
|---|---|
| `config.ts` | `isAiEnabled()`, `getAiConfig()`, `getAiModel()` (lê env). |
| `client.ts` | `getAiClient()` — singleton do `GoogleGenAI`. |
| `errors.ts` | `AiResult<T>` discriminado + `AiErrorCode`. |
| `rate-limit.ts` | `checkAiRateLimit(userId, resource)`. |
| `generate.ts` | `generateText` / `generateStructured` — **nunca lançam**. |
| `prompts.ts` | Construtores de prompt (puros; dados do usuário delimitados). |
| `schemas.ts` | Zod de saída das gerações estruturadas. |
| `log.ts` | `recordAiGeneration()` → tabela `AiGeneration` (sem PII bruta). |
| `aiAccess.ts` | `aiFeatureEnabled()` — gate dos dois níveis. |

Todos com `import "server-only"` (exceto tipos/schemas puros). A `GEMINI_API_KEY`
nunca sai do servidor — a invocação é **exclusivamente via Server Actions**
([src/app/actions/aiActions.ts](../src/app/actions/aiActions.ts)).

## Invariantes

- **Nunca lança.** A camada devolve `AiResult` (`{ ok: false, code }` em falha);
  a rota nunca quebra, só vira toast.
- **Revisão humana.** Actions de IA **não persistem** no domínio — devolvem o
  texto; o casal revisa (selo "Gerado por IA" + aviso) e só então salva pela
  action de domínio existente.
- **Anti prompt-injection.** Prompts montados server-side; dados do usuário
  entram como bloco delimitado, nunca como instrução.
- **IA jamais na rota pública `/rsvp/[token]`** (sem auth).
- **Sem PII em log.** `console.error` só com `resource`; `AiGeneration.outputPreview`
  truncado e `null` para features com PII.

## Auditoria

Cada geração grava em `AuditLog` (`entity: "AiGeneration"`, `action: "AI_GENERATE"`)
e na tabela `AiGeneration` (resource, model, status, tokens, preview truncado).

## Features

| Feature | Tela | Tipo |
|---|---|---|
| Narrativa de Insights | `/dashboard/insights` | Geração de texto (read-only) |

Próximas ondas (roadmap): redação de mensagens (fornecedor/RSVP/agradecimento),
geração estruturada (orçamento, lua de mel, enxoval, timeline do dia), extração
de contrato PDF (multimodal) e chatbot de ajuda (RAG).

## Testar

- **Sem `GEMINI_API_KEY`**: app sobe normal, nenhum botão de IA aparece.
- **Com chave + `aiEnabled`**: botão em Insights gera a narrativa; erro de
  rede/timeout vira toast sem quebrar a página.
- **Unit**: [src/lib/ai/](../src/lib/ai/) com o cliente Gemini mockado
  (`vi.mock("@google/genai")` resolve via alias `server-only` no
  [vitest.config.ts](../vitest.config.ts)).
