# Anexos & Contratos

A partir da v0.4.0, o módulo de anexos passou por endurecimento e ganhou
um fluxo dedicado para contratos com versionamento.

## Conceitos

- **Attachment** — qualquer arquivo anexado a um Vendor, Contract ou Venue.
- **Kind** — categoria do anexo: `CONTRACT`, `INVOICE`, `RECEIPT`,
  `PROPOSAL`, `ID_DOC`, `PHOTO`, `OTHER`.
- **Contract** — registro do acordo com o fornecedor (cláusulas, valor,
  versão). Pode ter zero ou mais Attachments do tipo `CONTRACT` (cada
  upload novo é uma versão).

## Storage

Arquivos vivem **fora de `public/`** em `<repo>/uploads/`. Estrutura:

```
uploads/{ownerType}/{ownerId}/{hash16}_{filename}          # padrão
uploads/contract/{contractId}/v{n}/{hash16}_{filename}     # versionado
```

`hash16` são os primeiros 16 caracteres de SHA-256 do conteúdo. O hash
completo é armazenado em `Attachment.sha256Full` para detecção de
integridade.

## Validação em camadas

Toda Server Action de upload (`uploadAttachment`, `replaceContractFile`)
passa por:

1. **Sessão** via `auth()`. Falha → 401.
2. **Rate limit** por usuário (10/min) e IP (30/min).
3. **Permissão por kind** via `canUploadAttachmentKind(role, kind)`.
4. **Validação Zod** de `ownerType`, `ownerId`, `kind`.
5. **Magic bytes** via `detectMagic(buffer)` em `src/lib/file-validation.ts`
   — PDF, PNG, JPEG, WEBP, HEIC.
6. **`assertMagicMatchesMime(detected, file.type)`** — bloqueia
   conteúdo que não bate com o MIME declarado pelo cliente.
7. **`assertAllowedForKind(kind, file.type)`** — restringe formatos por
   kind. `CONTRACT` só aceita `application/pdf`.
8. **Tamanho** por kind via `assertSizeForKind(kind, bytes)`. `CONTRACT`
   tem teto de 8 MB; demais kinds até 10 MB.
9. **Storage path** via `path.resolve` + `startsWith(UPLOADS_ROOT)` —
   path traversal robusto.
10. **`uploadedById`** preenchido com `session.user.id`.
11. **Audit** log entry com action `UPLOAD`.

## Matriz de permissões

| Ação | ADMIN | GROOM | BRIDE | PLANNER | FAMILY | VIEWER |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| Upload CONTRACT | ✓ | ✓ | ✓ | ✓ | – | – |
| Ver / baixar CONTRACT | ✓ | ✓ | ✓ | ✓ | – | – |
| Substituir CONTRACT (nova versão) | ✓ | ✓ | ✓ | ✓ | – | – |
| Excluir CONTRACT (soft) | ✓ | ✓ | ✓ | – | – | – |
| Marcar como SIGNED_* | ✓ | ✓ | ✓ | – | – | – |
| Upload PHOTO/PROPOSAL/OTHER | ✓ | ✓ | ✓ | ✓ | – | – |
| Ver PHOTO/PROPOSAL/OTHER | ✓ | ✓ | ✓ | ✓ | ✓ | – |

Implementado em `src/lib/permissions.ts`:
`canUploadContract`, `canViewContract`, `canManageContract`,
`canSignContract`, `canViewAttachmentKind`, `canUploadAttachmentKind`.

## Rota de download — `/api/files/[id]`

- Exige `auth()` e `canViewAttachmentKind(role, attachment.kind)`.
- Rate limit `20/min` por usuário+anexo, `120/min` por IP.
- Headers de segurança:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (impede embedding cross-origin do arquivo)
  - `Content-Security-Policy`:
    - **PDF** (`application/pdf`): `frame-ancestors 'self'`. O `sandbox`
      foi removido porque o visualizador interno do Chrome depende de
      executar scripts próprios para renderizar — o sandbox sem
      `allow-scripts` produzia tela cinza com "página bloqueada".
    - **Demais MIMEs** (imagem, outros inline): mantém
      `default-src 'none'; sandbox; style-src 'unsafe-inline'; frame-ancestors 'self'`
      como defesa em profundidade.
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: private, no-store` para contratos / `max-age=60` para os demais
- Registra `audit("Attachment", id, "DOWNLOAD")` a cada acesso.
- Anexos soft-deletados retornam 404 — exceto se quem requisita pode
  gerenciar contrato (ADMIN/GROOM/BRIDE), que enxerga o histórico.

## Versionamento de contratos

`Contract.version` é incrementado a cada `replaceContractFile`. Fluxo:

1. Carrega contrato + última versão.
2. Atomicamente (em `prisma.$transaction`):
   - `Attachment.updateMany` setando `deletedAt = now()` em CONTRACT
     atuais do contrato.
   - `Attachment.create` com `version: n+1`, `kind: CONTRACT`,
     `subdir: v{n+1}`.
   - `Contract.update` incrementando `version`.
3. Registra `audit("Contract", id, "REPLACE", { fromVersion, toVersion })`.

Arquivos da versão antiga **não são removidos do disco imediatamente** —
ficam soft-deletados por 30 dias.

## Cleanup

Endpoint cron `GET /api/cron/cleanup-files` (Bearer `CRON_SECRET`):

- Remove do FS e hard-delete da tabela qualquer Attachment com
  `deletedAt < now - 30d`.
- Lista FS recursivamente e remove arquivos órfãos (sem registro no DB).
- Idempotente (tolera ENOENT).

Configure no orquestrador externo (cron de sistema, GitHub Actions,
Cloudflare Cron Workers etc.) para rodar 1× ao dia.

## UI

`/dashboard/vendors/[id]` ganhou bloco "Arquivo do contrato" embutido em
cada contrato, com:

- `<object data="/api/files/{id}#toolbar=1&navpanes=0" type="application/pdf">`
  para preview do PDF. (Antes usávamos `<iframe sandbox="allow-same-origin">`,
  mas o sandbox sem `allow-scripts` bloqueava o visualizador interno do
  Chrome. Como o arquivo é servido same-origin com `X-Frame-Options:
  SAMEORIGIN`, não há regressão de superfície.)
- Botão "Baixar PDF" e info de upload (filename, tamanho, hash truncado,
  data, quem subiu).
- Form de substituir (gated por `canUploadContract`) com confirm dialog.
- Botões de assinatura digital/física (gated por `canSignContract`).
- Histórico de versões (gated por `canManageContract`) collapsible.
- Mensagem "Sem permissão" para FAMILY/VIEWER.

## Limitações conhecidas

- Não há scan de antivírus. PDFs são servidos same-origin com
  `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` (impede embedding
  externo) e o navegador roda o visualizador interno em seu próprio sandbox.
- Sem URL pré-assinada com expiração: a sessão Auth.js é o gate.
- Sem barra de progresso real no upload (limitação de Server Actions).
