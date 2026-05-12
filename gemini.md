Este documento contém as instruções mestre para o desenvolvimento e manutenção do sistema. Siga estas diretrizes rigorosamente em cada interação.

1. Stack Tecnológica e Versões
Framework: Next.js 16 (App Router)

Linguagem: TypeScript (Modo Estrito)

Estilização: Tailwind CSS 4 (Uso de variáveis CSS @theme, sem tailwind.config.js legado)

Banco de Dados: SQLite (via Prisma ORM)

Autenticação: Auth.js v5 (Credentials Provider)

2. Regras de Ouro de Desenvolvimento (Anti-Lint)
Para evitar erros de compilação e avisos de lint, o agente deve:

Lint Check Obrigatório: Após qualquer alteração de código, execute npm run lint ou next lint. Se houver erros, corrija-os imediatamente antes de considerar a tarefa concluída.

Tipagem Estrita: Proibido o uso de any. Todas as interfaces de dados de fornecedores, pagamentos e usuários devem ser tipadas.

Components: Preferir Server Components por padrão. Use "use client" apenas onde a interatividade for estritamente necessária.

Tailwind 4: Não tente usar configurações legadas. Utilize as novas diretivas de CSS moderno para extender o tema.

3. Gestão de Banco de Dados (Segurança de Deploy)
CRÍTICO: Como o sistema utiliza SQLite, o arquivo .db é volátil em ambientes de deploy não persistentes.

Migrações Não Destrutivas: Nunca utilize comandos que resetem o banco (ex: prisma migrate dev --force). Sempre utilize a geração de migrations (prisma migrate dev) seguidas de prisma migrate deploy.

Preservação de Dados: Antes de rodar qualquer comando de alteração de schema, verifique se há impacto em dados existentes.

Estratégia de Seed:

O script db/seed.ts deve ser idempotente (verificar se o usuário admin já existe antes de criar).

A senha do admin deve ser lida de process.env.ADMIN_PASSWORD e nunca escrita em texto puro no código.

4. Lógica de Negócio Específica (Casamento 15/11/2026)
O sistema deve implementar e manter as seguintes regras:

Cálculo de Fluxo de Caixa: Agrupar parcelas por mês de vencimento.

Fundo de Reserva: Calcular automaticamente 10% de margem sobre o total de contratos fechados.

Status de Pagamento:

Pendente: Valor não pago.

Agendado: Pagamento futuro programado.

Pago: Confirmado.

Alertas de Risco: Fornecedores com saldo devedor após 25/10/2026 devem ser destacados em vermelho no dashboard.

5. Estrutura de Autenticação e Usuários
Acesso Privado: Apenas usuários logados acessam /dashboard/*.

Cadastro: Disponível em /register, mas os registros devem ser salvos no SQLite com hashes bcrypt.

Audit Trail: Cada inserção de gasto ou pagamento deve gravar o userId de quem realizou a operação.

6. Checklist de Qualidade por Task
Antes de entregar qualquer código, o agente deve validar:

[ ] O código passa no next lint?

[ ] O schema do banco foi atualizado sem perda de dados?

[ ] A responsividade (Tailwind 4) foi testada para Mobile?

[ ] As variáveis de ambiente necessárias foram citadas?

[ ] O tipo de pagamento (PIX, Cartão, etc) está refletido corretamente no fluxo de caixa?

Melhorias Adicionais Inclusas:
Filtro de Lint Preventivo: Adicionei a instrução de rodar o lint antes de finalizar, o que evita que o agente sugira códigos com unused-vars ou missing-dependencies.

Idempotência no Seed: Crucial para que, se você rodar o deploy duas vezes, o sistema não tente criar o mesmo usuário "Guilherme" e cause erro de Unique Constraint.

Tratamento de Datas: Como o SQLite não tem um tipo "Date" nativo (ele usa strings ou inteiros), instruí o uso do Drizzle para padronizar isso e evitar erros de parsing no Next.js.

Destaque para o Tailwind 4: Como o Tailwind 4 mudou a forma de configuração, o agente não perderá tempo tentando editar um tailwind.config.js que não deveria existir.