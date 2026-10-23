# Auditoria de paridade: web × Android

Inventário do código em 29/09/2026. A web usa Next.js, Prisma e serviços do servidor. O Android atual usa Room e funciona offline; o backup `.wfpbackup` transporta dados entre instalações, mas não sincroniza alterações em tempo real.

A versão Android `1.1.0` inclui a nova tela de desbloqueio ilustrada. Ela foi verificada no Samsung SM-S908E com biometria/PIN e preservação dos dados restaurados.

Legenda: **sim** = fluxo principal equivalente; **parcial** = tela existe, mas faltam operações ou análises; **local** = alternativa offline; **não** = sem equivalente no Android.

| Tela/fluxo web | Android atual | Diferença relevante |
|---|---|---|
| `/dashboard` | Parcial | Mesmos números da web (orçamento com contingência, pago, saldo devedor, cobertura de caixa), alerta de quitação, próximas ações com os 7 tipos, funil, RSVP, presentes e próximos vencimentos. Falta o gráfico de distribuição por categoria. |
| `/dashboard/insights` | Sim | Health score com os 6 fatores, alertas e recomendações; sobra até o evento; fluxo de caixa projetado; entradas e saídas por mês; Curva S com banda de contingência; burndown de tarefas; simulador "Posso fechar esse contrato agora?"; variação por categoria em cascata e em lista; concentração de pagamentos pendentes. A narrativa por IA depende do servidor. |
| `/dashboard/reports` e 10 entradas | Parcial | Há um hub móvel e telas resumidas para fluxo de caixa, funil, riscos, convidados, presentes, tarefas, lua de mel, enxoval e atividade. Gráficos, séries temporais e filtros da web ainda diferem. |
| `/dashboard/vendors` | Sim | As 23 categorias da web com cor, avaliação, situação na lista (ao contratar sem valor real, pede o valor contratado) e orçamento estimado criado junto com o fornecedor. |
| `/dashboard/vendors/compare` | Sim | Escolha de 2 a 4 fornecedores; valores, pagamentos, saldo, avaliação, situação, indicação, tags e contagem de contatos, notas e contratos. |
| `/dashboard/vendors/[id]` | Sim | Contatos, observações, cláusulas, contratos com "Marcar assinado" (digital ou físico), substituição do PDF com nova versão e arquivo da anterior, tipo de cada anexo, orçamento e pagamentos com exclusão. |
| `/dashboard/venues` | Sim | Cadastro, busca e edição locais; o cartão mostra pré-seleção, capacidade, progresso do checklist e data da visita. |
| `/dashboard/venues/[id]` | Sim | Condições, restrições, visita (`visitedAt`), anexos e checklist com resposta, ordem e progresso. |
| `/dashboard/tasks` | Sim | Lista e Kanban, filtros "em aberto", "atrasadas" e "próximos 7 dias", barra de fases, responsável, fornecedor, local e `completedAt`. Avisos por email/WhatsApp são da web. |
| `/dashboard/payments` | Sim | Lista e calendário mensal com resumo do ano, marcar e desfazer pagamento, sinal + saldo, parcelas com intervalo em dias, forma de pagamento, multa e juros. Avisos por email/WhatsApp são da web. |
| `/dashboard/income`, `/assets`, `/goals` | Sim | Origem da receita como na web, "dado por", data de recebimento; metas com ativa/inativa, falta, valor por mês e aportes. |
| `/dashboard/guests`, `/guests/groups`, `/guests/import` | Parcial | Indicadores, filtros (confirmados, pendentes, padrinhos, crianças, presentes no evento), exportação CSV com as colunas da web, check-in reversível, idade e idioma. Grupos com contato, resumo de RSVP, aviso de grupo sem contato e gestão de integrantes. A importação por colagem de texto e os três modos de deduplicação da web ainda diferem; o PIN e o link público de RSVP dependem do servidor. |
| `/dashboard/gifts`, `/gifts/[id]/pix` | Sim | Tipo dinheiro ou item, quem deu, cota da lua de mel, marcar ou desmarcar agradecimento, lançar como receita ou ativo uma única vez, filtro "falta agradecer", indicadores e Pix individual. A confirmação automática do Pix é da web. |
| `/dashboard/wedding-day`, `/wedding-day/seating` | Parcial | Cronograma, plano B, check-in e mesas locais; não há arrastar e soltar da web. |
| `/dashboard/honeymoon`, `/trousseau` | Sim | Lua de mel como viagem única, com destino, saída, volta, orçamento e moeda; itens agrupados por tipo, com companhia, início, fim, moeda própria e localizador; comprometido e documentos pendentes. Enxoval ordenado por prioridade, com link da loja, atalhos "comprado" e "ganhei" e indicadores. |
| `/dashboard/save-the-date`, `/invitations` | Parcial | Modelo local, anexo, envio individual pelo compartilhamento do Android e confirmação manual. Disparos em lote, controle de entrega, PIN e links públicos de RSVP exigem o servidor web. |
| `/dashboard/settings`, `/onboarding` | Local | Assistente na primeira execução (casal, data, moeda, idioma, contingência, tarefas recomendadas ou dados de exemplo). Ajustes do evento, idioma, moeda, Pix, backup e segurança do aparelho; configurações de servidor (SMTP, WhatsApp) são da web. |
| `/dashboard/profile`, `/profile/change-password` | Não | Contas, senha e 2FA são conceitos do servidor; o Android offline usa biometria ou PIN do aparelho. |
| `/dashboard/help` | Parcial | Ajuda móvel curta; conteúdo extenso e histórico da web não foram portados. |
| `/login`, recuperação de senha e `/rsvp/[token]` | Não | Autenticação e RSVP público dependem de servidor acessível. O Android registra respostas manualmente. |

