<#
.SYNOPSIS
    Wedding Finance — script único de instalação e atualização para Windows.

.DESCRIPTION
    Equivalente ao setup.sh, mas em PowerShell nativo. Funciona no Windows 10/11
    com PowerShell 5.1+ ou PowerShell 7+. Não requer WSL.

.PARAMETER Prod
    Roda build de produção e inicia/atualiza via PM2 (precisa do PM2 instalado).

.PARAMETER ResetDb
    Apaga o banco SQLite local (prisma/dev.db). Cuidado: perde os dados locais.

.PARAMETER SkipDeps
    Pula o `npm install` (útil em atualizações rápidas).

.PARAMETER SkipSeed
    Pula o `prisma db seed`.

.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -Prod
    .\setup.ps1 -ResetDb
#>

[CmdletBinding()]
param(
    [switch]$Prod,
    [switch]$ResetDb,
    [switch]$SkipDeps,
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$AppName = "wedding-management-system"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

function Write-Bold([string]$Text) { Write-Host $Text -ForegroundColor White }
function Write-Ok([string]$Text)   { Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "[..] $Text" -ForegroundColor Cyan }
function Write-Warn([string]$Text) { Write-Host "[!!] $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) {
    Write-Host "[X]  $Text" -ForegroundColor Red
    exit 1
}

Write-Bold "Wedding Finance — setup (Windows)"
Write-Host "Diretório: $RootDir"
if ($Prod) { Write-Host "Modo: produção (build + PM2)" } else { Write-Host "Modo: desenvolvimento" }
Write-Host ""

# 1. Pré-requisitos
Write-Info "Verificando pré-requisitos..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Fail "Node.js não encontrado. Instale Node 20+ em https://nodejs.org/" }
$npm  = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm)  { Write-Fail "npm não encontrado." }

$nodeVersion = (node --version).TrimStart("v")
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 20) {
    Write-Fail "Node.js $nodeMajor detectado. Este projeto requer Node 20 ou superior."
}
Write-Ok "Node v$nodeVersion  ·  npm $((npm --version))"

# 2. Arquivo .env
if (-not (Test-Path ".env")) {
    Write-Info "Criando .env inicial..."

    $secretBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($secretBytes)
    $secret = [Convert]::ToBase64String($secretBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")

    $cronBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($cronBytes)
    $cron = -join ($cronBytes | ForEach-Object { $_.ToString("x2") })

    $envContent = @"
# Wedding Finance — variáveis locais (não commitar)
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="$secret"
NEXTAUTH_URL="http://localhost:3005"
APP_URL="http://localhost:3005"
ADMIN_PASSWORD="admin"
CRON_SECRET="$cron"
"@

    Set-Content -Path ".env" -Value $envContent -Encoding UTF8
    Write-Ok ".env criado com NEXTAUTH_SECRET e CRON_SECRET gerados aleatoriamente."
    Write-Warn "Lembre de definir NEXTAUTH_URL e APP_URL reais em produção."
} else {
    Write-Ok ".env já existe — mantido."
}

# 3. Reset opcional do banco
if ($ResetDb) {
    foreach ($f in @("prisma\dev.db", "prisma\dev.db-journal", "dev.db", "dev.db-journal")) {
        if (Test-Path $f) {
            Write-Warn "Removendo $f..."
            Remove-Item $f -Force
        }
    }
    Write-Ok "Banco apagado."
}

# 4. Dependências
if ($SkipDeps) {
    Write-Info "Pulando npm install (-SkipDeps)."
} else {
    Write-Info "Instalando dependências (npm install)..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install falhou." }
    Write-Ok "Dependências instaladas."
}

# 5. Prisma — sync schema (sem dropar dados)
Write-Info "Sincronizando banco (prisma db push)..."
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { Write-Fail "prisma db push falhou." }
Write-Ok "Schema aplicado."

Write-Info "Gerando Prisma Client..."
npx prisma generate
if ($LASTEXITCODE -ne 0) { Write-Fail "prisma generate falhou." }
Write-Ok "Prisma Client gerado."

# 6. Seed (idempotente)
if ($SkipSeed) {
    Write-Info "Pulando seed (-SkipSeed)."
} else {
    Write-Info "Rodando seed (idempotente)..."
    try {
        npx prisma db seed
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Seed concluído."
        } else {
            Write-Warn "Seed retornou erro (provavelmente já existe). Seguindo."
        }
    } catch {
        Write-Warn "Seed falhou. Seguindo."
    }
}

# 7. Modo produção: build + PM2
if ($Prod) {
    Write-Info "Build de produção (next build)..."
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "Build falhou." }
    Write-Ok "Build pronto."

    $pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
    if ($pm2) {
        $pm2List = pm2 list 2>$null
        if ($pm2List -match $AppName) {
            Write-Info "PM2: reiniciando $AppName..."
            pm2 reload $AppName --update-env
        } else {
            Write-Info "PM2: iniciando $AppName..."
            pm2 start npm --name $AppName -- start
        }
        pm2 save
        Write-Ok "PM2 atualizado."
    } else {
        Write-Warn "PM2 não instalado — pulei restart automático."
        Write-Warn "Para instalar:  npm install -g pm2"
        Write-Warn "Para iniciar manualmente:  npm run start"
        Write-Warn "Alternativa Windows: rodar como serviço via NSSM (https://nssm.cc/)."
    }
}

Write-Host ""
Write-Bold "Tudo pronto."
if (-not $Prod) {
    Write-Host "Comece com:  npm run dev"
    Write-Host "Acesse:      http://localhost:3005"
    Write-Host "Login:       admin@admin.com  /  admin"
    Write-Host ""
    Write-Host "[i] No primeiro login você será orientado(a) a:" -ForegroundColor Cyan
    Write-Host "    1) Trocar a senha provisória."
    Write-Host "    2) Configurar o casamento (nomes do casal, data, contingência)."
    Write-Host ""
    Write-Host "Para configurar SMTP/WhatsApp depois, vá em Ajustes."
} else {
    Write-Host "Aplicação rodando em produção via PM2."
    Write-Host "Status:      pm2 status $AppName"
    Write-Host "Logs:        pm2 logs $AppName"
    Write-Host ""
    Write-Host "Lembre de ajustar NEXTAUTH_URL e APP_URL para seu domínio em .env"
}
