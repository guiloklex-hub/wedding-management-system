# Política de Segurança

Obrigado por se preocupar com a segurança do Wedding Finance Planner.
Este documento explica como reportar vulnerabilidades de forma responsável.

## Reportando uma vulnerabilidade

**NÃO** abra uma issue pública para vulnerabilidades de segurança.

Use o canal privado do GitHub:

➡️ <https://github.com/guiloklex-hub/wfv-management-system/security/advisories/new>

Ao reportar, inclua:

1. **Descrição** clara do problema.
2. **Impacto** estimado (qual o pior cenário?).
3. **Passos para reproduzir** — quanto mais detalhado, mais rápido o fix.
4. **Versão afetada** (`git rev-parse HEAD` ou tag).
5. **Sugestão de fix**, se você tiver alguma.

## Tempo de resposta

| Severidade | Resposta inicial | Fix |
|---|---|---|
| Crítica (RCE, leitura arbitrária) | 48h | 7 dias |
| Alta (escalação de privilégio, IDOR amplo) | 5 dias | 14 dias |
| Média | 14 dias | 30 dias |
| Baixa | 30 dias | quando possível |

Como este é um projeto comunitário sem SLA pago, prazos são esforço melhor —
não promessa contratual.

## Versões suportadas

| Versão | Suportada |
|---|---|
| `main` | ✅ |
| Releases anteriores | ⚠️ apenas se você estiver no ramo do release; senão, atualize |

Como o projeto não tem releases formais ainda, **só damos suporte ao último
commit em `main`**.

## Política de divulgação

- Trabalhamos com o pesquisador em um **fork privado** durante o fix.
- Após o fix em `main`, criamos uma **Security Advisory** pública com CVE
  (se aplicável).
- Pesquisador é creditado na advisory (a menos que prefira anonimato).

## Escopo

✅ **Dentro do escopo:**

- Bugs no código deste repositório.
- Vulnerabilidades em dependências usadas diretamente que afetem o sistema
  como instalado.
- Falhas no fluxo de autenticação, autorização, reset de senha, 2FA.
- Vetores de XSS, SQLi, CSRF, IDOR no app.
- Exposição não-intencional de secrets nos arquivos do repo.

❌ **Fora do escopo:**

- Vulnerabilidades em **infraestrutura de uma instalação específica** (sua
  VPS, seu nginx, seu DNS). Isso é responsabilidade de quem hospeda.
- Ataques que exigem **acesso físico** ao servidor já comprometido.
- Engenharia social contra os mantenedores.
- DDoS / volumetric attacks.
- Bugs em dependências de terceiros já reportados upstream (reporte direto a eles).

## Recompensas

Não há programa de bug bounty. Agradecemos publicamente quem reporta, e
adicionamos no `CONTRIBUTORS` se houver.

## Boas práticas para usuários

Se você está rodando o sistema:

- Mantenha o projeto atualizado (`git pull` periódico).
- Rode `npm audit` e siga as recomendações.
- Use HTTPS em produção (Cloudflare Tunnel ou nginx + Let's Encrypt).
- Troque a `ADMIN_PASSWORD` no primeiro acesso (o sistema força).
- Ative 2FA em **Ajustes › Segurança**.
- Não exponha o `dev.db` em diretório público.
- Backup do `.env` em local seguro (gerenciador de senhas).

Veja [docs/seguranca.md](docs/seguranca.md) para o guia completo.
