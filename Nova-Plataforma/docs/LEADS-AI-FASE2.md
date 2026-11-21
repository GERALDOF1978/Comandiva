# Dishy Leads AI — Fase 2 (integração ao Master)

**Origem:** commit de produção `baa846f98055d07d837f8ddf177491863607d1d1`
**Branch isolada:** `feat/dishy-leads-ai-fase2`
**Aplicação:** `Nova-Plataforma/` → `/master` → aba Leads AI

## Recursos
- Busca OSM atual reaproveitada sem nova função serverless.
- Leitura de URLs públicas de site, cardápio, pedidos e redes sociais apenas quando os campos estão presentes no OSM.
- Salvar links publicamente informados junto ao lead; nada é inventado.
- Auditoria manual de site, cardápio digital e pedidos online: `sim`, `nao` e `desconhecido`.
- **Importante:** campo vazio no OSM inicia `desconhecido`; não corresponde a `nao`.
- Pontuação explicável com razões, necessidades pendentes de verificação e próxima recomendação.
- Mensagens de prospecção personalizadas por segmento (sem API externa, sem alucinação de fatos sobre o negócio).
- Datas de próximo contato e filtro de retornos pendentes quando o Master é aberto.
- Mantém `nao_contatar` e desabilita geração/envio por WhatsApp.
- Sem automações de mensagem, sem n8n, sem cobrança de IA nem coleta de dados pessoais privados.

## Segurança e compatibilidade
- Mesma API protegida `/api/create-restaurant`, ação adicionada `lead_assess`; nada acrescentado à quota de funções da Vercel Hobby.
- Back-end confirma Firebase ID Token revogável e `platformAdmins/{uid}.active === true`.
- Campos auditados e lembretes ficam no documento já existente `platformLeads/{id}`; **não são necessárias migrações**.
- Leads antigos funcionam: quando não há auditoria, os sinais são normalizados a partir de URLs explicitamente conhecidas; o restante fica `desconhecido`.
- A revisão humana sobrescreve explicitamente os sinais. A prioridade não é inferência por LLM nem teste ativo do site.
- Não modifica pedidos, pagamento, PIN, preços, planos, cardápio ou autorização dos restaurantes.
- Considerar LGPD e políticas de uso dos dados públicos antes de escalar a prospecção.

## Validação
- `npm test` para cobertura ampla da nova plataforma.
- `npm run build` executa os testes de prospecção e depois o build Vite.
- Conferir um lead antigo, uma inclusão nova, `Não contatar`, auditoria de canais, salvar e limpar retorno, filtros no celular.
- Requer autenticação Master para teste funcional; o build não comprova funcionamento real do Firestore.
- **Não publicar em produção até autorização específica.**
