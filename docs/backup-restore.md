# 💾 Backup e Restauração

O Wedding Finance Planner usa SQLite — todos os dados ficam em um único
arquivo (`prisma/dev.db` por padrão). Isso facilita backup e migração.

## Backup automático via UI

Há um endpoint protegido:

```
GET /api/backup
Authorization: cookie de sessão (role com canViewSensitiveFinance — ADMIN/GROOM/BRIDE)
```

Retorna um **JSON** com `version: 2` e todas as coleções do banco —
estruturado por entidade. Útil para:

- backup periódico (você baixa e guarda em local seguro);
- portabilidade (levar o estado para outra instância);
- atender pedidos de **LGPD** (portabilidade de dados).

### Coleções exportadas (v2)

`eventSettings`, `securitySettings`, `vendors`, `vendorContacts`,
`vendorNotes`, `contracts`, `attachments`, `venues`, `venueChecklistItems`,
`budgetItems`, `payments`, `incomes`, `assets`, `savingsGoals`,
`honeymoon`, `honeymoonItems`, `trousseauItems`, `guestGroups`, `guests`,
`seatingTables`, `gifts`, `tasks` — 22 ao todo.

> 🔄 **v1 vs v2:** a versão `1` legada continha apenas 5 coleções
> (`eventSettings`, `vendors`, `budgetItems`, `payments`, `assets`) e
> deixava o restante do banco sem snapshot. A v2 cobre tudo. Importadores
> futuros devem inspecionar `payload.version` para distinguir.

Cada download grava entrada `BACKUP_EXPORT` em `AuditLog` com a contagem
de registros por coleção.

### Como baixar pelo navegador

1. Logue como admin.
2. Vá em **Ajustes › Backup**.
3. Clique em **Baixar JSON**.

O arquivo é nomeado `wedding-finance-backup-YYYY-MM-DD.json`.

## Backup direto do arquivo SQLite

Para um backup binário (mais fiel e mais barato):

```bash
# parar o servidor (ou usar VACUUM INTO em produção)
cp prisma/dev.db backups/dev-$(date +%F).db
```

Em **produção**, recomendo um cron diário:

```cron
0 3 * * * /usr/bin/cp /var/lib/wfv/prisma/dev.db /var/backups/wfv-$(date +\%F).db && find /var/backups -name "wfv-*.db" -mtime +30 -delete
```

Isso mantém 30 dias de retenção.

## Restauração

### A partir do JSON do `/api/backup`

> ⚠️ Esse fluxo ainda **não tem importador automático**. Se você precisar
> restaurar de um JSON, abra uma issue — provavelmente faremos um script
> `npm run db:import <arquivo.json>`.

Por enquanto, o JSON serve principalmente como **referência humana** e
**LGPD**.

### A partir de um SQLite cru

```bash
# parar o servidor antes!
cp /var/backups/wfv-2025-10-12.db prisma/dev.db
# reaplicar o schema (caso tenha mudado depois do backup):
npx prisma db push --skip-generate
npx prisma generate
# reiniciar o servidor
pm2 reload wfv-management-system
```

## Onde fica o banco?

| Ambiente | Caminho típico |
|---|---|
| Dev (Linux/macOS/WSL) | `./prisma/dev.db` |
| Dev (Windows nativo) | `.\prisma\dev.db` |
| Prod | recomenda-se setar `DATABASE_URL="file:/var/lib/wfv/dev.db"` |

Em produção, configure `DATABASE_URL` para um diretório persistente fora do
deploy (não dentro de `/var/www/wfv/...` se você costuma fazer
`git pull && npm run build`).

## Backup do `.whatsapp-auth/`

Quando o WhatsApp está conectado, a sessão Baileys vive em
`.whatsapp-auth/` (gitignored). Para evitar precisar escanear o QR Code
toda hora:

```bash
tar czf backups/whatsapp-auth-$(date +%F).tar.gz .whatsapp-auth/
```

Restaurar:

```bash
tar xzf backups/whatsapp-auth-2025-10-12.tar.gz
pm2 restart wfv-management-system
```

> ⚠️ Trate esse diretório como **secret** — quem tem o arquivo pode se passar
> pela sua conta WhatsApp.

## Backup do `.env`

Faça! Embora os secrets sejam gerados aleatoriamente, perder o
`NEXTAUTH_SECRET` invalida todas as sessões ativas. Guarde em local seguro
(gerenciador de senhas, vault, etc.).

## Plano sugerido

| Frequência | O quê | Destino | Retenção |
|---|---|---|---|
| Diário (3am) | `prisma/dev.db` | local + nuvem | 30 dias |
| Semanal | `.whatsapp-auth/` | nuvem (criptografado) | 4 semanas |
| Quando muda | `.env`, `prisma/schema.prisma` | gerenciador de senhas | sempre |
| Antes de update | `npm run build` (artefato) | local | até próximo deploy |

## Migração entre máquinas

```bash
# máquina antiga
tar czf migration.tar.gz prisma/dev.db .env .whatsapp-auth/

# máquina nova
git clone ...
cd wfv-management-system
tar xzf ../migration.tar.gz
./setup.sh --skip-seed
npm run dev   # ou: ./setup.sh --prod --skip-seed
```
