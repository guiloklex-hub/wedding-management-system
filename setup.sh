#!/usr/bin/env bash
# Wedding Finance — script único de instalação e atualização.
#
# Uso:
#   ./setup.sh                Instala ou atualiza para desenvolvimento (sem build).
#   ./setup.sh --prod         Instala ou atualiza e roda build de produção + PM2.
#   ./setup.sh --reset-db     Reseta o banco SQLite local (DROP tudo). Cuidado.
#   ./setup.sh --skip-deps    Pula `npm install` (útil para atualizações rápidas).
#   ./setup.sh --skip-seed    Pula `prisma db seed`.

set -euo pipefail

APP_NAME="wfv-management-system"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PROD_MODE=false
RESET_DB=false
SKIP_DEPS=false
SKIP_SEED=false

for arg in "$@"; do
  case "$arg" in
    --prod) PROD_MODE=true ;;
    --reset-db) RESET_DB=true ;;
    --skip-deps) SKIP_DEPS=true ;;
    --skip-seed) SKIP_SEED=true ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      echo "Use --help para ver as opções." >&2
      exit 1
      ;;
  esac
done

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
info() { printf "\033[36m→\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }
fail() { printf "\033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

bold "Wedding Finance — setup"
echo "Diretório: $ROOT_DIR"
$PROD_MODE && echo "Modo: produção (build + PM2)" || echo "Modo: desenvolvimento"
echo

# 1. Pré-requisitos
info "Verificando pré-requisitos..."
command -v node >/dev/null 2>&1 || fail "Node.js não encontrado. Instale Node 20+."
command -v npm  >/dev/null 2>&1 || fail "npm não encontrado."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $NODE_MAJOR detectado. Este projeto requer Node 20 ou superior."
fi
ok "Node $(node -v)  ·  npm $(npm -v)"

# 2. Arquivo .env (cria se não existir, mantém o existente)
if [ ! -f .env ]; then
  info "Criando .env inicial..."
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')"
  cat > .env <<EOF
# Wedding Finance — variáveis locais (não commitar)
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="$SECRET"
NEXTAUTH_URL="http://localhost:3005"
ADMIN_PASSWORD="admin"
EOF
  ok ".env criado com NEXTAUTH_SECRET gerado aleatoriamente."
  warn "Lembre de definir NEXTAUTH_URL real em produção."
else
  ok ".env já existe — mantido."
fi

# 3. Reset opcional do banco
if $RESET_DB; then
  if [ -f prisma/dev.db ] || [ -f dev.db ]; then
    warn "Removendo banco local (dev.db)..."
    rm -f prisma/dev.db prisma/dev.db-journal dev.db dev.db-journal 2>/dev/null || true
    ok "Banco apagado."
  fi
fi

# 4. Dependências
if $SKIP_DEPS; then
  info "Pulando npm install (--skip-deps)."
else
  info "Instalando dependências (npm install)..."
  npm install
  ok "Dependências instaladas."
fi

# 5. Prisma — gera client e aplica schema sem dropar dados
info "Sincronizando banco (prisma db push)..."
npx prisma db push --skip-generate
ok "Schema aplicado."

info "Gerando Prisma Client..."
npx prisma generate
ok "Prisma Client gerado."

# 6. Seed (idempotente)
if $SKIP_SEED; then
  info "Pulando seed (--skip-seed)."
else
  info "Rodando seed (idempotente)..."
  if npx prisma db seed; then
    ok "Seed concluído."
  else
    warn "Seed falhou (provavelmente já existe). Seguindo."
  fi
fi

# 7. Modo produção: build + PM2
if $PROD_MODE; then
  info "Build de produção (next build)..."
  npm run build
  ok "Build pronto."

  if command -v pm2 >/dev/null 2>&1; then
    if pm2 list | grep -q "$APP_NAME"; then
      info "PM2: reiniciando $APP_NAME..."
      pm2 reload "$APP_NAME" --update-env
    else
      info "PM2: iniciando $APP_NAME..."
      pm2 start npm --name "$APP_NAME" -- start
    fi
    pm2 save
    ok "PM2 atualizado."
  else
    warn "PM2 não instalado — pulei restart automático."
    warn "Para iniciar manualmente: npm run start"
  fi
fi

echo
bold "Tudo pronto."
if ! $PROD_MODE; then
  echo "Comece com:  npm run dev"
  echo "Acesse:      http://localhost:3005"
  echo "Login:       admin@admin.com  /  admin"
else
  echo "Aplicação rodando em produção via PM2."
  echo "Status:      pm2 status $APP_NAME"
  echo "Logs:        pm2 logs $APP_NAME"
fi
