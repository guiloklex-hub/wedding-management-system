# 📖 Glossário

Termos usados no sistema, explicados em linguagem do dia-a-dia. Útil para
quem está conhecendo o casamento "por dentro" pela primeira vez.

---

### Anexo
Arquivo (foto, PDF, contrato) que você guarda junto de um fornecedor, contrato
ou local. Aparece em "Documentos".

### Audit log
Registro automático de quem fez o quê no sistema (criou um pagamento, mudou
status de fornecedor, etc.). Você pode consultar via Prisma Studio.

### Backup
Arquivo com todos os seus dados, pronto para restaurar caso aconteça algo com
o servidor. Baixe pela aba **Ajustes › Backup**.

### Cashflow / Fluxo de caixa
Quanto dinheiro entra e sai mês a mês até a data do casamento. Mostra se você
vai chegar com saldo positivo ou se precisa antecipar uma receita.

### Check-in
Marcar no sistema, no dia do casamento, que o convidado chegou. Útil para
controlar lista de presença.

### Contingência
Reserva (em %) para imprevistos. Padrão recomendado: **10%** sobre os
fornecedores contratados. Se algo aumentar (mudança de cardápio, chuva, etc.)
você tem uma folga.

### Contrato
Documento formal de um fornecedor, com valor total, condições de pagamento,
inclusões/exclusões e data de vencimento. O sistema mantém **versões**.

### CRON / Cron job
Tarefa que roda automaticamente em horários determinados (ex.: a cada 30
minutos). No nosso caso, usa-se para enviar lembretes de pagamentos e
tarefas.

### Dashboard
Tela inicial após o login. Mostra os números principais (orçamento, pago,
saldo, próximos vencimentos).

### Dia D
O dia do casamento. Tem uma tela dedicada (Dia D no menu) com cronograma,
contatos críticos, plano B chuva e check-in.

### Enxoval
Itens da casa que o casal compra antes/depois do casamento (cama, mesa,
banho, eletros). Cadastre por cômodo no menu **Enxoval**.

### Fornecedor
Empresa ou profissional contratado para o evento (buffet, decoração,
fotógrafo, DJ, etc.).

### Fundo de contingência
Veja **Contingência**.

### Heatmap
Mapa de calor mostrando os dias com mais pagamentos vencendo. Quanto mais
intenso, mais concentrado o dia.

### Health score
Nota de 0 a 100 mostrando a saúde do projeto: combina % contratado, %
pago, dinheiro em caixa, tarefas concluídas e atrasadas.

### iCalendar (.ics)
Formato padrão de calendário. Você pode importar `https://seudominio/api/calendar.ics`
no Google Calendar/Apple Calendar e ter tarefas e pagamentos na agenda.

### Idempotência
Garantia de que repetir uma ação não duplica o resultado. No nosso caso,
significa que um lembrete de pagamento X **nunca** é enviado duas vezes no
mesmo dia, mesmo se o cron rodar várias vezes.

### LGPD
Lei Geral de Proteção de Dados. Como você guarda dados pessoais de convidados,
você é o responsável — siga as boas práticas (acesso restrito, backup
seguro, atender pedidos de remoção/portabilidade).

### Lua de mel
Viagem após o casamento. Tem tela dedicada (Lua de Mel) para destino, datas,
orçamento e atividades.

### Onboarding
Wizard de configuração inicial. Roda **uma única vez** após você trocar a
senha provisória do admin no primeiro login.

### Padrinho / Madrinha
Convidado especial, geralmente um amigo ou parente próximo, que participa da
cerimônia. Marque com a flag `isPadrinho` no cadastro do convidado.

### Parcelamento
Forma de dividir um pagamento em várias parcelas mensais. Use os campos
`installmentNumber` e `totalInstallments` em cada pagamento.

### Pivote / Singleton
Em técnica: registro único no banco. Para o usuário: configurações que só
existem em uma cópia (data do evento, lua de mel, segurança).

### Plano B chuva
Texto livre que você guarda na tela do Dia D com o que fazer se chover (mover
para coberto, alugar tendas, etc.).

### PM2
Programa que mantém o servidor Node ligado mesmo depois de fechar o
terminal. Recomendado para produção.

### Privacidade (toggle "esconder valores")
Botão de "olho" que esconde temporariamente os valores em reais nas telas
financeiras. Útil para tirar print sem expor números.

### PWA
Progressive Web App. Permite instalar o sistema como um "app" no celular
(adicionar à tela inicial) e usar offline básico.

### RSVP
Sigla francesa que confirma presença em evento. Cada convidado tem um link
único `/rsvp/[token]` para confirmar/cancelar pela web.

### SaaS
Software as a Service. Esse projeto **não** é SaaS — você roda na sua
própria máquina, é "self-hosted".

### Self-hosted
Auto-hospedado. Você instala e mantém na sua máquina, em vez de pagar uma
empresa.

### Server Component
Componente React que roda no servidor (Next.js). Não precisa enviar
JavaScript ao navegador.

### Server Action
Função que roda no servidor mas é chamada como se fosse um form normal.
Usado para formulários — submissão sem precisar criar API endpoint manual.

### Soft delete
"Apagar" sem apagar de verdade — marca `deletedAt` com a data atual. Permite
restaurar e mantém histórico financeiro consistente.

### TOTP (2FA)
Código de 6 dígitos que muda a cada 30 segundos, gerado por apps como Google
Authenticator, Authy, 1Password. Camada extra de segurança no login.

### Tenant (multi-tenant)
"Inquilino" — em SaaS, cada cliente. **Este projeto é single-tenant**: uma
instalação = um casamento. Para vários casais, é uma instalação por casal.

### Vendor
Em inglês = fornecedor. Veja **Fornecedor**.

### Venue
Em inglês = local de evento (espaço, salão, igreja, sítio).

### WhatsApp Baileys
Biblioteca que conecta o sistema ao WhatsApp Web para enviar mensagens. Não
é a API oficial — usa o mesmo mecanismo do WhatsApp Web no navegador.

### WSL (WSL2)
Windows Subsystem for Linux. Permite rodar Linux dentro do Windows. Veja
[instalacao-wsl.md](instalacao-wsl.md).

### Zod
Biblioteca de validação que garante que os dados recebidos têm o formato
esperado (tipo, tamanho, padrão). Usada em todas as Server Actions.
