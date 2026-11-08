# Dishy — contrato digital e mensagens n8n (versão 1, preparação)

## Situação
- A emissão de NFS-e ficou **fora desta implementação**; isso não dispensa obrigações fiscais futuras do prestador responsável.
- O código cria **minuta** por plano e contrato eletronicamente verificável, mas **não assina automaticamente** sem empresa/prestador efetivo legalmente identificado e documento revisto por advogado.
- A assinatura do software, PIX e cartão permanecem separados: **aceitar contrato não ativa plano nem realiza cobrança**.
- O contrato é disponibilizado no painel do **proprietário**; demais funcionários não podem aceitar.
- O texto definitivo, o valor, os módulos, a identidade das partes, a versão e o hash SHA-256 são persistidos em coleção privada no Firebase Admin. Nunca armazenar isso no documento público do restaurante.

## N8n — fluxo
Arquivo importável: `Nova-Plataforma/automation/n8n-dishy-contratos.workflow.json`

1. Importe no n8n dedicado ao Dishy.
2. Configure Webhook **POST** `dishy-contrato-aceito`, autenticação **Header Auth**: nome `X-Dishy-Contract-Key` e valor idêntico ao segredo de `N8N_CONTRACT_WEBHOOK_TOKEN` na Vercel.
3. Configure o nó **Enviar contrato por e-mail (SMTP)** com sua conta real e remova o remetente de exemplo. E-mail envia o texto integral, com o identificador do contrato.
4. Configure o nó **Avisar no WhatsApp (Evolution)**: URL da API `https://SEU_HOST/message/sendText/SUA_INSTANCIA`, credencial HTTP Header Auth com header `apikey` e valor da chave da instância. O nó anterior separa o contrato em blocos de até 2.800 caracteres.
5. Teste com e-mail/WhatsApp seus **sem ativar a assinatura comercial**; configure tratamento de erros por canal e deduplicação pelo `eventId` no n8n. Mensagens duplicadas devem ser recusadas pelo registro de eventId antes do envio.
6. Depois que o workflow estiver autenticado, revisado e publicado no n8n, configure a URL de PRODUÇÃO `/webhook/dishy-contrato-aceito` na Vercel. URL de teste não serve para operação contínua.
7. Use o histórico de Execuções do n8n para conferir entregas. **HTTP 200 na chamada do webhook comprova somente que o n8n recebeu a solicitação, não que WhatsApp e e-mail foram entregues.**

## Variáveis obrigatórias na Vercel
Todas devem permanecer nos ambientes de configuração segura (não colocar valores no GitHub ou no front-end).

- `DISHY_CONTRACT_ISSUER_NAME`: razão social/nome verdadeiro do prestador contratado.
- `DISHY_CONTRACT_ISSUER_DOCUMENT`: documento do prestador legal.
- `DISHY_CONTRACT_ISSUER_EMAIL`: contato profissional do prestador.
- `DISHY_CONTRACT_ISSUER_ADDRESS`: endereço completo do prestador.
- `DISHY_CONTRACT_LEGAL_REVIEWED=true`: **somente após** revisão efetiva por profissional responsável.
- `N8N_CONTRACT_WEBHOOK_URL`: endereço de produção autenticado do webhook.
- `N8N_CONTRACT_WEBHOOK_TOKEN`: segredo aleatório de no mínimo 20 caracteres.
- `DISHY_CONTRACT_ENABLED=true`: habilitar **apenas quando todos os itens acima estiverem completos, o responsável real for definido e os dois canais forem testados**.

Padrão seguro: se alguma configuração faltar, **somente a minuta é mostrada; nenhum aceite ou mensagem real é registrado ou enviado**.

## Interface
- `Meu plano -> Ler contrato`: o titular informa nome, CPF/CNPJ e WhatsApp.
- `Gerar contrato para conferência`: carrega documento e seu SHA-256, com a identificação das partes e valores do plano.
- Um aceite real (somente após ativação legal) requer marcar duas caixas distintas: concordância com o contrato e autorização de recebimento por WhatsApp/e-mail.
- O cliente aceita apenas a cópia mostrada, com validade máxima de dez minutos; alteração de preço ou cláusulas invalida a prévia.
- Registro no Firebase `subscriptionContracts/{eventId}` e outbox `contractDeliveryOutbox/{eventId}`, com idempotência por plano, versão e valor.
- Evento POST para n8n: `eventType: CONTRACT_ACCEPTED`, `eventId`, `planId`, `contractText`, `sha256`, `toEmail`, `toWhatsApp`, `contractPortalUrl`.
- O status `handed_off_to_n8n` significa **entrega ao fluxo**, não prova de envio nos canais. Adicionar confirmações por canal/retentativas e histórico no Master antes de operação real.

## Pendências comerciais e legais antes da ativação
- Identificar o prestador real da assinatura (não usar nome/CPF de terceiro apenas para interposição de faturamento).
- Contrato jurídico final e regras de cancelamento, vigência, cobrança e dados, alinhados ao prestador e às obrigações legais.
- Confirmar canal de WhatsApp (consentimento, regras da plataforma), remetente SMTP e política de retenção de documentos.
- Definir método de pagamento InfinitePay do prestador, sem confundir com credenciais dos restaurantes.
- Fase 2: emissão fiscal, quando houver regularização.


