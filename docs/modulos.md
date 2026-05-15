# 🧩 Módulos do Sistema

Visão funcional de cada módulo do dashboard, com a finalidade, telas e
comportamentos principais.

> 💡 Esta página é técnica. Para um tour passo-a-passo voltado ao usuário
> final, use a **Central de Ajuda** dentro do app: `/dashboard/help`.

---

## 1. 🏠 Dashboard (`/dashboard`)

- **O que mostra:** orçamento total, total pago, saldo devedor, cobertura de
  caixa, distribuição por categoria (gráfico de pizza) e próximos
  vencimentos (30 dias).
- **Alertas:** se faltam ≤ 20 dias e há fornecedores com saldo devedor,
  exibe alerta vermelho de quitação.
- **Contagem regressiva:** pílula com cor adaptativa (verde > 90 dias, amarelo
  90–30 dias, vermelho ≤ 30 dias).

---

## 2. 📊 Insights (`/dashboard/insights`)

- **Fluxo de caixa mensal** projetado entre hoje e a data do evento.
- **Health score** combinando: % contratado, % pago, cobertura de caixa,
  tarefas concluídas/atrasadas, pior saldo mensal.
- **Heatmap de pagamentos** dia-a-dia até a data do evento.
- **Detector de "creep"** por categoria — quando o real está estourando o
  estimado.
- **Simulador What-If** — projeta cenários hipotéticos.

---

## 3. 🤝 Fornecedores (`/dashboard/vendors`)

- **Status:** `NEGOTIATION` → `CONTRACTED` → `FINALIZED`.
- **Detalhes** por fornecedor: contatos múltiplos (com flag isPrimary),
  contratos versionados, notas com histórico, anexos (PDFs, fotos).
- **Comparador** (`/vendors/compare`) para colocar lado-a-lado.
- **Categorias** definidas em [src/lib/categories.ts](../src/lib/categories.ts)
  com cores e ícones.

---

## 4. 🏛️ Locais (`/dashboard/venues`)

- Cadastrar locais com capacidade (sentados/em pé), preço base, prós/contras,
  visitação, restrições.
- **Checklist** com itens ordenáveis para usar em visitas.
- **Shortlist** (flag) para destacar os finalistas.

---

## 5. ✅ Tarefas (`/dashboard/tasks`)

- Status: `TODO` / `IN_PROGRESS` / `DONE`.
- Prioridade: `LOW` / `MEDIUM` / `HIGH`.
- Responsável livre (texto) — sugestão: "noivo", "noiva", "ambos",
  "cerimonial".
- Vínculo opcional a fornecedor ou local.
- **Templates pré-prontos:** `loadTaskTemplates` cria tarefas baseadas no
  calendário (offsets a partir da data do evento).

---

## 6. 💸 Pagamentos (`/dashboard/payments`)

- Cada pagamento tem `amount`, `dueDate`, `status` (PENDING/PAID), `method`
  (PIX/BOLETO/CREDIT/TRANSFER/CASH), e suporta parcelamento
  (`installmentNumber/totalInstallments`).
- Marca como pago atomicamente e dispara revalidação.
- **Lembretes automáticos** via cron quando faltam ≤ 3 dias ou está atrasado.

---

## 7. 💰 Receitas (`/dashboard/income`)

- Fontes: `SALARY` ou `OTHER`.
- Status: `EXPECTED` / `RECEIVED`.
- Frequência: `ONE_TIME` / `MONTHLY` / `QUARTERLY` / etc.
- Suporta donativos (ex.: ajuda dos pais) com `givenByName`.

---

## 8. 🏦 Caixa (`/dashboard/assets`)

- Registra entradas/saídas de poupança para o casamento.
- Pode vincular a uma `SavingsGoal`.

---

## 9. 🎯 Metas (`/dashboard/goals`)

- `targetAmount`, `targetDate`, `isActive`.
- Cada meta pode ter `Asset`s vinculados — o sistema calcula o progresso (%).

