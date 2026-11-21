# Dishy Leads AI — implementação isolada

Status: primeira etapa, **sem integração à interface, banco ou rotas**, sem publicação.

## Arquitetura verificada
Monorepo com `Master/`, `Sistema de restaurante/` e `Site comercial/`. O Master utiliza Express, tRPC, Drizzle/MySQL, React e Vite.

## Restrições
- Somente administradores Master, autorização verificada no backend.
- Nunca acessar dados operacionais de restaurantes-clientes.
- Tabelas próprias e migrações exclusivamente aditivas.
- Não alterar faturamento, licenciamento, sessões ou autenticação existentes.
- Sem mensagens automáticas ou coleta não autorizada de redes sociais.
- Nunca publicar ou migrar banco de produção sem aprovação explícita.
- Chave de recurso desativada por padrão; logs sem informações sensíveis.

## Próximas etapas
1. Inspecionar router, contexto de autenticação e esquema Drizzle reais.
2. Criar tabelas isoladas para leads, fontes, consentimento/oposição e eventos.
3. Criar endpoints Master protegidos e testes de autorização.
4. Construir página React do Master com filtros e funil.
5. Integrar provedor de busca permitido, com limites e deduplicação.
6. Executar check, testes, build e smoke em ambiente isolado.
7. Somente depois solicitar autorização para publicação.
