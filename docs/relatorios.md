# Relatórios de BI

A partir da v0.4.0 o sistema tem um hub dedicado a relatórios analíticos em
`/dashboard/reports`, além de visualizações novas dentro de
`/dashboard/insights`.

## Hub `/dashboard/reports`

Lista cards clicáveis para cada relatório disponível ao perfil. Itens
financeiros (sensíveis) ficam ocultos para FAMILY/VIEWER.

| Relatório | Pergunta de negócio | Perfis |
|-----------|--------------------|--------|
| Funil de Fornecedores | Quantos estão em negociação, contratados, finalizados? Tempo médio em cada estágio? | Todos |
| Risk Radar | Quais sinais vermelhos preciso atacar hoje? | Todos (alertas finance só para ADMIN/GROOM/BRIDE) |
| Convidados & RSVP | Taxa de resposta, plus-ones, VIPs, padrinhos, distribuição por cidade/grupo. | Todos |
| Presentes | CASH × ITEM, % agradecidos, top givers, cota lua de mel via PIX. | Todos (valores R$ só para ADMIN/GROOM/BRIDE) |
| Lua de Mel | Status por etapa (PLANNED→PAID), por tipo de item, % financiado via PIX. | ADMIN/GROOM/BRIDE |
| Enxoval | Progresso por cômodo, essenciais pendentes. | Todos |
| Timeline de Atividade | Últimas 100 alterações no `AuditLog`. | ADMIN/GROOM/BRIDE |

Relatórios "Curva S", "Burndown de Tarefas" e "Waterfall de Variação" não
ficam aqui — vivem em `/dashboard/insights` (financeiro) e o hub apenas
linka via âncora.

## Insights (`/dashboard/insights`)

Continua sendo o lar dos gráficos financeiros. Ganhou três seções:

- **Curva S — Previsto vs Realizado** (`#scurve`): linhas cumulativas de
  `Payment.dueDate` (previsto) e `Payment.paidAt` (realizado), com banda
  ±`EventSettings.contingencyPercent`.
- **Burndown de Tarefas** (`#burndown`): linha ideal (decrescente do total
  ao zero entre o primeiro `createdAt` e `EventSettings.eventDate`) vs
  real (decremento por `Task.completedAt`).
- **Variação por Categoria — Waterfall** (`#waterfall`): cada barra é o
  delta `actual - estimated` por categoria, com barra "Total" no fim.
  Verde = poupou, rosa = estourou.

## Versão sanitizada do dashboard

O dashboard principal (`/dashboard`) renderiza um layout diferente para
roles que **não passam** em `canViewSensitiveFinance` (ADMIN, GROOM,
BRIDE):

- KPI cards trocados de R$ por contagens operacionais (fornecedores
  contratados, tarefas concluídas, convidados confirmados, dias até o
  evento).
- Esconde Pie de orçamento e lista de pagamentos.
- Mantém Risk Strip (apenas alertas não-financeiros), funil de
  fornecedores, RSVP mini, gifts mini, próximas tarefas.

## Helpers em `src/lib/reports/`

Cada relatório tem um helper puro testável:

| Arquivo | Função principal |
|---------|------------------|
| `dashboard-data.ts` | `loadDashboardData(role)` — agrega tudo do dashboard principal, respeita permissão |
| `payment-curve.ts` | `buildPaymentSCurve(payments, contingencyPercent)` |
| `vendor-funnel.ts` | `buildVendorFunnel(vendors, resolveLabel)` |
| `risk-radar.ts` | `computeRiskAlerts({...})` |
| `guests-analytics.ts` | `buildGuestsAnalytics(guests, groups)` |
| `gifts-analytics.ts` | `buildGiftsAnalytics(gifts)` |
| `task-burndown.ts` | `buildTaskBurndown(tasks, eventDate, today?)` |
| `honeymoon-progress.ts` | `buildHoneymoonProgress(honeymoon, items, gifts)` |
| `trousseau-progress.ts` | `buildTrousseauProgress(items)` |

`buildCategoryWaterfall` continua em `src/lib/cashflow.ts` (próximo dos
demais utilitários financeiros).

## Wrappers Recharts

`src/components/charts/`: `chart-theme.ts` (paleta + tooltip dark),
`donut.tsx`, `stacked-bar.tsx`, `s-curve.tsx`, `burndown.tsx`,
`waterfall.tsx`, `radial-progress.tsx`, `sparkline.tsx`. Use-os ao criar
novos relatórios para manter consistência visual.
