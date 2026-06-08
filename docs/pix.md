# Pix nos presentes (cota lua de mel)

A v0.3.0 adiciona QR Code Pix **estático** (BR Code) para presentes em dinheiro. O sistema **não integra** com gateway externo — a baixa é manual, feita pelo casal depois de conferir o extrato.

## Configuração inicial

Em **Ajustes › Casamento › "Pix (cota lua de mel)"** (campos novos em `EventSettings`):

- `pixKey` — a chave Pix (CPF, CNPJ, email, telefone ou aleatória). Max 77 chars.
- `pixKeyType` — `CPF` | `CNPJ` | `EMAIL` | `PHONE` | `RANDOM`. Apenas informativo.
- `pixHolderName` — nome do recebedor que aparece no comprovante. **Max 25 caracteres** (limite do BR Code).
- `pixCity` — cidade do recebedor. **Max 15 caracteres**.

## Marcando um presente como "cota lua de mel"

No form de criar/editar um presente em dinheiro, marque a caixa **"Cota da lua de mel (mostrar QR Pix dedicado)"** — campo `Gift.isHoneymoonShare`.

## Gerando o QR

Botão de QR na lista de presentes abre `/dashboard/gifts/{id}/pix`. A página:

1. Lê `EventSettings` e valida que chave, nome e cidade estão configurados.
2. Chama `generateBrCode()` de [src/lib/pix.ts](../src/lib/pix.ts) — gera o EMV TLV com CRC16-CCITT (poly 0x1021, init 0xFFFF). Vetor de teste no `pix.test.ts`.
3. Renderiza QR Code PNG via `qrcode` (in-memory data URL) e oferece "Pix copia e cola".

## Confirmando recebimento

Após o convidado pagar, o casal abre o presente e clica **"Marcar como recebido"** (action `markGiftAsPixReceived`):

- Seta `Gift.pixPaidAt` e `status = RECEIVED`.
- Opcionalmente cria `Asset` com o valor para entrar no caixa. Quando cria o
  `Asset`, também grava `Gift.processedAt` (marca "lançado nas finanças"). Se o
  presente já foi lançado — por aqui ou pela ação **"Lançar nas finanças"**
  (`convertGiftCashToIncomeOrAsset`, que vira `Income` ou `Asset`) — o `Asset`
  **não** é recriado, evitando dupla contagem. Nesse caso o painel mostra o
  aviso em vez da caixa "Adicionar ao caixa".

> Pix estático **não tem callback automático**. O sistema não sabe que o pagamento ocorreu até o casal marcar manualmente. Se quiser baixa automática, seria necessário integrar com MercadoPago ou similar — fora do escopo da v0.3.0.

## Limites do BR Code

O EMV TLV impõe:
- Nome do recebedor: **máx. 25 ASCII**. Acentos são removidos (ex.: "Joao e Maria"). Names mais longos são truncados.
- Cidade: **máx. 15 ASCII**.
- Valor: 2 casas decimais, ponto como separador, máx. 13 chars.
- Texto livre (`txid`): 25 alphanumeric chars. O sistema usa `gift.id` como txid.
