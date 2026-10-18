# Nova Plataforma V1

Esta pasta contém a reconstrução SaaS multiempresa baseada nas regras de negócio do Comandiva.

## Objetivos

- custo de infraestrutura próximo de R$ 0 durante desenvolvimento e validação;
- um único sistema para vários estabelecimentos;
- isolamento obrigatório por `restauranteId`;
- Firebase Authentication para autenticação;
- Cloud Firestore para dados operacionais;
- Vercel para frontend e endpoints server-side compatíveis;
- ImgBB para imagens, com redimensionamento/compressão WebP antes do upload;
- PIX automático desde a V1;
- integração de WhatsApp preparada para VPS/Evolution API/n8n;
- Google Sheets apenas para relatórios, exportações e resumos, nunca como banco transacional.

## Estrutura de dados inicial

```text
restaurants/{restaurantId}
  settings/general
  categories/{categoryId}
  products/{productId}
  customers/{customerId}
  tables/{tableId}
  orders/{orderId}
  promotions/{promotionId}
  deliveryAreas/{areaId}
  members/{uid}
  audit/{auditId}
```

Coleções da plataforma:

```text
platformAdmins/{uid}
plans/{planId}
subscriptions/{restaurantId}
paymentWebhookEvents/{eventId}
```

Todo documento operacional deve pertencer explicitamente a um restaurante.

## Pagamentos

A aplicação não deve depender diretamente de um gateway específico.

Contrato lógico:

```text
PaymentProvider
  createPixCharge()
  getPayment()
  processWebhook()
  refundPayment()
```

Primeiro provider: Mercado Pago.

Fluxo:

```text
Checkout
 -> cria pedido PENDING_PAYMENT
 -> endpoint seguro cria cobrança PIX
 -> cliente recebe QR Code / copia e cola
 -> Mercado Pago envia webhook
 -> endpoint valida/consulta o pagamento
 -> registra evento idempotente
 -> pagamento passa para PAID
 -> pedido é liberado para operação/cozinha
 -> evento de notificação é criado
```

Credenciais do Mercado Pago nunca ficam no frontend ou no repositório.

Cada restaurante deverá possuir sua própria configuração/conta de recebimento. O dinheiro do pedido pertence diretamente ao estabelecimento.

## WhatsApp

O domínio de pedidos não deve depender da Evolution API.

Contrato lógico:

```text
NotificationProvider
  sendText()
  sendOrderCreated()
  sendPaymentConfirmed()
  sendOrderStatusChanged()
```

Provider planejado:

```text
Aplicação
 -> fila/evento de notificação
 -> gateway configurável
 -> VPS
    -> Evolution API
    -> n8n (quando necessário)
 -> WhatsApp
```

A ausência da VPS ou do WhatsApp não pode impedir pedidos ou pagamentos.

## Segurança

- nenhuma chave secreta no cliente;
- Firestore Rules com isolamento por restaurante;
- endpoints privilegiados validam Firebase ID Token;
- webhooks possuem idempotência;
- valores monetários em centavos;
- pedido guarda snapshot de nome/preço/adicionais comprados;
- mudanças sensíveis geram auditoria;
- credenciais de pagamento nunca são armazenadas em texto puro no Firestore.

## Princípio de migração

Preservar regras de negócio maduras do Comandiva e substituir gradualmente MySQL/Drizzle, armazenamento S3/MinIO e autenticação própria pela nova infraestrutura.

O código original permanece disponível como referência durante a reconstrução.
