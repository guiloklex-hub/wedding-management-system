## Resumo

<!-- 1-3 bullets explicando o que muda e por quê -->

## Tipo

- [ ] 🐛 Correção de bug
- [ ] ✨ Feature nova
- [ ] 📚 Documentação
- [ ] ♻️ Refatoração
- [ ] 🚀 Performance
- [ ] 🧪 Testes
- [ ] 🔧 Build / config

## Como testar

1. ...
2. ...
3. ...

## Checklist do AGENTS.md

- [ ] `await auth()` no início + tratamento de sessão ausente (Server Actions / Route Handlers)
- [ ] Body validado por Zod com limites explícitos
- [ ] Secrets comparados com `timingSafeEquals` (não `===`)
- [ ] Endpoint público / webhook tem rate limit
- [ ] Dados de usuário em HTML passam por escape
- [ ] Ação relevante grava em `AuditLog`
- [ ] Sem `console.log` de informação sensível
- [ ] Datas no fuso correto
- [ ] Sem `any` em contratos
- [ ] `npm run lint` passa
- [ ] `npm run test:run` passa
- [ ] `npm run build` passa
- [ ] `docs/`, `/help` e `README.md` atualizados se a mudança for visível

## Screenshots (se UI)

<!-- Antes / Depois ou GIF -->

## Breaking changes

<!-- Se houver, documente o impacto e como migrar -->
