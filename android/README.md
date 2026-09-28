# Wedding Finance Planner para Android

Projeto Gradle independente do web. Requer Android Studio com SDK 36 e Java 21 ou superior. O aplicativo roda a partir do APK sem servidor, Node.js ou npm.

```bash
cd android
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

Instale `app/build/outputs/apk/debug/app-debug.apk` em um aparelho Android 11+ de teste. O pacote permanente é `br.com.paivalab.weddingmanagementsystem`. O APK debug tem assinatura de desenvolvimento e **não** é adequado como versão de produção.

## Transferir dados do web

A ferramenta precisa de Python 3.11+ e `cryptography` no computador. Use uma cópia do banco ou deixe a ferramenta criar sua cópia consistente; mantenha a pasta `uploads/` correspondente, sem alterações durante a leitura.

```bash
python -m pip install cryptography==50.0.1
python android/tools/portable_v2.py \
  --sqlite /caminho/para/dev.db \
  --uploads /caminho/para/uploads \
  --output /caminho/para/migracao.wfpbackup \
  --report /caminho/para/relatorio.json
```

O conversor pede uma senha de pelo menos 12 caracteres sem exibi-la. Ele interrompe a geração se houver relação inválida ou arquivo ausente/hash divergente. O v2 inclui o SQLite web bruto, todas as 31 tabelas encontradas na cópia de teste e todos os arquivos de `uploads/`, inclusive órfãos e artes. O relatório lista contagens, arquivos e problemas. Para recuperar apenas dados de um JSON web v2/v3, use a ferramenta legada `migrate_web.py --json`; esse caminho gera v1 **parcial** e não traz os arquivos nem várias tabelas atuais.

No APK, vá a **Ajustes → Backup → Restaurar backup**, selecione o arquivo e forneça a senha. Confira a prévia e confirme a substituição com biometria/PIN. Faça isso primeiro em um aparelho ou perfil de teste, confira registros e anexos, e só depois planeje abandonar o web. Os links públicos antigos de RSVP param ao desligar o servidor.

## Backup e reversão no Android

Em **Ajustes → Backup**, escolha senha nova, confirme e selecione o destino com o seletor de documentos. O `.wfpbackup` v2 contém registros, configurações, histórico, anexos e artes; após importar uma origem web, também conserva seu SQLite e todos os uploads no cofre privado cifrado pelo Android Keystore. A senha do arquivo não é guardada; sem ela o arquivo não pode ser restaurado em outro aparelho. O cabeçalho `WFPBAK01` é autenticado como AAD; o pacote usa PBKDF2-HMAC-SHA256 (600 mil iterações) e AES-256-GCM. O Android Auto Backup está desativado.

Antes de substituir dados, o app guarda uma cópia de reversão cifrada pelo Keystore. A tela permite exportar a última reversão com nova senha. O Room migrou explicitamente da versão 1 para a 2 para guardar metadados portáteis. Veja [backup e restauração](../docs/backup-restore.md) para o formato e os limites.

## Desenvolvimento e entrega

O esquema Room versionado está em `app/schemas/`. Toda alteração futura exige migração explícita e teste de atualização; nunca usar migração destrutiva. Rode também:

```bash
python -m unittest discover -s android/tools -p 'test_*.py'
./gradlew :app:connectedDebugAndroidTest
```

Para produção, gere uma chave de assinatura fora do repositório, configure uma assinatura **local** de release no Android Studio e conserve esse certificado. Publique manualmente o APK assinado em GitHub Releases com versão, SHA-256 e notas. A CI compila e testa, mas não possui a chave. O checklist de lacunas e validação em aparelho está em [docs/android.md](../docs/android.md).
