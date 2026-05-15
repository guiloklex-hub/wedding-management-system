# 🐧🪟 Instalação via WSL2 (Windows + Linux)

Esse guia é para quem está no **Windows** mas prefere o ambiente Linux. O
**WSL2** (Windows Subsystem for Linux) roda um Ubuntu real dentro do Windows,
com acesso completo ao terminal.

> 💡 Já tem WSL2? Pode pular para [instalacao-linux.md](instalacao-linux.md).

> ⏱️ Tempo total: 15 a 30 minutos (a primeira vez instala o WSL).

---

## 1. Instalar o WSL2 + Ubuntu

Abra um **PowerShell como Administrador** e rode:

```powershell
wsl --install
```

Esse comando:

- ✅ ativa o WSL2 no Windows;
- ✅ instala o Ubuntu (distribuição padrão);
- ⚠️ pede para **reiniciar** o computador depois.

Após reiniciar, o Ubuntu abre sozinho e pede para você criar um **usuário** e
**senha** Linux (não precisa ser igual aos do Windows).

---

## 2. Atualizar o Ubuntu

Dentro do terminal do Ubuntu:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Instalar Node 20 com nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# feche e reabra o terminal Ubuntu
nvm install 20
nvm use 20
node -v   # esperado: v20.x.x
```

---

## 4. Instalar Git (geralmente já vem)

```bash
sudo apt install -y git
git --version
```

---

## 5. Clone o projeto

> 💡 Dica: clone **dentro do filesystem do Linux** (ex.: `~/projetos/`). Clonar
> em `/mnt/c/...` funciona mas é até 10x mais lento por causa do bridge
> Windows↔WSL.

```bash
mkdir -p ~/projetos
cd ~/projetos
git clone https://github.com/SEU_USUARIO/wfv-management-system.git
cd wfv-management-system
```

---

## 6. Rode o setup

```bash
chmod +x setup.sh
./setup.sh
```

O resto é exatamente igual ao guia [Linux](instalacao-linux.md) — siga a partir
do passo 4.

---

## 7. Acessar do navegador do Windows

Como o WSL2 expõe automaticamente as portas locais, abra no **Chrome/Edge do
Windows**:

<http://localhost:3005>

> ⚠️ Em alguns casos (Windows com firewall corporativo), você precisa abrir
> também `http://127.0.0.1:3005`. Se nenhum funcionar, pegue o IP do WSL com
> `ip addr show eth0 | grep inet` e use esse endereço.

---

## 8. Editar arquivos com VS Code

Se você usa **VS Code** no Windows, instale a extensão **WSL** e rode dentro do
projeto:

```bash
code .
```

Ele abre o VS Code no Windows conectado ao filesystem do WSL — IntelliSense,
debugger e terminal funcionam normalmente.

---

## 9. Dicas de manutenção do WSL

- **Memória:** se o sistema sentir, ajuste `%UserProfile%\.wslconfig`:
  ```ini
  [wsl2]
  memory=4GB
  swap=2GB
  ```
- **Desligar WSL:** `wsl --shutdown` (PowerShell).
- **Atualizar WSL:** `wsl --update`.
- **Backup do Ubuntu inteiro:** `wsl --export Ubuntu C:\backup\ubuntu.tar`.

---

## Problemas?

Veja [troubleshooting.md](troubleshooting.md).
