# Importação direta do iFood para o Dishy — implementação isolada

Branch: `feat/importacao-cardapio-segura`.
Esta funcionalidade foi desenvolvida para avaliação. **Não está conectada a nenhuma loja real nem homologada.**

## O que está implementado
- Botão **Buscar produtos no iFood** em Cardápio.
- API server-side `GET /api/ifood-catalog?restaurantId=<tenant-id>`.
- Verificação da autenticação Firebase e papel de proprietário do restaurante.
- Autenticação OAuth de aplicação **centralizada** com `client_credentials`, no servidor.
- Leitura, somente GET, das categorias e itens do catálogo do estabelecimento autorizado.
- Prévia da lista completa, busca por nome, filtro de categoria e seleção de itens até 250 por importação.
- Importação apenas após confirmação pelo proprietário; itens complexos (pizzas/complementos) ficam de fora para revisão.
- Produtos importados da API são criados inicialmente **inativos** no Dishy.
- O sistema nunca atualiza, altera nem exclui dados no iFood.

## Dependências de operação
1. Cadastrar o Dishy no [Portal do Desenvolvedor iFood](https://developer.ifood.com.br/pt-BR), com a categoria e os módulos compatíveis.
2. Garantir homologação e autorização do catálogo da loja para a aplicação. Para aplicações centralizadas, a permissão da loja é solicitada no portal do desenvolvedor e aceita pelo parceiro.
3. Configurar as variáveis de ambiente na hospedagem de testes (Render). **Nunca colocar segredos no navegador, GitHub ou chat**:
   - `IFOOD_CLIENT_ID` — Client ID do aplicativo iFood
   - `IFOOD_CLIENT_SECRET` — Client Secret, somente no servidor
   - `IFOOD_RESTAURANT_MERCHANT_MAP` — JSON mapeando os IDs de estabelecimentos do Dishy aos IDs autorizados do iFood, por exemplo:
     `{"DISHY_RESTAURANT_ID":"IFOOD_MERCHANT_UUID"}`
4. Executar build no ambiente de teste e validar a consulta com uma loja de homologação autorizada.
5. Apenas após autorização real e testes completos, planejar o lançamento para clientes.

**Observação:** o código atual implementa o fluxo de aplicação *centralizada*. Para aplicativo distribuído/autorização no navegador, será preciso implementar o fluxo com `userCode`, `authorizationCode` e renovação segura de tokens. O iFood pode exigir o enquadramento específico em homologação.

## Segurança e limitações
- Não é permitido buscar o catálogo de outra loja apenas informando seu nome ou URL pública.
- A whitelist `IFOOD_RESTAURANT_MERCHANT_MAP` é mantida no servidor para impedir que um restaurante consulte dados de outro.
- O item com montagem de pizza, combo ou complementos **não é convertido automaticamente**. Ele precisa ser adaptado ao cadastro especializado do Dishy.
- Mercados, farmácias e pet shops podem usar o módulo Item (fluxo próprio), distinto do módulo Catalog para restaurantes. Este protótipo é para estabelecimentos de alimentação.
- Não há sincronização contínua, apenas uma cópia inicial autorizada.
- A publicação na Vercel e a branch de produção devem permanecer inalteradas.

Documentação oficial: https://developer.ifood.com.br/en-US/docs/food/guides/modules/catalog/endpoints
