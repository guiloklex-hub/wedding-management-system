# 🐧 Instalação em Linux ou macOS

Guia detalhado para colocar o Wedding Finance Planner rodando em distribuições
Linux (Ubuntu, Debian, Fedora, Arch…) ou macOS. Também serve para quem usa
**WSL2** com Ubuntu — veja [instalacao-wsl.md](instalacao-wsl.md) se ainda não
tem o WSL2 instalado.

> ⏱️ Tempo total: 5 a 10 minutos.

---

## 1. Pré-requisitos

Você precisa de:

| Ferramenta | Versão mínima | Como instalar |
|---|---|---|
| **Node.js** | 20.0.0 | `nvm install 20` (recomendado) ou via gerenciador de pacotes |
| **npm** | 10 (vem com o Node) | — |
| **Git** | qualquer | `sudo apt install git` / `brew install git` |

### Instalando o Node 20 com nvm (recomendado)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# feche e reabra o terminal
nvm install 20
nvm use 20
node -v   # esperado: v20.x.x
```

### Alternativas

- **Ubuntu/Debian:** `sudo apt install nodejs npm` (verifique versão — pode estar
  desatualizada; prefira o nvm).
- **macOS:** `brew install node@20`.
- **Fedora:** `sudo dnf install nodejs`.

---

## 2. Clone o projeto

```bash
git clone https://github.com/guiloklex-hub/wfv-management-system.git
cd wfv-management-system
```

> ⚠️ Substitua `guiloklex-hub` pela conta dona do repositório no GitHub.

---

## 3. Rode o setup automatizado

```bash
chmod +x setup.sh
./setup.sh
```

O script faz tudo de uma vez:

1. ✅ verifica o Node 20+
2. ✅ cria um `.env` com `NEXTAUTH_SECRET` e `CRON_SECRET` aleatórios
3. ✅ roda `npm install`
4. ✅ aplica o schema do banco (`prisma db push`)
5. ✅ gera o Prisma Client
6. ✅ roda o seed (cria o usuário `admin@admin.com`)

### Opções do script

| Comando | Função |
|---|---|
| `./setup.sh` | Setup completo para desenvolvimento |
| `./setup.sh --prod` | Setup de produção + build + PM2 (se instalado) |
| `./setup.sh --reset-db` | Apaga o banco SQLite local antes de iniciar |
| `./setup.sh --skip-deps` | Não roda `npm install` (atualização rápida) |
| `./setup.sh --skip-seed` | Não roda o seed |

---

## 4. Inicie o servidor

```bash
npm run dev
```

Abra <http://localhost:3005>.

---

## 5. Primeiro acesso

1. Faça login com **admin@admin.com** / **admin**.
2. Você será redirecionado(a) para **Definir nova senha**.
3. Em seguida, o **Assistente de Configuração** abre — preencha:
   - nomes do casal,
   - data do casamento,
   - moeda (BRL/USD/EUR),
   - % de contingência (recomendado: 10%).
4. Pronto! Você cai no Dashboard.

---

## 6. (Opcional) Configurar Email/WhatsApp

Acesse **Ajustes**:

- **Casamento** → configurar SMTP (Gmail App Password recomendado).
- **WhatsApp** → conectar via QR Code.

Detalhes em [notificacoes.md](notificacoes.md).

---

## 7. (Opcional) Cron de lembretes

Para que lembretes automáticos sejam enviados, adicione ao seu crontab
(`crontab -e`):

```cron
*/30 * * * * curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" \
  http://localhost:3005/api/cron/reminders >> /var/log/wfv-cron.log 2>&1
```

Substitua `SEU_CRON_SECRET` pelo valor de `CRON_SECRET` no `.env`.

---

## 8. Atualizar o projeto

```bash
git pull
./setup.sh --skip-seed
# em produção: ./setup.sh --prod --skip-seed
```

---

## Problemas?

Vá direto para [troubleshooting.md](troubleshooting.md).
