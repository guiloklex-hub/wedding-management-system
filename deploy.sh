#!/bin/bash

# Interrompe o script se ocorrer algum erro
set -e

APP_NAME="wfv-management-system"

echo "======================================="
echo "🚀 Iniciando processo de Deploy do WFV"
echo "======================================="

# 1. Instalar dependências
echo "📦 1/4: Instalando dependências (npm install)..."
npm install

# 2. Atualizar Prisma e rodar migrações
echo "🗄️  2/4: Sincronizando Banco de Dados e gerando Prisma Client..."
npx prisma generate
npx prisma db push

# (Opcional) Popula o banco com os dados iniciais caso ainda não exista
npx prisma db seed || true

# 3. Build da aplicação Next.js
echo "🏗️  3/4: Realizando build do Next.js..."
npm run build

# 4. Iniciar ou reiniciar o PM2 com --update-env
echo "🔄 4/4: Reiniciando processo no PM2..."
# Verifica se o processo já existe no PM2
if pm2 list | grep -q "$APP_NAME"; then
  echo "Processo '$APP_NAME' encontrado. Reiniciando com --update-env..."
  pm2 reload "$APP_NAME" --update-env
else
  echo "Processo '$APP_NAME' não encontrado. Iniciando um novo processo..."
  pm2 start npm --name "$APP_NAME" -- start
fi

# Salva a configuração do PM2 para inicialização automática com o sistema
pm2 save

echo "======================================="
echo "✅ Deploy concluído com sucesso!"
echo "======================================="
