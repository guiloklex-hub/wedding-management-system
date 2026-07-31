# ✉️ Módulo de Convites Oficiais

O módulo de **Convites Oficiais** (`/dashboard/invitations`) gerencia o envio dos convites formais do casamento via WhatsApp e e-mail com controle de acesso por PIN de 4 dígitos para cada convidado ou grupo.

---

## 🔑 Principais Funcionalidades

- **Proteção do RSVP por PIN**: Convidados individuais e grupos familiares só acessam o formulário de confirmação após validar um PIN de 4 dígitos.
- **Formatação Flexível de Mensagens**: Suporte a merge tags personalizadas (`{pin}`, `{link-rsvp}`, `{data-limite}`, `{nomes}`, `{convidados}`, `{data}`, `{local}`).
- **Modos de RSVP**: Suporte ao RSVP Nativo do sistema ou RSVP Externo (redirecionamento para site próprio).
- **Envio de Arte**: Upload de arquivos JPG, PNG, WEBP ou PDF de até 10 MB enviados como anexo inline ou imagem inline.
- **Filtros e Exclusões**: Exclusão por tags e exclusão da categoria de padrinhos/madrinhas.
- **Transmissão Resiliente e Polimórfica**: Processamento em segundo plano com snapshot imutável da mensagem e lista de destinatários, garantindo idempotência e retomada segura pós-restart do servidor.
- **Relatórios e CSV**: Exportação dos resultados de entrega em CSV com proteção contra injeção de fórmulas e neutralização de caracteres especiais.

---

## 🔐 Segurança e Autenticação

1. **Gate de PIN Pública**:
   - Limitador de taxa: máximo de 5 tentativas por minuto por IP e token de RSVP.
   - Comparação timing-safe para prevenção de side-channel attacks.
   - Emissão de cookie assinado `HttpOnly`, `SameSite=Lax` com validade de 15 minutos.
2. **Imutabilidade e Snapshot**:
   - As configurações e mensagens são congeladas no momento em que o disparo é iniciado em `payloadJson`.
3. **RBAC**:
   - Usuários com permissão de edição (`canEdit`) podem visualizar destinatários e realizar envios de teste.
   - Apenas administradores e noivos (`canManage`) podem alterar configurações ou disparar transmissões oficiais.
