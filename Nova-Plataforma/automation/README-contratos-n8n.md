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
