# Dishy — checklist operacional para o primeiro restaurante pagante
Versão 03/11/2026. Código de referência: branch `feat/pronto-operacao-180-dias`. Estado de produção exige confirmar commit e testes antes de comunicar ao cliente.

## Modelo de negócio
- Um plano comercial: **Dishy Completo**; valor e meio de cobrança devem ser definidos e informados por escrito antes da contratação.
- Novos restaurantes: **180 dias de teste** contados da criação. Não há cobrança automática.
- No fim do trial, a API bloqueia novos pedidos do restaurante até a ativação manual de plano pago pelo Master; o painel, histórico, consultas e a conclusão de pedidos/pagamentos já existentes continuam acessíveis.
- Master marca `pending_payment` ao atribuir plano pago. Só mudar para `active` após confirmar pagamento por meio externo e registrar comprovante comercial.
- Planos com status `pending_payment`, `canceled` ou trial vencido não recebem novos pedidos. Pedidos antigos não são apagados.
- Lojas antigas sem documento de assinatura recebem compatibilidade temporária `legacy_without_subscription`; cadastrar plano no Master antes da venda e auditar essas lojas. Nunca remover o documento de assinatura para contornar cobrança.
- Valores dos planos não foram fixados no código; usar o painel Master conforme negociação. Não criar cobranças fictícias.

## Antes de convidar o restaurante
- [ ] Ter **CNPJ/CPF e razão social** do operador do Dishy, canal de suporte, Política de Privacidade e Termos assinados/publicados.
- [ ] Confirmar políticas de reembolso, cobrança manual, nota fiscal e cancelamento com contador/assessoria.
- [ ] Conferir **produções separadas**: Vercel `dishy.com.br`, Render `dishy-teste.onrender.com`; não compartilhar projetos Firebase para testes destrutivos.
- [ ] Conferir que o código da Vercel é o commit validado. Manter o ID do deploy anterior para rollback.
- [ ] Usar ambientes Vercel com `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` consistente com as credenciais já criptografadas. **Nunca regenerar a chave sem plano de migração**.
- [ ] Verificar `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, provedor de imagem, `VITE_FIREBASE_VAPID_KEY`, n8n e WhatsApp. Não imprimir valores secretos em logs.
- [ ] Testar o estado **realmente publicado** das Firestore Security Rules. O arquivo versionado não é publicado por um deploy Vercel.
- [ ] Identificar e corrigir alertas `npm audit` **antes de expansão comercial**; evitar versões `latest` sem lockfile.

## Cadastro do estabelecimento
1. Proprietário acessa `https://dishy.com.br/cadastro`.
2. Cria conta com e-mail/senha ou Google. Contas por senha confirmam e-mail antes de criar restaurante; o link pode ser reenviado.
3. Após verificação, cria o estabelecimento. O backend gera assinatura trial de 180 dias.
4. Em **Configurações**, define logo, banner, cores, endereço, horário, modalidades de atendimento (Entrega, Retirada, Mesas, Comandas) e publica o cardápio.
5. Em **Cardápio**, cadastra produtos, preços, tamanhos, adicionais e disponibilidade. Testar ingredientes e montagem.
6. Em **Configurações**, ativa os meios de pagamento aceitos. O proprietário conecta Mercado Pago; as chaves ficam bloqueadas para edição acidental após salvar.
7. Configura WhatsApp e notificações; não presumir funcionamento sem um pedido completo e prova de recebimento.
8. Em **Início**, abre **QR Code do cardápio** para copiar, mostrar e salvar. Os QR individuais de mesa são emitidos em **Mesas e Comandas**, nunca pelo QR geral.
9. A conta do funcionário recebe apenas módulos autorizados; testar o login do funcionário sem permissão Master.
10. Confirmar com o cliente qual o suporte e o prazo de respostas.

## Testes de aceite por loja
- [ ] Cardápio público abre no celular por link e QR geral; mostra somente modalidades habilitadas.
- [ ] Mesa, sem leitura do QR próprio, deixa ver preços mas não montar/comprar; ao ler QR correto, permite pedir, chamar atendente e pedir conta.
- [ ] Testar lanche com 2 complementos, pizza 4 fatias e borda, marmita com proteína repetida; confirmar no painel de cozinha.
- [ ] Testar Retirada e Delivery completos, com endereço e frete corretos.
- [ ] Testar PIX real de valor baixo, webhook confirmado, pedidos sem duplicidade, status, recibo e notificações push/WhatsApp.
- [ ] Testar caixa/PDV no desktop, estoque/disponibilidade e impressão se contratadas.
- [ ] Simular erro de provedor, cliente sem conexão, QR expirado/comanda fechada e evento duplicado.
- [ ] Testar duas lojas distintas (A/B) e funcionário sem acesso: não deve ler, alterar, listar nem receber pedidos da outra loja.
- [ ] Testar expiração com **dados fictícios e ambiente isolado**, não alterando o prazo real de cliente em produção.

## Rotina de operação e resposta a incidentes
**Diariamente**: verificar API de pedidos, erros 4xx/5xx, pagamentos pendentes/ERROR, webhook n8n, push, pedidos sem responsável, status de entregadores e logs. Em caso de indisponibilidade, avisar restaurante e manter operação manual de pedidos, sem afirmar que PIX foi recebido sem confirmação do provedor.

**Semanalmente**: revisar assinaturas a vencer nos próximos 7/15/30 dias, contatos de suporte, segurança de contas e permissões, custos e quotas Vercel/Render, imagens, backups/exportação testada do Firebase, e relatórios de erro.

**Rollback**: preservar o ID do deploy Vercel anterior; se rota crítica falhar, reverter pelo painel Vercel e confirmar cardápio/PIX/WhatsApp. Não alterar credenciais, Firestore Rules ou dados para corrigir apenas uma falha de frontend.

**Atenção**: o Render gratuito demorou para liberar a porta e marcou um deploy como falho por timeout, apesar do processo Node ter iniciado. Não depender desse serviço gratuito como único ambiente operacional da produção.

## Pendências antes de escala
- Finalização e publicação de Termos de Uso e Política de Privacidade com dados reais do operador.
- Auditoria independente e validação das Firestore Rules publicadas.
- Correção/triagem das vulnerabilidades de dependências e lockfile.
- Conciliação financeira e cobrança automatizadas ainda não existem: operar assinaturas manualmente via Master e comprovantes.
- Monitoramento, backup/restauração e teste end-to-end por estabelecimento.
