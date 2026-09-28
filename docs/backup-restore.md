# Backup completo e transferência web ↔ Android

O formato principal é `.wfpbackup` **v2**. Um arquivo contém o SQLite web inteiro, quando existe uma origem web, todos os arquivos de `uploads/` (inclusive órfãos e artes), a representação móvel, anexos, preferências transferíveis e histórico. O pacote é cifrado integralmente com AES-256-GCM; a chave vem de PBKDF2-HMAC-SHA256 com 600 mil iterações, salt aleatório e senha escolhida a cada exportação. A senha não fica salva e não pode ser recuperada. O cabeçalho é autenticado como AAD.

O backup exclui `.env`, `.whatsapp-auth` e segredos de serviços externos. As contas, hashes de senha e 2FA **web** estão no SQLite cifrado. O desbloqueio biométrico é configurado novamente no aparelho. Links públicos de RSVP dependem do endereço e da disponibilidade do servidor web.

## Pela interface

Em **Ajustes → Backup → Backup completo**:

1. Entre como administrador. Para exportar, informe a senha da conta web e crie uma senha de arquivo de pelo menos 12 caracteres. Salve o `.wfpbackup` fora do computador que contém a instalação.
2. Para importar, selecione o arquivo, informe a senha do arquivo e abra a prévia. Ela mostra áreas, tabelas, arquivos, espaço estimado, mudanças e bloqueios. Senha incorreta, alteração cifrada, hash ou relação inválida impedem a troca.
3. Confirme a substituição e informe a senha da conta web. O destino é substituído; não há mesclagem de duas instalações ativas. Após uma transferência, use uma instalação de cada vez.

O Android usa o seletor de documentos e exige biometria forte ou credencial do aparelho antes de exportar ou restaurar. A versão móvel mantém o SQLite web e os arquivos exclusivos em um cofre privado cifrado pelo Android Keystore. Sua próxima exportação inclui esse estado e as edições móveis. No web, o estado móvel exclusivo fica em `PortableState` e `.portable-state/` e volta ao próximo pacote.

Na primeira transferência **Android → web** sem SQLite web anterior, a restauração mantém as contas administrativas da instalação web de destino e substitui os dados do casamento. A prévia bloqueia registros sem campos web obrigatórios, identificando o registro e o campo a corrigir; fornecedores exigem categoria, por exemplo. Os campos que só existem no Android continuam no estado portátil.

### Reversão

- Web: cada v2 restaurado guarda SQLite, `uploads/` e estado portátil anteriores em `.portable-reversions/<geração>/`. Um diário `.portable-restore-journal.json` permite recuperar a cópia anterior após interrupção. Rotas Prisma e gravações de uploads são bloqueadas durante a troca. Mantenha a pasta de reversões protegida e fora do controle de versão.
- Android: antes de substituir o Room, o app grava uma cópia v2 privada cifrada pelo Keystore em `files/portable-reversions/`. A tela de Backup permite exportar a última reversão com uma nova senha. A transação Room mantém o banco anterior se a escrita falhar; o cofre web anterior só é removido após confirmação.

Há necessidade de espaço livre para pacote, preparação e reversão. Se o armazenamento não for suficiente, a restauração é bloqueada antes da troca. No navegador, a exportação usa gravação em fluxo quando o seletor de arquivos está disponível; o caminho alternativo monta um `Blob` em memória. O modelo atual de anexos do Room usa BLOBs e cada arquivo precisa caber no limite de um BLOB/array Android; testes com volumes muito grandes ainda são necessários.

## Ferramenta para a cópia da Área de Trabalho

Faça a conversão a partir de **cópias** do SQLite e de `uploads/`. O banco localizado em `~/Área de trabalho/temp/prisma/dev.db` e sua pasta `uploads/` foram usados nos testes desta implementação. A ferramenta faz snapshot consistente do SQLite e compara hashes dos arquivos:

```bash
python -m pip install 'cryptography==50.0.1'
python android/tools/portable_v2.py \
  --sqlite "$HOME/Área de trabalho/temp/prisma/dev.db" \
  --uploads "$HOME/Área de trabalho/temp/uploads" \
  --output "$HOME/Área de trabalho/temp/wedding-full.wfpbackup" \
  --report "$HOME/Área de trabalho/temp/wedding-full-report.json"
```

