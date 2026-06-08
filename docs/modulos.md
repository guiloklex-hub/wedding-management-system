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
- **Próximas ações:** card no topo (`ActionStreamCard`) com a lista priorizada
  de itens acionáveis — pagamentos atrasados/a vencer, tarefas atrasadas/no
  prazo, contratos a expirar, RSVP sem resposta e agradecimentos pendentes.
  Cada linha leva direto à tela da ação. A priorização (atrasados primeiro) e o
  ordenamento são do helper puro [src/lib/action-stream.ts](../src/lib/action-stream.ts)
  (`aggregateActionStream`); itens financeiros só aparecem para quem tem
  permissão. Mostra até 10 e indica "+N ações" quando há mais; estado vazio
  positivo ("tudo em dia").
- **Alertas:** se faltam ≤ 20 dias e há fornecedores com saldo devedor,
  exibe alerta vermelho de quitação. O **Risk Radar** (sinais de atenção)
  continua abaixo — agregado/preditivo, complementar ao stream de ações.
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
- **Grupo via seletor:** no cadastro/edição do convidado o grupo é escolhido
  num `<select>` dos grupos existentes (ou "+ Criar novo grupo" inline). A ação
  grava o vínculo real `groupId` **e** o espelho `groupName` (mantidos sempre em
  sincronia). Digitar texto livre não existe mais — isso evita o convidado ficar
  "órfão" do grupo e fora do RSVP coletivo / Save the Date.
- **RSVP por link público:** `rsvpToken` único (cuid) → URL pública
  `/rsvp/[token]`.
- Status: `INVITED` / `CONFIRMED` / `DECLINED` / `MAYBE`.
- `plusOnesAllowed` vs. `plusOnesConfirmed`.
- Flags: `isVIP`, `isPadrinho`, `isChild`.
- Restrições alimentares (`dietary`).
- Check-in no dia (`checkedInAt`).
- Telefone validado no cadastro (apenas dígitos, `+ ( ) - ` e espaços).

### Grupos / Famílias (`/dashboard/guests/groups`)

- Grupo é entidade própria (`GuestGroup`) com link de RSVP coletivo.
- **Contato do grupo (quem recebe Save the Date):** pode ser preenchido
  selecionando um **integrante** do grupo — nome/telefone/email são copiados
  do convidado para os campos de contato (que continuam editáveis). Sem digitar
  o mesmo dado duas vezes.
- Renomear o grupo propaga o novo nome ao espelho `groupName` de todos os membros.
- Resposta de RSVP do grupo notifica os gestores com status real
  (`CONFIRMED` / `DECLINED` / `PARTIAL`), não mais um genérico "Respondeu".
- **Tela com busca, filtros, ordenação e paginação** (12 por página):
  - Filtros: sem contato, com pendência, todos confirmaram, sem integrantes.
  - Ordenação: nome, nº de pessoas, nº de pendências.
  - Indicadores no topo: grupos, pessoas agrupadas, com pendência, sem contato.
- **Aviso de alcance no card:** badge "sem contato — não recebe Save the Date" ou
  "usará contato de {integrante}" (fallback), espelhando a regra de
  [recipients.ts](../src/lib/notifications/recipients.ts) via o helper puro
  `summarizeGroup` ([group-summary.ts](../src/app/dashboard/guests/groups/group-summary.ts)).
  Botão WhatsApp (`wa.me`) e export CSV da lista de grupos.

---

## 11. 🎁 Presentes (`/dashboard/gifts`)

- Vinculáveis a um `Guest` (opcional).
- Tipo: `CASH` ou `ITEM`.
- Status: `RECEIVED` / `THANKED`.
- Suporta múltiplos presentes por convidado.
- **Lançar nas finanças** (presentes `CASH`): converte o valor em `Income`
  (fonte `GIFT`, status `RECEIVED`) **ou** `Asset` (caixa/reserva), escolhendo
  descrição e data. A operação é atômica (`$transaction`) e idempotente — grava
  `Gift.processedAt` via `updateMany ... { processedAt: null }`, fechando a
  corrida de dupla conversão. Audita `CONVERT_TO_FINANCE`.
- **Anti dupla contagem:** marcar o Pix como recebido com "Adicionar ao caixa"
  também grava `processedAt`; uma vez lançado por qualquer caminho, o outro não
  duplica o valor. Indicadores na lista: **"Em dinheiro a lançar"** (soma dos
  `CASH` com `processedAt = null`) e selo **"Lançado"**.

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

## Paginação das listas

As listas que podem crescer são paginadas no cliente (20 itens por página) via
o componente reutilizável [`src/components/pagination.tsx`](../src/components/pagination.tsx)
(`usePagination` + `<Pagination>`). A busca/filtro continua sendo feita em
memória e a paginação recai sobre o resultado já filtrado — ao trocar o filtro,
volta para a página 1. O controle mostra números de página + Anterior/Próxima e
"Mostrando X–Y de Z", e some quando há uma página só.

Listas paginadas: Convidados, Tarefas (visão Lista), Pagamentos (visão Lista),
Presentes, Enxoval, Fornecedores, Receitas, Caixa e o histórico de envios em
Ajustes › Notificações (busca até 200 registros). Visões não-lista (Kanban de
tarefas, calendário de pagamentos) e listas curtas (Locais, Metas, Lua de Mel)
não são paginadas.
