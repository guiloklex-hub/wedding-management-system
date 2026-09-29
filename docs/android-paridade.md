# Auditoria de paridade: web × Android

Inventário do código em 29/09/2026. A web usa Next.js, Prisma e serviços do servidor. O Android atual usa Room e funciona offline; o backup `.wfpbackup` transporta dados entre instalações, mas não sincroniza alterações em tempo real.

A versão Android `1.1.0` inclui a nova tela de desbloqueio ilustrada. Ela foi verificada no Samsung SM-S908E com biometria/PIN e preservação dos dados restaurados.

Legenda: **sim** = fluxo principal equivalente; **parcial** = tela existe, mas faltam operações ou análises; **local** = alternativa offline; **não** = sem equivalente no Android.

| Tela/fluxo web | Android atual | Diferença relevante |
|---|---|---|
| `/dashboard` | Parcial | Indicadores e próximas ações existem; os cartões de RSVP, presentes, risco e atividade não têm todos os mesmos recortes da web. |
| `/dashboard/insights` | Parcial | Indicadores, caixa e riscos locais existem; Curva S, burndown e waterfall detalhados não foram portados. |
| `/dashboard/reports` e 10 entradas | Parcial | Há um hub móvel e telas resumidas para fluxo de caixa, funil, riscos, convidados, presentes, tarefas, lua de mel, enxoval e atividade. Gráficos, séries temporais e filtros da web ainda diferem. |
| `/dashboard/vendors` | Sim | Lista, edição, filtros e comparação locais. |
| `/dashboard/vendors/compare` | Parcial | Comparação local mostra valores, pagamentos, avaliação e status; recortes e visualização não são idênticos. |
| `/dashboard/vendors/[id]` | Parcial | Página dedicada móvel reúne contatos, observações, cláusulas, contratos, PDFs, inclusive versões anteriores arquivadas, orçamento e pagamentos. Assinatura formal da web ainda não tem fluxo móvel. |
| `/dashboard/venues` | Sim | Cadastro, busca e edição locais. |
| `/dashboard/venues/[id]` | Parcial | Página dedicada móvel mostra condições, restrições, checklist e anexos; faltam alguns campos de edição da web. |
| `/dashboard/tasks` | Parcial | Tarefas, prazos, prioridades e modelos locais; automações/avisos dependentes do servidor diferem. |
| `/dashboard/payments` | Parcial | Parcelas, status, multa e juros locais; notificações por email/WhatsApp da web não rodam offline. |
| `/dashboard/income`, `/assets`, `/goals` | Sim | Cadastros e totais locais; projeção e visualização têm diferenças. |
| `/dashboard/guests`, `/guests/groups`, `/guests/import` | Parcial | Lista, grupos, RSVP manual, CSV e XLSX Wedy; importação e envio em lote da web têm fluxos distintos. |
| `/dashboard/gifts`, `/gifts/[id]/pix` | Parcial | Presente e Pix individual com valor e identificador do presente; baixa continua manual, sem confirmação automática. |
| `/dashboard/wedding-day`, `/wedding-day/seating` | Parcial | Cronograma, plano B, check-in e mesas locais; não há arrastar e soltar da web. |
| `/dashboard/honeymoon`, `/trousseau` | Parcial | Cadastro e resumos locais; alguns campos, moedas de item e gráficos ainda diferem. |
| `/dashboard/save-the-date`, `/invitations` | Parcial | Modelo local, anexo, envio individual pelo compartilhamento do Android e confirmação manual. Disparos em lote, controle de entrega, PIN e links públicos de RSVP exigem o servidor web. |
| `/dashboard/settings`, `/onboarding` | Local | Ajustes do evento, idioma, moeda, Pix, backup e segurança do aparelho. O wizard e configurações de servidor da web não foram reproduzidos. |
| `/dashboard/profile`, `/profile/change-password` | Não | Contas, senha e 2FA são conceitos do servidor; o Android offline usa biometria ou PIN do aparelho. |
| `/dashboard/help` | Parcial | Ajuda móvel curta; conteúdo extenso e histórico da web não foram portados. |
| `/login`, recuperação de senha e `/rsvp/[token]` | Não | Autenticação e RSVP público dependem de servidor acessível. O Android registra respostas manualmente. |

## Anexos em convites pelo WhatsApp

O convite móvel agora seleciona um anexo do modelo, verifica o tamanho e SHA-256 do arquivo guardado no Room e compartilha uma URI `content://` temporária, com permissão apenas de leitura. A ação `ACTION_SEND` inclui `EXTRA_STREAM`, o tipo MIME e o texto personalizado. Sem anexo, o link `wa.me` continua abrindo diretamente a conversa do número informado. Com mídia, o WhatsApp exige que o usuário selecione e confira o destinatário. Abrir o WhatsApp não comprova a entrega; a marcação de envio permanece manual.

## Próximas lacunas de paridade

1. Definir se as funções que dependem do servidor serão sincronizadas no Android ou terão apenas alternativas locais.
2. Portar campos e ações restantes dos detalhes de fornecedor/local, especialmente a assinatura formal e a substituição de PDF com incremento automático de versão.
3. Portar visualizações e filtros completos dos relatórios, mais a central de ajuda.
4. Validar o envio concluído pelo usuário e o fluxo separado do WhatsApp Business. No Samsung SM-S908E, a prévia do WhatsApp já mostrou a imagem e o texto do convite juntos; nenhum envio foi confirmado.

O arquivo de backup preserva o SQLite e os uploads da web, inclusive dados que ainda não têm interface móvel. A restauração v2 confere cada contrato e anexo do SQLite com sua representação Android e recusa um pacote com contrato ou PDF faltante. A prévia informa as contagens de contratos e PDFs, incluindo versões arquivadas. Preservação de dados não equivale a paridade funcional.

Em 29/09/2026, a cópia web local foi restaurada em um banco temporário no Samsung SM-S908E: 339 registros móveis, 10 arquivos, 31 tabelas web, 7 contratos e 7 PDFs de contrato. Todos os BLOBs passaram na verificação de SHA-256. O teste apagou o pacote temporário e os arquivos de senha do aparelho ao terminar; os dados fictícios de interface foram removidos antes de instalar o APK de produção.

O backup real escolhido pelo usuário no aparelho teve prévia íntegra de 339 registros móveis, 10 anexos, 32 tabelas web, 7 contratos e 7 PDFs de contrato. Após confirmação e autenticação no próprio celular, a restauração na versão de produção foi concluída. A lista mostrou 7 contratos; o detalhe do fornecedor exibiu contato, cláusulas e PDF, que abriu no Adobe Acrobat. Uma atualização do APK com a mesma assinatura preservou os dados restaurados e corrigiu a apresentação da data de vencimento importada como segundos Unix.

No convite restaurado, o compartilhamento do Android mostrou 1 imagem com a mensagem. Ao escolher o WhatsApp e selecionar a própria conversa no teste, a prévia exibiu a imagem e a legenda, antes do botão de enviar. O teste foi cancelado e o convite não foi marcado como enviado.
