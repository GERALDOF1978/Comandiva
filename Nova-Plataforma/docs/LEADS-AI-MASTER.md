# Dishy Leads AI — módulo integrado no Master novo

## Localização correta
Projeto Vercel `saas-delivery`, domínio `dishy.com.br`, raiz `Nova-Plataforma/`.
Acesso Master: `/master` → componente `DishyMasterGate` em `src/main.jsx`.
NÃO usar `Master/`, que é outro painel do monorepo.

## Segurança e isolamento
- Branch de desenvolvimento: `feat/dishy-leads-ai-nova-master`, criada a partir do commit de produção identificado na Vercel `c70028db...`.
- Somente o Master autenticado vê o módulo. Todas as operações de dados revalidam Firebase ID Token revogável e `platformAdmins/{uid}.active === true` no backend.
- Endpoint: `api/create-restaurant.js` encaminha somente ações `lead_*` ao módulo `server-api/master-leads.js`, evitando exceder o limite de funções Vercel Hobby. O handler revalida o token e o documento do Master.
- Coleções próprias `platformLeads` e `platformLeadSearchLimits`, acessadas apenas com Admin SDK; não criam regras de escrita para o cliente.
- Nenhuma alteração em pedidos, restaurantes, licenciamento, planos, pagamentos, webhook ou login.
- Sem n8n, sem disparos em massa, sem cron e sem qualquer envio automático.
- Fonte de busca sob demanda: OpenStreetMap/Nominatim/Overpass, sujeita a disponibilidade, limites e cobertura. Respeitar ODbL, requisitos de atribuição e políticas dos serviços; expandir apenas com provedores adequados ao volume.
- Duplicação evitada com hash de origem OSM ou de identificação comercial.
- Pontuação é baseada em regras transparentes, não é inferência de IA generativa. IA externa só em etapa futura, com consentimento e credenciais seguras.
- Não publicar em produção, não integrar à branch de produção, não alterar Firestore Rules automaticamente.

## Funcionalidade da V1
Menu `Leads AI` dentro da aba Master.
1. Pesquisar empresas públicas por cidade, UF, raio e segmento.
2. Revisar resultados com atribuição OSM e adicionar um a um.
3. Cadastrar manualmente estabelecimentos.
4. Gerir status e notas no funil.
5. Copiar abordagem comercial / abrir WhatsApp manualmente; não enviar mensagens automaticamente.

## Checklist antes do release
- Executar `npm test` e `npm run build` em `Nova-Plataforma`.
- Validar autenticação: visitante, usuário comum e Master ativo.
- Validar falhas do provedor de pesquisa, limites de uso e custos.
- Confirmar regras de dados/licença, LGPD e opt-out `nao_contatar`.
- Testar em preview isolado e conferir diferenças da branch atual de produção.
- Pedir autorização expressa antes de qualquer deploy / migração de produção.
