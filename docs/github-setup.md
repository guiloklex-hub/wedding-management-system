# ⚙️ Configuração recomendada do repositório GitHub

Lista completa de configurações para fazer **uma vez** no repositório
público no GitHub. Cada item linka para a tela exata.

Substitua `guiloklex-hub/wfv-management-system` pelo caminho real do repo.

---

## 1. Identidade do repositório

🔗 **Settings → General → Repository details**

- [ ] **Description:** "Sistema open-source para casais organizarem o casamento. Orçamento, fornecedores, convidados, lua de mel — self-hosted, em Next.js."
- [ ] **Website:** demo ou link do README (se houver).
- [ ] **Topics** (clique em ⚙ na lateral do About): `wedding`, `wedding-planner`, `nextjs`, `nextjs-16`, `prisma`, `sqlite`, `typescript`, `tailwindcss`, `pwa`, `auth-js`, `self-hosted`, `portuguese-brazilian`, `open-source`, `wedding-finance`.

---

## 2. Features

🔗 **Settings → General → Features**

- [x] **Issues** — ON (já temos templates).
- [x] **Discussions** — **ATIVAR** (clique em "Set up discussions"). Crie categorias: `Anúncios`, `Perguntas`, `Ideias`, `Show & tell`, `Geral`.
- [ ] **Wiki** — OFF (a documentação vive em `docs/`, não duplique).
- [ ] **Projects** — OFF se você não vai usar; senão, ON.
- [x] **Sponsorships** — ON se quiser receber doações (e edite `.github/FUNDING.yml`).
- [x] **Preserve this repository** — ON (arquivo no Internet Archive se algum dia for arquivado).

---

## 3. Pull Requests

🔗 **Settings → General → Pull Requests**

- [x] **Allow merge commits** — OFF (sujam o histórico).
- [x] **Allow squash merging** — ON, **default**. Marcar "Default to PR title and description".
- [x] **Allow rebase merging** — ON (opcional, útil para PRs pequenos limpos).
- [x] **Always suggest updating pull request branches** — ON.
- [x] **Allow auto-merge** — ON.
- [x] **Automatically delete head branches** — ON (limpa branches após merge).

---

## 4. Branch protection — `main`

🔗 **Settings → Branches → Add branch protection rule**

Branch name pattern: `main`

Marcar:

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1** (se você é solo, deixe 0 + use a opção abaixo).
  - [x] Dismiss stale pull request approvals when new commits are pushed.
  - [x] Require review from Code Owners (se você adicionar um `CODEOWNERS`).
- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging.
  - [x] Status checks que devem passar:
    - `Lint, typecheck, testes e build` (do `ci.yml`)
    - `Analyze (javascript-typescript)` (do `codeql.yml`)
- [x] **Require conversation resolution before merging**.
- [x] **Require signed commits** (opcional mas recomendado se você usa GPG/SSH signing).
- [x] **Require linear history** (combina com squash/rebase).
- [ ] **Require deployments to succeed** — OFF (não temos deployment ainda).
- [x] **Lock branch** — OFF (precisa permitir merge).
- [x] **Do not allow bypassing the above settings** — ON.
- [x] **Restrict who can push to matching branches** — adicione apenas você (e mantenedores futuros).
- [x] **Allow force pushes** — OFF.
- [x] **Allow deletions** — OFF.

> 💡 Se você for **único mantenedor**: pode deixar "Require approvals = 0" e usar "Include administrators" desligado, para conseguir mergear seus próprios PRs sem revisão. Mas mantenha os status checks obrigatórios.

---

## 5. Tag protection

🔗 **Settings → Tags → New rule**

- Pattern: `v*.*.*`
- Ativa proteção contra delete acidental de tags de release.

---

## 6. Security & analysis

🔗 **Settings → Code security**

Habilitar **TODOS**:

- [x] **Private vulnerability reporting** — permite reports privados (a `SECURITY.md` aponta pra cá).
- [x] **Dependency graph** — ON (geralmente já está).
- [x] **Dependabot alerts** — ON.
- [x] **Dependabot security updates** — ON (cria PR automático para CVEs).
- [x] **Dependabot version updates** — ON (já configurado em `.github/dependabot.yml`).
- [x] **Grouped security updates** — ON.
- [x] **Code scanning** — Configurar como "Default" ou usar o nosso `codeql.yml` (já existe).
- [x] **Secret scanning** — ON.
- [x] **Push protection** — ON. Bloqueia push se detectar secret na diff.
- [x] **Secret scanning for non-providers** — ON.
- [x] **Validity checks** — ON (verifica se tokens vazados ainda estão válidos).

---

## 7. Actions permissions

🔗 **Settings → Actions → General**

- **Actions permissions:** "Allow all actions and reusable workflows" (ou "Allow select actions" se quiser restringir).
- **Workflow permissions:** "Read repository contents and packages permissions" (menos é mais).
- [x] **Allow GitHub Actions to create and approve pull requests** — ON (precisa para Dependabot autopilot).
- **Fork pull request workflows:** "Require approval for first-time contributors" (evita rodar CI com código não-revisado de forks).

---

## 8. Pages (se for hospedar docs)

🔗 **Settings → Pages**

Não recomendo expor o app inteiro como Pages (é dinâmico). Mas você pode
expor só os **docs estáticos**:

- Source: "Deploy from a branch"
- Branch: `main` / pasta: `/docs`
- Custom domain: opcional

⚠️ Os arquivos em `docs/` estão escritos para serem lidos no GitHub. Para
ficarem bonitos como Pages, precisaria de um gerador (Docusaurus, MkDocs, etc.).
Sugiro **deixar pra depois**.

---

## 9. Labels

🔗 **Issues → Labels**

