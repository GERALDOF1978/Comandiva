# Dishy — Revisão pré-lançamento (03/11/2026)

Escopo: inspeção estática da branch `feat/cardapio-inteligente`, comparação com o fluxo recente de produção, testes automatizados locais de funções isoladas e validação de build/deploy. **Não substitui pentest, verificação das regras publicadas no Firebase, nem testes reais de pagamento.**

## Implementado neste lote
- **Início:** mostrar, baixar e compartilhar QR Code geral do cardápio, baseado no slug público da loja. O QR geral não libera uma mesa nem contém token de comanda.
- **Mesa sem QR:** cartões comuns e pizzas mantêm a visualização, mas não podem abrir montagem nem adicionar produtos. Há proteção também nas funções de abertura/montagem/checkout; após ler o QR válido, o cliente usa o fluxo próprio de `TableSelfService`.
- **Modos por loja (já existente):** Configurações > Modalidades de atendimento separa Entrega, Retirada, Mesas e Comandas. `enabledServiceModes` e APIs `create-order`/`tabs` validam o serviço ativo. Padrão de lojas antigas: todos ativos até configuração explícita.
- **Cabeçalhos defensivos:** nosniff, Referrer-Policy, X-Frame-Options SAMEORIGIN e Permissions-Policy para câmera/geolocalização próprias, microfone desativado. Render e Vercel.
- **API pública de rota:** limite para tamanho de endereços e quantidade de endereços alternativos, validando coordenadas e ações. Previne consultas externas desnecessárias e erros de parâmetros.
- **Upload de imagens:** validação de IDs de tenant, limite de payload e somente JPEG/PNG/WebP base64 (SVG não aceito). Mantida a verificação de proprietário/gerente/Master antes do upload.
- **Teste automatizado de rotas:** cenários de endereço longo, alternativas excessivas, coordenadas inválidas, ação desconhecida, método não autorizado e rota válida.

## Proteções identificadas no código
- Firebase Authentication e checagem de membro/role nas APIs administrativas e de operação.
- `platformAdmins` com permissão verificada no backend e escrita direta negada nas regras versionadas; esconder o atalho Master não é o controle de acesso.
- Tokens de Mercado Pago guardados em `privateIntegrations` criptografados em AES-256-GCM; Access Token não é devolvido no GET de configuração.
- O cliente não escolhe livremente o valor final: produtos, tamanhos e complementos são recalculados a partir dos preços de cadastro no servidor em Mesas e Comandas.
- `create-order` valida modalidade e método de pagamento por restaurante; pagamentos online exigem confirmação antes do fluxo operacional.

## Pendências importantes antes de venda em escala
1. **Assinaturas:** a página Master controla planos/assinaturas, mas não cobra automaticamente, não renova e não há bloqueio automático do tenant ao vencer o trial. É possível operar piloto com cobrança/ativação manual, deixando isto explícito.
2. **Prazo do teste:** backend e landing publicam **100 dias**, e não 180. Alinhar política comercial antes de divulgar; evitar mudar contratos atuais sem planejamento.
3. **LGPD / documentos comerciais:** inexistem páginas públicas para Política de Privacidade e Termos de Uso. Preparar com identidade do operador, canais de contato, finalidades, retenção, subprocessadores e base legal; revisão jurídica recomendada.
4. **Abuso de APIs públicas:** planejar rate limiting na borda e observabilidade para `create-order`, `tabs?public=1`, CEP, rota e recuperação de pedidos, com limites que não prejudiquem clientes legítimos.
5. **Regras publicadas do Firestore:** comparar `firestore.rules` no repositório com as regras realmente implantadas no Firebase. Conferir a possibilidade de listar produtos/categorias ativos de restaurante ainda não publicado; aplicar filtro `published` após testes no emulador e deploy próprio do Firebase. **Git/Vercel não atualizam regras automaticamente.**
6. **Pagamentos:** falha anterior na criação PIX podia deixar pedido com `paymentStatus: ERROR`. Confirmar exclusão/filtragem/recuperação desses registros e fluxo de idempotência; validar webhook oficial, valores e cancelamentos.
7. **Cartão online:** feature com condições por gateway, mas sem certificação de checkout neste lote. Não anunciar como garantido até teste real.
8. **Cadastro e multitenancy:** teste de duas contas de lojas diferentes; confirmar que funcionários veem somente o tenant autorizado e que revogação de acesso funciona após recarregar.
9. **Disponibilidade e continuidade:** backups/restauração Firebase, monitoramento dos logs e alertas, limites de uso Vercel/Render, rotina de incidente/rollback.
10. **Segurança complementar:** política CSP em modo Report-Only, revisão de dependências npm, validação de payloads em todas as APIs, proteção contra bots e avaliação externa de penetração.
11. **Marketing/UX:** revisar telas pequenas, acessibilidade da navegação, notificações permitidas, aceite do WhatsApp e consistência dos números de KPI.

## Checklist manual de aceitação
- [ ] Loja A ativa somente Retirada: cliente vê apenas Retirada; Delivery e Mesa indisponíveis e API recusa canal desativado.
- [ ] Loja B ativa Entrega e Mesa: escolhas corretas na entrada.
- [ ] Início: QR geral do cardápio abre em outro celular, copia, baixa PNG e compartilha.
- [ ] Na mesa sem QR: pizza, marmita e lanche mostram preço, mas não montam nem colocam no carrinho.
- [ ] QR individual de mesa: abre comanda correta, configura pizza/lanche/marmita, grava conta, chega à cozinha e mantém preços.
- [ ] Cliente por Entrega e Retirada monta itens, finaliza, PIX aguarda confirmação, cozinha só recebe após pagamento, avisos push/WhatsApp chegam.
- [ ] PDV registra venda presencial e imprime via correta.
- [ ] Funcionário sem permissão recebe 403 ao chamar APIs de outros módulos; proprietário de A não vê pedidos/clientes de B.
- [ ] Master /master não é acessível por conta não autorizada.
- [ ] Trial e plano pago: validar datas, limites e status; operação comercial deixa claras cobranças manuais.
- [ ] Teste de falha: Mercado Pago indisponível, webhook duplicado, upload inválido, coordenadas malformadas, cliente sem rede.
- [ ] Conferir operação em produção e teste após deploy, sem misturar chaves e ambientes.

## Publicação
1. Compilar e testar branch isolada no Render.
2. Confirmar rotas sem autenticação e login como proprietário/funcionário sem usar pagamentos reais acidentalmente.
3. Fazer **uma** publicação da versão aprovada na Vercel.
4. Não aplicar mudanças em `firestore.rules` sem testar e publicar especificamente no Firebase.
5. Registrar commit de produção e plano de rollback.