Ela pede e confirma uma nova senha sem exibi-la. O relatório traz as 31 tabelas, arquivos e relações; ausência ou divergência bloqueia a geração. A saída deve ser testada em uma instalação separada antes de trocar o aparelho principal. **Não desligue o web nem apague a origem antes da conferência.**

## Contrato v2

O fluxo binário começa com `WFPBAK01`, iterações (big endian), salt de 16 bytes, nonce GCM de 12 bytes, ZIP cifrado e tag GCM de 16 bytes. O ZIP contém `manifest.json`, `records.json`, `baseline.json`, `files.json`, `settings.json`, `audit.json`, `blobs/<id>`, e, se houver origem web, `web.sqlite` e `uploads/<caminho>`. O manifesto inclui origem, linhagem, geração, versões, contagens e SHA-256 por arquivo. Caminhos absolutos, `..`, barras invertidas e entradas inesperadas são rejeitados.

Campos equivalentes são aplicados ao SQLite de origem usando `baseline.json` como referência. O conversor só modifica colunas móveis alteradas; campos web não editados no Android ficam como estavam. Novos registros são verificados contra colunas obrigatórias e chaves estrangeiras antes de substituir o destino. Os arquivos de uploads sem vínculo permanecem no pacote. O web não remove automaticamente anexos antigos nem artes para não tornar um backup posterior incompleto.

| Rota web | Função |
|---|---|
| `POST /api/backup` | Exporta v2 após senha da conta e nova senha do arquivo; resposta em fluxo. |
| `POST /api/backup/portable/validate` | Lê `file` e `backupPassword`; devolve prévia e bloqueios. |
| `POST /api/backup/portable/restore` | Lê `file`, `backupPassword`, `accountPassword` e `confirm=REPLACE_ALL`; prepara, guarda reversão e substitui. |

Todos os três exigem sessão administradora. O arquivo deve ser mantido em local privado: perder a senha impede a restauração e divulgá-la expõe os dados pessoais e credenciais web contidos no backup.

## Formatos antigos são parciais

O JSON web v2/v3 continua disponível na seção legada de Ajustes e nos endpoints `/api/backup` GET, `/api/backup/validate` e `/api/backup/restore`. Ele não carrega bytes de `uploads/`, artes órfãs nem todas as tabelas atuais. O v3 tem checksum SHA-256; o v2 não. O `.wfpbackup` v1 do Android contém apenas seus registros e BLOBs; o Android o aceita somente em instalação vazia. **Nenhum dos dois é uma transferência completa.** Use a ferramenta a partir de SQLite + `uploads/` para recuperar tudo o que ainda estiver na origem.

O JSON legado pode alterar contas e dados visíveis, mas não recompõe os arquivos ausentes. O restaurador JSON também guarda uma cópia local prévia em `.portable-reversions/`; antes de usá-lo, faça ainda um backup completo v2 que possa ser levado a outro aparelho. A cópia original do SQLite e de `uploads/` deve ser mantida até todos os testes de restauração passarem.

## Testes e operação

O projeto testa Python ↔ web e Python ↔ Android com uma fixture sintética, migração Room v1→v2, senha incorreta e arquivo alterado. Em uma cópia dos dados da Área de Trabalho, a ida e volta sem edição passou pelo emulador Android e preservou todas as linhas das 31 tabelas originais e o hash dos 10 arquivos; a importação contou 339 registros móveis e 10 arquivos. Uma edição de convidado feita dentro do emulador chegou ao web e permaneceu após nova exportação web e importação Android. Um ensaio iniciado em Android vazio levou fornecedor, convidada e anexo ao web, preservou as quatro contas do destino e voltou ao Android. Outros testes de mudança em cópias isoladas verificaram convidado criado/excluído logicamente e anexo alterado. Ainda é necessário ensaiar corte de energia/interrupção em dispositivos reais, volumes grandes e atualização de APK assinado antes da adoção como única cópia.
