# Modelo operacional V1

## Pedido

`restaurants/{restaurantId}/orders/{orderId}`

Campos principais:

- `number`: número visível do pedido
- `channel`: DELIVERY | PICKUP | TABLE | COUNTER
- `status`: PENDING_PAYMENT | RECEIVED | ACCEPTED | PREPARING | READY | OUT_FOR_DELIVERY | COMPLETED | CANCELLED
- `paymentStatus`: PENDING | PAID | EXPIRED | CANCELLED | REFUNDED
- `paymentMethod`: PIX | CASH | CARD_ON_DELIVERY | CARD_ONLINE
- `subtotalCents`, `deliveryFeeCents`, `discountCents`, `totalCents`
- `customerSnapshot`
- `deliverySnapshot`
- `items[]`: snapshot dos produtos/adicionais e preços no momento da compra
- `clientOperationId`: idempotência do checkout
- `createdAt`, `updatedAt`, `paidAt`

O total é recalculado no servidor usando os produtos publicados no Firestore. O total enviado pelo navegador nunca é considerado confiável.

## Pagamento

`restaurants/{restaurantId}/orders/{orderId}/payments/{paymentId}`

- `provider`: MERCADO_PAGO
- `providerPaymentId`
- `status`
- `amountCents`
- `pixQrCode`
- `pixQrCodeBase64` (temporário quando necessário)
- `expiresAt`
- `createdAt`, `updatedAt`

## Webhook

O webhook nunca aceita o status recebido como prova suficiente de pagamento.

Fluxo:

1. recebe o identificador do evento;
2. verifica se o evento já foi processado;
3. consulta o pagamento diretamente no provider;
4. confere restaurante/pedido/valor;
5. grava evento idempotente;
6. atualiza pagamento;
7. se aprovado, muda `paymentStatus` para PAID;
8. libera o pedido para operação;
9. cria evento para notificação WhatsApp quando habilitada.

## WhatsApp

A camada de pedidos apenas cria eventos de notificação. O provider poderá ser ativado depois:

`restaurants/{restaurantId}/notificationOutbox/{eventId}`

- `type`: ORDER_CREATED | PAYMENT_CONFIRMED | STATUS_CHANGED
- `recipient`
- `payload`
- `status`: PENDING | PROCESSING | SENT | FAILED
- `attempts`
- `createdAt`

A VPS/Evolution API consumirá esses eventos sem tornar a operação do restaurante dependente do WhatsApp.
