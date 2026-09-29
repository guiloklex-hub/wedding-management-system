# Wedding Finance Planner para Android (`v1.1.0`)

A versão `v1.1.0` reúne detalhes de fornecedor e local, relatórios locais, compartilhamento de convites com anexo, conferência completa de contratos/PDFs na restauração e uma nova tela ilustrada de desbloqueio. Os principais fluxos foram validados no Samsung SM-S908E; veja a [auditoria web × Android](../docs/android-paridade.md) para as diferenças restantes.

Aplicativo nativo em Kotlin, Jetpack Compose (Material 3) e Room/SQLite independente do servidor web. Requer Android 11+ (`minSdk 30`, `targetSdk 36`) para uso e Android Studio com SDK 36 + Java 21 para compilação.

- **Download do APK assinado (`v1.1.0`):** [`wedding-finance-planner-v1.1.0.apk`](https://github.com/guiloklex-hub/wedding-management-system/releases/download/v1.1.0/wedding-finance-planner-v1.1.0.apk) (`SHA-256: 00b70745c825a29a1d7ffdda93f086390eae56773d8df61d8e35125d718b818e`)
- **Pacote (`applicationId`):** `br.com.paivalab.weddingmanagementsystem`
- **Certificado SHA-256:** `ef0404a400b46675cfc9fcf62421273ddbad7e22e16a15e57eb617b89db65633`

A tela de desbloqueio usa a arte exclusiva em `app/src/main/res/drawable-nodpi/unlock_background.webp`, gerada para esta versão. O cartão de ação é opaco e mantém o texto legível sobre a imagem. A autenticação continua pela biometria forte ou credencial do aparelho; atualizar com o mesmo certificado preserva o banco local.

```bash
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

Para compilar o APK assinado de produção (`app/build/outputs/apk/release/app-release.apk`), configure `android/keystore.properties` apontando para o keystore fora do Git (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) e rode:

```bash
cd android
./gradlew :app:assembleRelease
```

## Transferir dados do web

Você pode exportar o arquivo `.wfpbackup` v2 diretamente pela interface web em **Ajustes → Backup completo**, ou converter uma cópia do banco SQLite + `uploads/` no computador com Python 3.11+ e `cryptography`:

```bash
python -m pip install cryptography==50.0.1
python android/tools/portable_v2.py \
  --sqlite /caminho/para/dev.db \
  --uploads /caminho/para/uploads \
  --output /caminho/para/migracao.wfpbackup \
  --report /caminho/para/relatorio.json
```

O conversor pede uma senha de pelo menos 12 caracteres sem exibi-la. Ele interrompe a geração se houver relação inválida ou arquivo ausente/hash divergente. O v2 inclui o SQLite web bruto, todas as 31 tabelas encontradas na cópia de teste e todos os arquivos de `uploads/`, inclusive órfãos e artes. O relatório lista contagens, arquivos e problemas. Para recuperar apenas dados de um JSON web v2/v3, use a ferramenta legada `migrate_web.py --json`; esse caminho gera v1 **parcial** e não traz todas as tabelas atuais. Sem a pasta de uploads, ele recusa por padrão backups JSON que contêm anexos. `--allow-missing-files` permite explicitamente uma recuperação parcial.

No APK, vá a **Ajustes → Backup → Restaurar backup**, selecione o arquivo e forneça a senha. Confira na prévia os totais de contratos e PDFs de contrato, inclusive versões arquivadas, antes de confirmar a substituição com biometria/PIN. Um v2 com contrato ou anexo ausente na representação móvel é recusado antes de alterar o banco. Os links públicos antigos de RSVP param ao desligar o servidor web.

## Backup e reversão no Android

Em **Ajustes → Backup**, escolha senha nova, confirme e selecione o destino com o seletor de documentos. O `.wfpbackup` v2 contém registros, configurações, histórico, anexos e artes; após importar uma origem web, também conserva seu SQLite e todos os uploads no cofre privado cifrado pelo Android Keystore. A senha do arquivo não é guardada; sem ela o arquivo não pode ser restaurado em outro aparelho. O cabeçalho `WFPBAK01` é autenticado como AAD; o pacote usa PBKDF2-HMAC-SHA256 (600 mil iterações) e AES-256-GCM. O Android Auto Backup está desativado.

Antes de substituir dados, o app guarda uma cópia de reversão cifrada pelo Keystore. A tela permite exportar a última reversão com nova senha. O Room tem migrações explícitas v1→v2→v3; a v3 guarda o número da versão de cada PDF. Veja [backup e restauração](../docs/backup-restore.md) para o formato e os limites.

## Desenvolvimento e entrega

O esquema Room versionado está em `app/schemas/`. Toda alteração futura exige migração explícita e teste de atualização; nunca usar migração destrutiva. Rode também:

```bash
python -m unittest discover -s android/tools -p 'test_*.py'
./gradlew :app:connectedDebugAndroidTest
```

O APK assinado de produção é publicado em [GitHub Releases](https://github.com/guiloklex-hub/wedding-management-system/releases/latest) acompanhado de seu checksum `.sha256`. Veja os detalhes completos de recursos em [docs/android.md](../docs/android.md).