---

## 10. 👥 Convidados (`/dashboard/guests`)

- Cadastrar nome, telefone, email, "lado" (família dele/dela), grupo.
- **RSVP por link público:** `rsvpToken` único (cuid) → URL pública
  `/rsvp/[token]`.
- Status: `INVITED` / `CONFIRMED` / `DECLINED` / `MAYBE`.
- `plusOnesAllowed` vs. `plusOnesConfirmed`.
- Flags: `isVIP`, `isPadrinho`, `isChild`.
- Restrições alimentares (`dietary`).
- Check-in no dia (`checkedInAt`).

---

## 11. 🎁 Presentes (`/dashboard/gifts`)

- Vinculáveis a um `Guest` (opcional).
- Tipo: `CASH` ou `ITEM`.
- Status: `RECEIVED` / `THANKED`.
- Suporta múltiplos presentes por convidado.

---

## 12. 💍 Dia D (`/dashboard/wedding-day`)

- **Cronograma do dia** (texto livre).
- **Plano B chuva** / contingências.
- **Observações especiais** (música primeira dança, etc.).
- **Contatos críticos:** fornecedores `CONTRACTED/FINALIZED` com `wa.me`
  direto.
- **Tarefas e pagamentos do dia** filtrados automaticamente.
- **Check-in rápido** de convidados com busca textual.

---

## 13. 🌴 Lua de Mel (`/dashboard/honeymoon`)

- Singleton: destino, datas, orçamento, moeda.
- Itens (`HoneymoonItem`): atividades, hospedagens, vôos com
  `confirmationNumber`, `status`, valores e janela `startAt/endAt`.

---

## 14. 🛏️ Enxoval (`/dashboard/trousseau`)

- Itens por cômodo (`COZINHA`, `SALA`, `QUARTO`, etc.).
- Prioridade: `MUST_HAVE` / `NICE_TO_HAVE`.
- Status: `TO_BUY` / `BOUGHT`.
- `estimatedPrice` vs `actualPrice`, com link e loja.

---

## 15. ⚙️ Ajustes (`/dashboard/settings`)

Abas:

- **Casamento:** data, contingência, moeda, nomes do casal, cronograma e plano
  B do dia.
- **Segurança:** 2FA do próprio usuário, lista de membros, mudar senha.
- **Time:** criar/arquivar usuários (somente admins).
- **WhatsApp:** conectar via QR Code (admin only).
- **Perfil:** dados pessoais.
- **Backup:** download de JSON com todos os dados.

---

## 16. 🪄 Onboarding (`/dashboard/onboarding`)

Wizard de 4 passos exibido **uma única vez** após a primeira troca de senha do
admin:

1. Casal — nomes, data, moeda.
2. Orçamento — contingência (slider 0–30%).
3. Comunicações — instruções para configurar SMTP/WhatsApp depois.
4. Resumo + Concluir.

Grava `EventSettings.onboardingCompletedAt`; depois o middleware deixa o admin
livre.

---

## 17. ❓ Central de Ajuda (`/dashboard/help`)

Hub interativo com busca, filtros, passo-a-passo de cada feature, FAQ e
changelog. Veja [Central de Ajuda](#central-de-ajuda-interna) no README de
docs.

---

## Fluxos cruzados

| Evento | Cron | Email | WhatsApp | Sino in-app |
|---|---|---|---|---|
| Conta criada (admin cria usuário) | — | ✅ | ✅ | — |
| Reset de senha | — | ✅ | ✅ | — |
| Pagamento vence em 3 dias | a cada 30 min | ✅ | ✅ | — |
| Pagamento atrasado | a cada 30 min | ✅ | ✅ | — |
| Tarefa vence em 2 dias | a cada 30 min | ✅ | ✅ | — |
| Tarefa atrasada | a cada 30 min | ✅ | ✅ | — |

> ℹ️ Toda notificação é idempotente por dia (ver `NotificationLog`).
