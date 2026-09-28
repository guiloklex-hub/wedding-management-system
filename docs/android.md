# Android nativo (`v1.0.0`)

O projeto [android/](../android/README.md) usa Kotlin, Jetpack Compose, Room/SQLite, DataStore e WorkManager. Seu `applicationId` e namespace são `br.com.paivalab.weddingmanagementsystem`, com `minSdk 30` (`Android 11+`), `targetSdk 36`, `versionCode 2` e `versionName "1.0.0"`. O aplicativo roda 100% offline no aparelho sem depender de Next.js, Node/npm ou hospedagem externa.

- **Download do APK assinado (`v1.0.0`):** [`wedding-finance-planner-v1.0.0.apk`](https://github.com/guiloklex-hub/wedding-management-system/releases/download/v1.0.0/wedding-finance-planner-v1.0.0.apk)
- **SHA-256 do APK:** `ad4d56ae472c3904c04d48ce6e384b49e5eac3d6f44d542ffaf49b13bfee7be7`
- **Certificado de assinatura (SHA-256):** `ef0404a400b46675cfc9fcf62421273ddbad7e22e16a15e57eb617b89db65633` (`CN=Wedding Finance Planner, OU=Mobile, O=PaivaLab, L=Sao Paulo, ST=SP, C=BR`, RSA 4096 bits, APK Signature Scheme v3)

## O que está implementado

- Identidade visual escura rosa/champagne (Material 3 `ColorScheme` completo com badges semânticas, `DatePickerDialog` nativo e `FilterChip` por status/prioridade), painel com contagem regressiva e nomes do casal, barra inferior, catálogo móvel das áreas principais e base de demonstração completa em 1 toque (`DemoSeed`).
- Cadastro local completo de finanças, fornecedores, contratos, locais, convidados, grupos, tags, tarefas, mesas, presentes, lua de mel e enxoval; busca, edição rica de metadados (`extraJson`: CNPJ/CPF, avaliação 1-5 estrelas, multa/juros, restrições alimentares, faixa etária Adulto/Criança/Colo, vínculo pai de local/fornecedor/grupo/mesa), exclusão lógica e histórico local. RSVP individual e em grupo é lançado manualmente. Importação local de convidados do CSV do web e de planilha `.xlsx` Wedy, com prévia e deduplicação por nome/grupo.
- Tags podem ser atribuídas no cadastro de convidados e usadas como filtro na lista.
- Regras de centavos inteiros, reserva de contingência configurável (`contingencyPercent`), orçamento previsto e real separados, parcelas cuja soma fecha no centavo, cálculo automático de multa (`lateFeePercent`) e juros pro-rata die (`dailyInterestPercent`) em pagamentos vencidos, capacidade de mesas com acompanhantes, baixa única de presente para receita, projeção mensal de caixa, **Radar de Riscos** proativo (6 regras de auditoria financeira/contratual), **Resumo Demográfico para Buffet** (pagantes vs meias vs isentos e restrições alimentares), 20 itens padrão de **Checklist Técnico de Local** e 33 modelos de tarefas portados do web. O Dia D tem cronograma, plano B, notas e check-in local.
- O Dia D mostra ocupação de cada mesa e convidados confirmados ainda sem mesa.
- Receitas podem ser registradas uma vez ou como recorrência mensal, considerada na projeção de caixa.
- Insights com indicadores, radar de riscos, demografia para buffet e exportação CSV dos registros ativos pelo seletor de documentos.
- Anexos privados em BLOB no Room, exportáveis pelo seletor de documentos.
- Contratos exibem e permitem editar o número da versão. O histórico detalhado de versões dos anexos do web é preservado integralmente no cofre `.wfpbackup` v2.
- Desbloqueio com biometria forte ou credencial do aparelho, retomado após cinco minutos em segundo plano.
- Convites individuais por WhatsApp ou compartilhamento, com confirmação manual de envio.
- Gerador nativo de **PIX Copia e Cola (EMV® QRCPS-MPM + CRC16-CCITT)** e **QR Code ISO/IEC 18004** em `Canvas` para presentes e pagamentos (com valor exato embutido ou valor livre), além de compartilhamento e baixa manual; atalhos para discador, WhatsApp e mapas em fornecedores, contatos e locais. O endereço de locais pode ser editado no Android.
- Comparação de fornecedores por categoria, avaliação (1 a 5 estrelas), situação, orçamento previsto/real e pagamentos confirmados.
- Lembretes locais aproximados via WorkManager; verificação ao abrir, aviso semanal de backup quando há mudanças e exportação `.ics` de tarefas e pagamentos.
- Backup `.wfpbackup` v2 aceito pelo web e Android, com registros, anexos, artes, histórico, todos os uploads e estado web preservado; AES-256-GCM, PBKDF2-HMAC-SHA256 (600 mil iterações), senha escolhida na exportação e prévia validada antes da substituição.
- Cofre Android Keystore para SQLite/arquivos web exclusivos e cópia privada de reversão antes de cada substituição. A última reversão pode ser exportada pela tela de Backup.
- Ferramenta `android/tools/portable_v2.py` para cópia do SQLite web + `uploads/`; importação JSON v2/v3 e `.wfpbackup` v1 ficam como recuperação parcial. O relatório lista contagens, omissões e inconsistências.

## Qualidade, testes e limites conhecidos

Testes unitários e instrumentados verificam motores de domínio (`PixBrCode`, `QrCodeMatrix`, `PaymentAdjustment`, `RiskRadar`, `GuestDemographics`, `VenueChecklistTemplates`), Room, restauração nativa, fixture Python v2, arquivo corrompido e migração v1→v2. Uma cópia dos dados reais da Área de Trabalho passou pela importação no emulador Android e voltou a ser validada no web: 339 registros móveis, 10 arquivos, 31 tabelas web sem linhas alteradas e 10 hashes de uploads idênticos. Uma edição móvel de convidado sobreviveu ao ciclo web → Android → web → Android; um pacote criado em Android vazio também percorreu Android → web → Android com fornecedor, convidada e anexo.

O Room tem esquema v2 com migração explícita da v1, testada em emulador. Migrações futuras precisam de teste com esquema exportado; nunca usar `fallbackToDestructiveMigration`. A restauração substitui o banco em uma transação Room, incluindo BLOBs, e valida o pacote antes. O relatório CSV móvel exporta os campos essenciais de cada módulo e a alocação de mesas é feita por seletor de mesa (sem drag-and-drop gráfico).

## Migração segura

Pare alterações no web, preserve o banco original e `uploads/`, e execute a ferramenta descrita em [android/README.md](../android/README.md) (ou exporte `.wfpbackup` v2 direto em **Ajustes → Backup completo** no web). Confira o relatório/prévia e restaure o `.wfpbackup` no app Android. Compare contagens e anexos antes de desativar o servidor. Ao desligá-lo, os links públicos antigos de RSVP deixam de funcionar; no Android a resposta é registrada manualmente.

## Assinatura e distribuição

A chave de produção (`RSA 4096 bits`) fica fora do Git (`~/.android/wedding-planner-release.jks`), referenciada localmente por `android/keystore.properties` (ignorado pelo Git). Quando `keystore.properties` está presente, `./gradlew :app:assembleRelease` aplica R8/shrinking e assina automaticamente `app-release.apk`. A CI compila e valida `assembleRelease` sem a chave e publica o artefato de depuração; o APK assinado oficial (`wedding-finance-planner-v1.0.0.apk`) e seu arquivo `.sha256` são publicados em [GitHub Releases](https://github.com/guiloklex-hub/wedding-management-system/releases/latest). Mantenha o mesmo `applicationId` (`br.com.paivalab.weddingmanagementsystem`) e certificado para atualizar versões futuras sem perder o banco local.