Adicione as labels que o auto-labeler precisa (workflow `.github/workflows/labeler.yml`):

| Label | Cor sugerida |
|---|---|
| `documentation` | `#0075ca` |
| `ci` | `#fbca04` |
| `dependencies` | `#0366d6` |
| `javascript` | `#f1e05a` |
| `github-actions` | `#2088ff` |
| `database` | `#5319e7` |
| `frontend` | `#a2eeef` |
| `backend` | `#1d76db` |
| `tests` | `#bfd4f2` |
| `security` | `#d93f0b` |
| `notifications` | `#0e8a16` |
| `good first issue` | `#7057ff` (padrão GitHub) |
| `help wanted` | `#008672` (padrão GitHub) |
| `bug` | `#d73a4a` (padrão GitHub) |
| `enhancement` | `#a2eeef` (padrão GitHub) |
| `question` | `#d876e3` (padrão GitHub) |

Atalho via gh CLI:

```bash
gh label create documentation --color 0075ca
gh label create ci             --color fbca04
gh label create dependencies   --color 0366d6
gh label create javascript     --color f1e05a
gh label create github-actions --color 2088ff
gh label create database       --color 5319e7
gh label create frontend       --color a2eeef
gh label create backend        --color 1d76db
gh label create tests          --color bfd4f2
gh label create security       --color d93f0b
gh label create notifications  --color 0e8a16
```

---

## 10. CODEOWNERS (opcional)

Crie `.github/CODEOWNERS`:

```text
# Default owner (todos os arquivos)
*       @guiloklex-hub

# Áreas sensíveis
/src/auth*.ts           @guiloklex-hub
/src/lib/timing-safe.ts @guiloklex-hub
/src/lib/rate-limit.ts  @guiloklex-hub
/.github/               @guiloklex-hub
SECURITY.md             @guiloklex-hub
```

Combina com "Require review from Code Owners" na branch protection.

---

## 11. Secrets & variables

🔗 **Settings → Secrets and variables → Actions**

Se algum dia o CI precisar de credenciais (deploy, releases assinadas, etc.), adicione aqui. Por enquanto não há nada.

**Não** coloque `NEXTAUTH_SECRET` real aqui — o CI usa placeholder no `ci.yml`.

---

## 12. About sidebar

🔗 Página inicial → engrenagem ⚙ ao lado de "About"

- **Description:** mesma do passo 1.
- **Website:** sua URL.
- **Topics:** mesmos do passo 1.
- [x] "Include in the home page" — releases, packages, deployments.
- [ ] "Use your GitHub Pages website" — desligue se não usa Pages.

---

## 13. Issues template

🔗 **Settings → General → Features → Issues → Set up templates**

Já criamos:

- `.github/ISSUE_TEMPLATE/bug.md`
- `.github/ISSUE_TEMPLATE/feature.md`
- `.github/ISSUE_TEMPLATE/config.yml` (desativa issues em branco e adiciona links)

Não precisa mexer na UI.

---

## 14. Discussions categories

Após ativar Discussions (passo 2), crie estas categorias:

- 📢 **Anúncios** — releases, mudanças importantes (formato Announcement).
- ❓ **Perguntas e ajuda** — dúvidas de uso (formato Q&A).
- 💡 **Ideias** — features ainda em discussão (formato Open-ended).
- 🎉 **Show & tell** — casais compartilhando como usaram o sistema.
- 💬 **Geral** — tudo o que não cabe nas categorias acima.

---

## 15. README badges dinâmicos

No README, atualize para apontar para o seu user real:

```markdown
[![CI](https://github.com/guiloklex-hub/wfv-management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/guiloklex-hub/wfv-management-system/actions/workflows/ci.yml)
[![CodeQL](https://github.com/guiloklex-hub/wfv-management-system/actions/workflows/codeql.yml/badge.svg)](https://github.com/guiloklex-hub/wfv-management-system/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
```

(Você pode adicionar isso ao README quando o repo já estiver com os
workflows rodando — antes disso o badge fica vermelho.)

---

## 16. Release workflow

Já existe (`.github/workflows/release.yml`). Para criar uma release:

```bash
git tag v0.2.0
git push origin v0.2.0
```

O workflow:
1. Roda lint + test + build.
2. Cria a GitHub Release com notas auto-geradas (baseadas nos commits).
3. Marca como pre-release se a tag tiver `-` (ex: `v0.3.0-beta.1`).

---

## 17. Conventional Commits (opcional)

Para que as release notes do GitHub fiquem bonitas, padronize commits:

```
feat:      nova feature
fix:       correção de bug
docs:      documentação
chore:     manutenção
refactor:  refatoração
test:      testes
ci:        CI/CD
perf:      performance
```

Veja [CONTRIBUTING](../CONTRIBUTING.md).

---

## ✅ Checklist final

Após fazer tudo acima:

- [ ] Description, website e topics configurados.
- [ ] Discussions ativado.
- [ ] PR settings: squash default, delete head branches, auto-merge.
- [ ] Branch protection ativa em `main`.
- [ ] Tag protection ativa em `v*.*.*`.
- [ ] Todos os "Code security" features ON.
- [ ] Push protection contra secrets ON.
- [ ] Dependabot rodou pelo menos uma vez (Insights → Dependency graph → Dependabot).
- [ ] CodeQL rodou pelo menos uma vez (Security → Code scanning).
- [ ] Labels criadas (passo 9).
- [ ] CODEOWNERS criado (passo 10).
- [ ] README com badges atualizados.
- [ ] Primeira release criada via tag.

Feito isso, o repositório está bem protegido contra acidentes,
spam, ataques automáticos e contribuições mal-formatadas — sem deixar
de ser convidativo para novos contribuidores.