## Anexos em convites pelo WhatsApp

O convite móvel agora seleciona um anexo do modelo, verifica o tamanho e SHA-256 do arquivo guardado no Room e compartilha uma URI `content://` temporária, com permissão apenas de leitura. A ação `ACTION_SEND` inclui `EXTRA_STREAM`, o tipo MIME e o texto personalizado. Sem anexo, o link `wa.me` continua abrindo diretamente a conversa do número informado. Com mídia, o WhatsApp exige que o usuário selecione e confira o destinatário. Abrir o WhatsApp não comprova a entrega; a marcação de envio permanece manual.

## Integridade da ida e volta (Android v1.1.1)

- Campos detalhados editados no Android (lado, VIP, padrinho, criança, dieta e check-in do convidado; forma de pagamento, multa, juros e `paidAt`; prioridade e descrição da tarefa; frequência da receita; cláusulas e validade do contrato; detalhes do local; avaliação do fornecedor; cômodo e prioridade do enxoval; `processedAt` do presente) voltam ao web quando o backup traz `fieldMap: 1`. Veja [backup-restore.md](backup-restore.md#campos-detalhados-extrajson-e-fieldmap).
- O Android grava os enums web (`NOIVA/NOIVO/AMBOS`, `CREDIT`, `CASH`, cômodos `KITCHEN…`, prioridades `ESSENTIAL/NICE_TO_HAVE/LUXURY` e `URGENT` nas tarefas) e lê booleanos 0/1 e datas em milissegundos vindos do SQLite web.
- Pagamentos exigem fornecedor e vencimento, e fornecedores exigem categoria, já no Android; antes isso só falhava na restauração web.
- Excluir no Android tem os mesmos efeitos do web: fornecedor leva orçamento, pagamentos, contatos, notas e contratos; meta, grupo, mesa e convidado apenas desvinculam os filhos.
- Radar de riscos, fluxo de caixa (só pagamentos pendentes), totais de orçamento e dias de atraso usam as mesmas regras do web.

## Fundação da interface (Fase 1)

Navegação tipada com estado preservado, editor em tela cheia com validação igual à da web, "Desfazer" e lixeira, temas claro/escuro, layout para telas largas, textos nos três idiomas e anexos fora do SQLite. Detalhes em [android.md](android.md#arquitetura-da-interface). Ainda falta o layout de lista e detalhe lado a lado em tablets.

## Painel, tarefas e pagamentos (Fase 2, parte 1)

- O painel usa `DashboardMetrics` e `ActionStream`, portas de `src/lib/reports/dashboard-data.ts` e `src/lib/action-stream.ts`: o orçamento total soma os itens de fornecedores ativos (`actualValue ?? estimatedValue`) mais a contingência sobre o contratado, como na web.
- `completedAt` da tarefa segue a Server Action: gravado ao concluir, preservado em edições e apagado ao reabrir.
- Parcelas usam intervalo em dias (padrão 30) e no máximo 60 parcelas, como `generateInstallments`; "Sinal + saldo" grava o sinal pago hoje e o saldo pendente, como `createSplitPayment`.
- Na web, o fluxo de ações deixou de mostrar contratos assinados (`SIGNED_DIGITAL`/`SIGNED_PHYSICAL`) e cancelados como "a expirar".

## Convidados e presentes (Fase 2, parte 2)

- Os estados de presente seguem a web: só `RECEIVED` e `THANKED`, com `thankedAt` acompanhando o estado. `PENDING` e `PROCESSED` de versões anteriores do Android viram `RECEIVED` ao salvar (o lançamento continua registrado em `processedAt`).
- "Lançar" cria uma receita com fonte `GIFT` e `givenByName`, ou um ativo, como `convertGiftCashToIncomeOrAsset`; só presentes em dinheiro com valor podem ser lançados.
- O resumo do grupo usa a mesma regra de contato de `summarizeGroup`: o contato do próprio grupo e, sem ele, o primeiro integrante com telefone válido (E.164) ou e-mail.

## Fornecedores e contratos (Fase 2, parte 3)

- `categoryKey` usa as mesmas 23 chaves e cores de `src/lib/categories.ts`; a descrição livre (`category`) acompanha a categoria escolhida até ser personalizada.
- Novo fornecedor exige o valor estimado e cria o item "Orçamento: nome", como `createVendor`. Contratar pelo botão "Situação" grava o valor real nos itens de orçamento, como `updateVendorStatus`.
- O primeiro PDF de um contrato fica com a versão do contrato; os seguintes arquivam o atual e incrementam a versão, como `replaceContractFile`. Contrato novo começa na versão seguinte às do fornecedor, como `createContract`.
- Anexos comuns pedem o tipo (proposta, recibo, nota fiscal, documento, foto, outro). Na web, a restauração passou a manter a versão do PDF e a converter o tipo genérico antigo do Android.

## Locais, receitas e metas (Fase 2, parte 4)

- Local novo nasce com o checklist de vistoria da web (desmarcável no editor). Cada item guarda a resposta (`value`, até 500 caracteres) e a ordem (`sortOrder`); as setas da tela do local reordenam os itens e um item novo entra no fim.
- A data do local é a data da visita (`visitedAt`).
- A origem da receita usa as 7 opções de `incomeActions`. Origens antigas em texto livre aparecem como "Outro", que é como a restauração web as grava. `receivedAt` é gravado ao marcar como recebida e limpo ao reabrir, como `updateIncome`; o presente lançado como receita usa a data escolhida.
- O cartão da meta repete o da web: falta, valor por mês (meses restantes arredondados para cima, em blocos de 30 dias) e quantidade de aportes. Metas inativas ficam no fim da lista.

## Lua de mel e enxoval (Fase 2, parte 5)

- A lua de mel abre numa tela própria, como `/dashboard/honeymoon`: os dados da viagem no topo e os itens agrupados por tipo, na ordem de início. O total comprometido soma todos os itens, como a web, e o indicador conta documentos ainda não confirmados nem pagos.
- Só existe uma viagem. A primeira é criada como `singleton`, que é o id da web, ao adicionar um item. A viagem não pode ser excluída. Sem destino, o registro guarda o título provisório `honeymoon`, e a web o devolve como destino vazio.
- Cada item tem moeda própria (BRL, USD ou EUR), companhia ou fornecedor (`vendor`) e data de fim (`endAt`). Um item novo nasce como "Atividade", o padrão da web.
- O enxoval abre ordenado por prioridade (essencial, desejável, luxo), cômodo e nome. Os atalhos "Comprado" e "Ganhei" alternam com "a comprar", como os botões da web. O item comprado ou ganho aparece riscado. O link da loja (até 500 caracteres) abre no navegador.

## Insights (Fase 2, parte 6)

- A tela segue a ordem de `/dashboard/insights` e calcula os números como `loadInsightsSnapshot`. O teste `InsightsRulesTest` compara o Android com valores gerados pelas próprias funções da web (`cashflow.ts`, `payment-curve.ts`, `task-burndown.ts`).
- O orçamento do health score agora usa o valor real dos itens (`actualValue ?? estimatedValue`) de fornecedores ativos, como a web; antes o Android usava o estimado. Os limites de cor também seguem a web (75 e 50).
- O fluxo de caixa lança a receita no mês em que foi recebida (`receivedAt`) e, sem recebimento, no mês previsto, como a web. Isso vale também para o painel e o radar de riscos.
- Os gráficos são desenhados em Compose (`ui/Charts.kt`), sem biblioteca nova. Tocar ou arrastar mostra os valores do ponto; cada gráfico tem descrição para leitor de tela.
- Os rótulos dos fatores e os alertas do health score estão traduzidos nos 3 idiomas; na web ainda estão fixos em português.
- A demografia para o buffet e a exportação CSV continuam no fim da tela até a parte de relatórios.

## Próximas lacunas de paridade

1. Definir se as funções que dependem do servidor serão sincronizadas no Android ou terão apenas alternativas locais.
2. Portar relatórios com gráficos e mapa de mesas com arrastar e soltar.
3. Portar visualizações e filtros completos dos relatórios, mais a central de ajuda.
4. Validar o envio concluído pelo usuário e o fluxo separado do WhatsApp Business. No Samsung SM-S908E, a prévia do WhatsApp já mostrou a imagem e o texto do convite juntos; nenhum envio foi confirmado.

O arquivo de backup preserva o SQLite e os uploads da web, inclusive dados que ainda não têm interface móvel. A restauração v2 confere cada contrato e anexo do SQLite com sua representação Android e recusa um pacote com contrato ou PDF faltante. A prévia informa as contagens de contratos e PDFs, incluindo versões arquivadas. Preservação de dados não equivale a paridade funcional.

Em 29/09/2026, a cópia web local foi restaurada em um banco temporário no Samsung SM-S908E: 339 registros móveis, 10 arquivos, 31 tabelas web, 7 contratos e 7 PDFs de contrato. Todos os BLOBs passaram na verificação de SHA-256. O teste apagou o pacote temporário e os arquivos de senha do aparelho ao terminar; os dados fictícios de interface foram removidos antes de instalar o APK de produção.

O backup real escolhido pelo usuário no aparelho teve prévia íntegra de 339 registros móveis, 10 anexos, 32 tabelas web, 7 contratos e 7 PDFs de contrato. Após confirmação e autenticação no próprio celular, a restauração na versão de produção foi concluída. A lista mostrou 7 contratos; o detalhe do fornecedor exibiu contato, cláusulas e PDF, que abriu no Adobe Acrobat. Uma atualização do APK com a mesma assinatura preservou os dados restaurados e corrigiu a apresentação da data de vencimento importada como segundos Unix.

No convite restaurado, o compartilhamento do Android mostrou 1 imagem com a mensagem. Ao escolher o WhatsApp e selecionar a própria conversa no teste, a prévia exibiu a imagem e a legenda, antes do botão de enviar. O teste foi cancelado e o convite não foi marcado como enviado.
