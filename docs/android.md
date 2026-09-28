# Android nativo

O projeto [android/](../android/README.md) usa Kotlin, Jetpack Compose, Room/SQLite, DataStore e WorkManager. Seu `applicationId` e namespace são `br.com.paivalab.weddingmanagementsystem`, com `minSdk 30` e `targetSdk 36`. O aplicativo não inicia o Next.js nem depende de Node/npm ou hospedagem no telefone.

## O que está implementado

- Identidade visual escura rosa/champagne, painel, barra inferior e catálogo móvel das áreas principais.
- Cadastro local genérico de finanças, fornecedores, contratos, locais, convidados, grupos, tags, tarefas, mesas, presentes, lua de mel e enxoval; busca, edição, exclusão lógica e histórico local. RSVP individual e em grupo é lançado manualmente. Importação local de convidados do CSV do web e de planilha `.xlsx` Wedy, com prévia e deduplicação por nome/grupo.
- Tags podem ser atribuídas no cadastro de convidados e usadas como filtro na lista.
- Regras de centavos inteiros, orçamento previsto e real separados, parcelas cuja soma fecha no centavo, capacidade de mesas com acompanhantes, baixa única de presente para receita, projeção mensal de caixa, pontuação financeira inicial e 33 modelos de tarefas portados do web. O Dia D tem cronograma, plano B, notas e check-in local.
- O Dia D mostra ocupação de cada mesa e convidados confirmados ainda sem mesa.
- Receitas podem ser registradas uma vez ou como recorrência mensal, considerada na projeção de caixa.
- Insights com indicadores e exportação CSV dos registros ativos pelo seletor de documentos.
- Anexos privados em BLOB no Room, exportáveis pelo seletor de documentos.
- Contratos exibem e permitem editar o número da versão. O histórico detalhado de versões dos anexos do web ainda não foi reconstruído.
- Desbloqueio com biometria forte ou credencial do aparelho, retomado após cinco minutos em segundo plano.
- Convites individuais por WhatsApp ou compartilhamento, com confirmação manual de envio.
- Chave Pix estática configurável e compartilhável, com baixa manual; atalhos para discador, WhatsApp e mapas em fornecedores, contatos e locais. O endereço de locais pode ser editado no Android.
- Comparação de fornecedores por categoria, avaliação, situação, orçamento previsto/real e pagamentos confirmados.
- Lembretes locais aproximados via WorkManager; verificação ao abrir, aviso semanal de backup quando há mudanças e exportação `.ics` de tarefas e pagamentos.
- Backup `.wfpbackup` v2 aceito pelo web e Android, com registros, anexos, artes, histórico, todos os uploads e estado web preservado; AES-256-GCM, PBKDF2-HMAC-SHA256 (600 mil iterações), senha escolhida na exportação e prévia validada antes da substituição.
- Cofre Android Keystore para SQLite/arquivos web exclusivos e cópia privada de reversão antes de cada substituição. A última reversão pode ser exportada pela tela de Backup.
- Ferramenta `android/tools/portable_v2.py` para cópia do SQLite web + `uploads/`; importação JSON v2/v3 e `.wfpbackup` v1 ficam como recuperação parcial. O relatório lista contagens, omissões e inconsistências.

## Limites da versão de desenvolvimento

As telas são genéricas e vários campos específicos do web ficam preservados sem edição no Android. O Pix compartilha a chave, sem QR Code ou verificação bancária. Ainda faltam layout gráfico de mesas, cronograma estruturado, relatórios equivalentes ao web e teste de atualização real do APK **assinado**. O relatório CSV exporta campos essenciais, mas não replica os relatórios detalhados do web. Os títulos dos modelos de tarefas portados permanecem em português. Testes instrumentados verificam Room, restauração nativa, fixture Python v2, arquivo corrompido e migração v1→v2. Uma cópia dos dados reais da Área de Trabalho passou pela importação no emulador Android e voltou a ser validada no web: 339 registros móveis, 10 arquivos, 31 tabelas web sem linhas alteradas e 10 hashes de uploads idênticos. Uma edição móvel de convidado sobreviveu ao ciclo web → Android → web → Android; um pacote criado em Android vazio também percorreu Android → web → Android com fornecedor, convidada e anexo. Ainda falta ensaiar interrupção física do processo durante a restauração. O importador JSON web não contém arquivos e pode perder tags e histórico de disparos que não estavam naquele formato. A pontuação e os gráficos são iniciais.

O Room tem esquema v2 com migração explícita da v1, testada em emulador. Migrações futuras precisam de teste com esquema exportado; não usar `fallbackToDestructiveMigration`. A restauração substitui o banco em uma transação Room, incluindo BLOBs, e valida o pacote antes. O limite artificial de 200 MB do pacote foi removido, mas cada BLOB ainda precisa caber na memória e no limite de array do Android; volumes grandes e pouco espaço exigem testes adicionais. Não publicar APK de produção antes dessa validação e dos testes de aceitação do plano.

## Migração segura

Pare alterações no web, preserve o banco original e `uploads/`, e execute a ferramenta descrita em [android/README.md](../android/README.md). Confira o relatório e restaure o `.wfpbackup` em instalação limpa de teste. Compare contagens e anexos antes de desativar o servidor. Ao desligá-lo, os links públicos antigos de RSVP deixam de funcionar; no Android a resposta é registrada manualmente.

## Assinatura

A chave fica fora do Git. Mantenha o mesmo `applicationId` e certificado para atualizar sem perder o banco local. A CI gera apenas APK de depuração; a publicação assinada em Releases é manual e ainda não foi realizada.
