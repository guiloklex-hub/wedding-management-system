# 🚀 Deploy em Produção

Guia para colocar o Wedding Finance Planner online de forma estável.

## Cenário recomendado

- VPS ou máquina dedicada com Linux (Ubuntu 22.04+).
- Domínio próprio (ex.: `casamento.seunome.com`).
- Proxy reverso (Cloudflare Tunnel **ou** nginx + Let's Encrypt).
- PM2 para manter o processo Node vivo.
- Cron diário para backup.
- Cron a cada 30 min para `/api/cron/reminders`.

## 1. Preparar o servidor

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Node 20 via nvm (na conta de usuário não-root)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# PM2 global
npm install -g pm2
```

## 2. Clonar e instalar

```bash
cd /var/www
sudo git clone https://github.com/guiloklex-hub/wfv-management-system.git wfv
sudo chown -R $USER:$USER wfv
cd wfv
```

## 3. Configurar `.env` para produção

```bash
./setup.sh   # cria o .env padrão
nano .env
```

Edite:

```env
DATABASE_URL="file:/var/lib/wfv/dev.db"   # fora do diretório do código
NEXTAUTH_URL="https://casamento.seudominio.com"
APP_URL="https://casamento.seudominio.com"
AUTH_TRUST_HOST="true"
ADMIN_PASSWORD="SENHA_FORTE_AQUI"          # trocada no 1º login
CRON_SECRET="<gerado pelo setup>"
# SMTP_* opcional (ou via UI)
```

Garanta o diretório persistente:

```bash
sudo mkdir -p /var/lib/wfv
sudo chown $USER:$USER /var/lib/wfv
```

## 4. Build + PM2

```bash
./setup.sh --prod --skip-seed   # ou --reset-db se quiser zerar
```

Esse comando:
1. roda `npm install` (caso não tenha rodado);
2. aplica o schema (`prisma db push`);
3. faz `npm run build`;
4. inicia/reinicia via PM2 com nome `wfv-management-system`.

Para fazer o PM2 subir junto com o boot do sistema:

```bash
pm2 startup           # gera o comando systemd
# rode o sudo gerado
pm2 save              # salva o estado atual
```

## 5. Proxy reverso

### Opção A — Cloudflare Tunnel (mais simples, free)

1. Crie um túnel em <https://one.dash.cloudflare.com> → Networks → Tunnels.
2. Adicione `cloudflared` no servidor:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   sudo cloudflared service install <TOKEN_DO_TÚNEL>
   ```
3. No painel Cloudflare, mapeie `casamento.seudominio.com → http://localhost:3005`.

Vantagens:
- HTTPS automático.
- Sem precisar abrir portas (firewall fechado).
- DDoS mitigation incluso.

### Opção B — nginx + Let's Encrypt

```nginx
server {
    listen 443 ssl http2;
    server_name casamento.seudominio.com;

    ssl_certificate     /etc/letsencrypt/live/casamento.seudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/casamento.seudominio.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 25m;   # uploads
}

server {
    listen 80;
    server_name casamento.seudominio.com;
    return 301 https://$host$request_uri;
}
```

Gerar certificado:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d casamento.seudominio.com
```

## 6. Cron de lembretes

```bash
crontab -e
```

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3005/api/cron/reminders >> /var/log/wfv-cron.log 2>&1
```

## 7. Cron de backup

```bash
sudo mkdir -p /var/backups/wfv
sudo chown $USER:$USER /var/backups/wfv
crontab -e
```

```cron
0 3 * * * /usr/bin/cp /var/lib/wfv/dev.db /var/backups/wfv/wfv-$(date +\%F).db && find /var/backups/wfv -name "wfv-*.db" -mtime +30 -delete
```

## 8. Conectar WhatsApp

Acesse <https://casamento.seudominio.com/dashboard/settings>, aba **WhatsApp**,
escaneie o QR Code. A sessão fica em `.whatsapp-auth/` dentro do diretório
do projeto.

> ⚠️ Esse diretório precisa ser persistido entre deploys. Se você costuma
> `rm -rf` o projeto antes de fazer `git pull`, mova-o para fora antes.

## 9. Atualização (deploy de nova versão)

```bash
cd /var/www/wfv
git pull
./setup.sh --prod --skip-seed
pm2 reload wfv-management-system
```

PM2 reinicia o processo Node com graceful reload — zero downtime na maioria
dos casos.

## 10. Monitoramento

```bash
pm2 status                          # estado geral
pm2 logs wfv-management-system      # logs em tempo real
pm2 monit                           # dashboard interativo no terminal
```

Para um stack mais robusto, considere:

- **Sentry** ou **PostHog** para captura de erros frontend.
- **Loki + Grafana** para logs.
- **Uptime Robot** (free tier) batendo no `/api/cron/reminders` apenas para
  verificar liveness (e ele também cuida dos lembretes).

## Headers de segurança (opcional)

Em [next.config.ts](../next.config.ts) você pode adicionar:

```typescript
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ];
}
```

(Se você usar Cloudflare ou nginx, configure também lá — defesa em
profundidade.)

## Recuperação de desastre

Veja [backup-restore.md](backup-restore.md).
