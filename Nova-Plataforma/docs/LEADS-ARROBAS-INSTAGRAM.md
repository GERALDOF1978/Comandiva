# Dishy Leads AI — banco de @ Instagram por nicho (etapa de desenvolvimento)

## Objetivo
Agrupar usernames **públicos e comerciais** do Instagram de restaurantes,
pizzarias, hamburguerias, lanchonetes, marmitarias, açaíterias e outros negócios
alimentícios, para preparar **seleções pequenas de menções relevantes**
para postagens do Dishy.

## Integração
- Dentro de `Nova-Plataforma/src/components/MasterLeadsAI.jsx` na aba `📸 @ Instagram`.
- Busca por cidade e nicho reutiliza a consulta OpenStreetMap do Leads AI.
- A origem principal é `contact:instagram` ou `instagram` dos estabelecimentos públicos no OSM; empresas salvas podem oferecer links adicionais.
- A aba possui pesquisa própria de @ públicas por cidade, UF, raio e segmento: `lead_handle_discover`, consultas OSM por tags Instagram, limite de 150 perfis por busca, cache de 4 horas e intervalo mínimo de 60 segundos entre buscas novas por Master.
- Uma inclusão manual exige estabelecimento, cidade, segmento e perfil informado.
- Coleção isolada `platformSocialHandles`, apenas API Admin, já protegida pela autenticação de Master ativo.
- Ações `lead_handles`, `lead_handle_discover`, `lead_handle_import`, `lead_handle_add`, `lead_handle_review` roteadas na mesma função serverless existente `api/create-restaurant.js`.
- Registros com @ duplicadas são deduplicados pelo username em minúsculas.
- Status: `sugerida`, `revisada`, `nao_mencionar`.
- Os perfis **não são verificados pela API do Instagram**; “revisada” significa que o Master conferiu manualmente.
- Sem acesso a seguidores, contas privadas, cookies, login Instagram ou dados pessoais ocultos.
- Sem disparo, publicação ou marcação automática.
- O gerador de legenda copia no máximo 5 perfis revisados selecionados por vez; escolha somente os relacionados à postagem.
- Exportação CSV de @ revisadas para controle interno.
- Há limite de 500 itens por consulta, não é uma listagem completa do Instagram; fontes públicas são incompletas.

## Antes do lançamento
- Executar `npm run build`, incluindo os novos testes de validação de @ e fontes.
- Testar com Master ativo: buscar uma cidade com `contact:instagram`, importar, validar a presença do perfil, marcar revisado, copiar um grupo, exportar CSV, definir Não mencionar.
- Testar com usuário comum: `403 master_only`.
- Validar respeito às regras e políticas de menções do Instagram; contas podem restringir quem pode mencioná-las.
- Publicar em produção somente com autorização específica.