## Cobrança da assinatura Dishy (checkout avulso, sem recorrência)
Implementação adicional, **desabilitada até que o prestador efetivo e a conta que recebe estejam legalmente definidos**.

### Endpoints
- \`GET /api/subscription-contract?action=billingStatus&restaurantId=...\`: consulta mensalidades, somente conta proprietária com token Firebase.
- \`POST /api/subscription-contract?action=billingCheckout\`: \`{"action":"checkout","restaurantId":"...","contractId":"..."}\`. Exige contrato aceito pelo proprietário e regras comerciais habilitadas. Gera checkout de uma única utilização, com vencimento próprio, PIX/cartão.
- \`POST /api/subscription-contract?action=billingWebhook\`: webhook público da InfinitePay. **Não possui assinatura de origem**, portanto sempre valida \`order_nsu\`, \`invoice_slug\`, \`transaction_nsu\` e valor **diretamente** no endpoint oficial \`payment_check\`, antes de ativar plano. Eventos repetidos não repetem a ativação.
- \`POST /api/subscription-contract?action=billingReminders\`: endpoint autenticado pelo segredo no header \`X-Dishy-Billing-Cron-Key\`, invocado pelo n8n diariamente às 09h (America/Sao_Paulo); prepara lembretes 7 e 2 dias antes, no vencimento, e 1, 3 e 5 dias após. Um mesmo evento por competência e marco de prazo não deve ser criado duas vezes.

### Workflows importáveis no n8n (inativos)
- \`automation/n8n-dishy-mensalidades.workflow.json\`: webhook \`dishy-assinatura-evento\`, valida evento, envia texto por SMTP e WhatsApp Evolution API. Autenticação obrigatória \`X-Dishy-Billing-Key\`, mesmo valor que a variável segura \`N8N_BILLING_WEBHOOK_TOKEN\`.
- \`automation/n8n-dishy-lembretes.workflow.json\`: disparo diário do endpoint autenticado. Configurar credencial HTTP Header Auth com o header \`X-Dishy-Billing-Cron-Key\`.

O n8n **apenas notifica e agenda lembretes**. **Nunca** ativa planos, altera assinaturas ou interpreta um webhook InfinitePay como comprovante confiável. A ativação ocorre no servidor depois de \`payment_check\` e gravação transacional.

### Variáveis comerciais (todos os valores são privados e devem ser configurados na Vercel)
- \`DISHY_BILLING_ENABLED=true\` — somente após a autorização legal da operação.
- \`DISHY_BILLING_MERCHANT_REVIEWED=true\` — confirmar que a conta recebedora pertence ao prestador real identificado no contrato.
- \`DISHY_BILLING_INFINITE_HANDLE\` — InfiniteTag do recebedor.
- \`DISHY_BILLING_INFINITE_API_KEY\` — API Key exclusiva do **recebedor das mensalidades Dishy** (nunca as credenciais InfinitePay dos restaurantes).
- \`N8N_BILLING_WEBHOOK_URL\` — webhook de produção HTTPS do n8n, autenticado.
- \`N8N_BILLING_WEBHOOK_TOKEN\` — token exclusivo do webhook, mínimo 20 caracteres.
- \`DISHY_BILLING_CRON_TOKEN\` — token exclusivo do agendador, mínimo 20 caracteres.

**Condições simultâneas para gerar cobrança:** \`DISHY_BILLING_ENABLED=true\`, \`DISHY_BILLING_MERCHANT_REVIEWED=true\`, \`DISHY_CONTRACT_ENABLED=true\`, \`DISHY_CONTRACT_LEGAL_REVIEWED=true\` e credenciais InfinitePay válidas.

### Regras financeiras
- Sem cobrança automática na InfinitePay: cada período mensal exige um novo checkout.
- Link de **uso único**, expira em 14 dias, com checkout configurado para PIX e cartão.
- Pode ser gerado nos 7 dias anteriores ao fim do teste ou do período pago. Pagar antes preserva o prazo já concedido, pois a competência paga começa no fim desse prazo.
- Uma mensalidade só libera um período após verificação externa e pode ter resposta \`paid_needs_review\` quando houver mudança de plano ou divergência de ciclo.
- Alterar plano durante assinatura paga exige avaliação no Master (sem migração automática ou cobrança duplicada).
- Cancelamento/estorno não devem depender de webhook não assinado; exigem conciliação com a InfinitePay e processo específico.
- O status de entrega ao n8n confirma o recebimento pelo webhook, não confirma entrega do WhatsApp ou e-mail. Configurar deduplicação e confirmação por canal antes de ativar em produção.
- As regras atualizadas do Firestore precisam de publicação e teste separados do deploy na Vercel. Não presumir que build publicado aplicou essas regras.

### Testes e cuidados
A InfinitePay informa não ter sandbox para Checkout Integrado. Um checkout real gera cobrança verdadeira. **Não testar valores usando a conta pessoal ou de clientes** antes de definir o responsável legal pela venda e obter as autorizações necessárias.

A emissão fiscal integra uma etapa futura da implementação, mas a ausência da função de NFS-e no Dishy não elimina obrigações legais do prestador.
