# Comandiva — Sistema de pedidos (contexto do projeto)

Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão nesta pasta.
Serve para não precisar reexplicar o histórico do projeto a cada conversa nova.

## O que é

Sistema completo de pedidos online para o restaurante **Comandiva** (Croatá/CE), rodando de forma
independente (sem depender de nenhuma plataforma no-code). Cliente faz pedido pelo site público,
equipe gerencia tudo pelo painel administrativo.

## Stack técnica

- **Frontend**: React + Vite + Tailwind, roteamento com `wouter`, dados via `tRPC` + React Query.
- **Backend**: Express + tRPC (`server/routers/*.ts`).
- **Banco**: MySQL/MariaDB via Drizzle ORM (`drizzle/schema.ts`). Migrations em `drizzle/*.sql`,
  aplicadas automaticamente no boot do container (`infra/entrypoint.sh` → `drizzle-kit migrate`).
- **Storage de imagens**: S3-compatible (MinIO em produção própria), helper em `server/storage.ts`.
  O bucket é criado automaticamente no primeiro upload se não existir.
- **Autenticação**: JWT em cookie httpOnly (local, sem serviço externo). Ver `server/_core/sdk.ts`
  e `server/_core/cookies.ts`.
- **Pagamento**: Pix (chave/QR configurados pelo admin) + cartão via Mercado Pago Checkout Pro
  (redirect hospedado, nunca tocamos em número de cartão). Outras processadoras (PagSeguro, Stripe
  etc.) têm cadastro de credenciais pronto em Admin → Conta, mas só o Mercado Pago tem cobrança
  automática de fato implementada.
- **Deploy**: Docker Compose (`docker-compose.independent.yml`) com 3 serviços: `app`, `db` (MySQL),
  `storage` (MinIO). Subir tudo com `./iniciar.sh` (cria `.env` com segredos aleatórios na primeira
  vez, depois só builda e sobe).

## Estrutura de páginas

- `/` — cardápio público (`client/src/pages/Home.tsx`). Categorias aparecem como cards visuais
  (imagem + nome), com filtro automático por horário (almoço/janta, fuso de Croatá/CE calculado
  no servidor). Promoções e eventos aparecem juntos no topo, com destaque visual diferente pra
  eventos.
- `/checkout` — finalização de pedido, com validação de endereço x rota de entrega (bloqueia se
  não bater).
- `/acompanhar` — acompanhamento do pedido pelo telefone; mostra Pix de novo se ainda não pago.
- `/painel-pedidos` — kanban operacional pra equipe (aceitar, preparar, entregar), com barra de
  progresso de tempo de preparo (verde → laranja aos 30min → vermelho aos 50min).
- `/admin/*` — painel administrativo completo:
  - `Cardápio`: categorias e produtos em **accordion recolhível** (fechado por padrão), complementos
    e promoções também em accordion. Upload de imagem, disponibilidade, preço, tudo editável.
  - `Rotas de entrega`, `Clientes`, `Relatórios` (com filtro de dia específico).
  - `Conta`: Pix, gateways de pagamento, chave Pix/QR.
  - `Eventos`: cadastro de eventos com imagem grande (até 100MB) e descrição.

## Estrutura das pastas (reorganizada em 2026-10-13)

O que antes era um repositório só agora são **3 projetos irmãos**, cada um com seu próprio git:

```
C:\Users\maico\OneDrive\Área de Trabalho\SaaS Restaurante\
├── Sistema de restaurante\   ← ESTE projeto: app dos restaurantes (cardápio, checkout, painel de pedidos, Admin)
├── Master\                    ← Painel Master (ex-saas-core): billing, planos, Modo Suporte, 2FA
└── Site comercial\            ← páginas do site de venda (mmsystem.tech/comercial); compiladas e publicadas PELO Master
```

A pasta antiga `...\Nova pasta\Pubx` foi mantida intacta como backup. O nome "Pub X" foi trocado por **Comandiva**
em textos e documentos; os **identificadores de produção** continuam `pubx` de propósito (banco de dados, usuário do
banco, bucket, volumes do Docker, cookie `pubx_session`, caminho das imagens `/assets/pubx/` gravado no banco,
domínio pubx.mmsystem.tech, pasta /opt/pubx e containers `pubx-*` na VPS) — renomear exige janela de manutenção.
Lista completa em `docs/identificadores-pubx.md`.

## Painel Master e licenciamento

O Painel Master (billing, planos, Modo Suporte) vive no projeto irmão **`..\Master`** (antes `saas-core/`), com
CLAUDE.md próprio. Este app só o consulta via `server/_core/license.ts` (sync em background, cache local com
fail-open) e bloqueia recursos pagos no backend por `featureProcedure`/`requireFeature`.

## Decisões importantes já tomadas (não refazer sem necessidade)

- **Categorias e produtos são reais, cadastrados via `scripts/seed-cardapio-mm.ts`** — um script
  idempotente que lê o cardápio real (extraído de fotos que o dono mandou) e popula o banco. Rodar
  de novo não duplica nada; também limpa dados de demonstração da instalação inicial
  (`scripts/seed.ts`, que só roda uma vez no primeiríssimo boot).
- Categorias e produtos têm campo `onPromotion` (produto) e a categoria virtual "Promoção" é
  montada no frontend juntando esses produtos — não é uma linha real na tabela `categories`.
- `timeAvailability` em categorias: `ALWAYS | LUNCH | DINNER | LUNCH_AND_DINNER`, comparado contra
  os horários globais configurados em `restaurantSettings` (`lunchStartTime` etc.), calculado com
  `Intl.DateTimeFormat` timezone `America/Fortaleza` (ver `shared/orderDomain.ts`,
  `isCategoryCurrentlyAvailable`).
- **Accordion no Admin > Cardápio**: implementado com o truque de CSS `grid-rows-[0fr]/[1fr]` +
  `overflow-hidden` (sem lib externa), fechado por padrão. Usado em `CatalogProductAvailability.tsx`
  (categorias, cada uma abre/fecha independente), `AddonManagerFull.tsx` (Complementos, seção
  inteira abre/fecha) e `PromotionManager` dentro de `Admin.tsx` (Promoções, idem). **Nunca aplicar
  esse padrão no cardápio público** — só no admin.
- **Auditoria de segurança já feita** (não repetir do zero, só revisar incrementalmente):
  - Portas do MySQL/MinIO no `docker-compose.independent.yml` só em `127.0.0.1` (não expor pra
    internet num VPS real).
  - `JWT_SECRET` com guarda de mínimo 32 caracteres no boot (`server/_core/index.ts`), senão o
    servidor recusa iniciar.
  - Rate limit simples em memória no login (`server/_core/rateLimit.ts`), 8 tentativas/10min por
    IP+usuário.
  - Chaves de gateway de pagamento (`apiKey`, `secretKey`) nunca voltam pro navegador — só um
    booleano indicando se já foram configuradas. Editar sem preencher de novo mantém o valor salvo.
  - Cabeçalhos de segurança básicos (`X-Frame-Options`, `X-Content-Type-Options` etc.) no Express.
- **`docker compose up --build` pode ficar muito lento (10-20min+) ou parecer travado** quando a
  máquina já tem muitos containers/dev servers rodando ao mesmo tempo (visto em sessão de
  2026-09-15/16: builds concorrentes disputando o builder do Docker Desktop, e o passo `chown -R
  /app` — sozinho, sobre `node_modules` — ficou parado por 8+ minutos sob carga pesada). Não é bug
  do Dockerfile: o mesmo build, sem concorrência e com a máquina mais livre, completa em ~3-4min.
  Se um build parecer travado, primeiro feche dev servers/containers não essenciais (ou reinicie o
  Docker Desktop) antes de investigar o Dockerfile.

## Como rodar localmente (o usuário já sabe fazer isso, é referência)

```bash
./iniciar.sh                       # sobe tudo (cria .env na primeira vez)
docker compose -f docker-compose.independent.yml down    # para
docker compose -f docker-compose.independent.yml logs app --tail=60   # ver logs
docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/seed-cardapio-mm.ts   # recadastrar cardápio real
```

O Painel Master sobe separado, a partir do projeto **`..\Master`** (ver o CLAUDE.md de lá).

## Sobre o usuário (Maycon)

- Está aprendendo Docker/infra na prática — explicações de erro devem ser passo a passo, sem supor
  conhecimento prévio de terminal/Docker.
- Ambiente: Windows + WSL2 + Docker Desktop, pasta do projeto dentro do OneDrive
  (`/mnt/c/Users/maico/OneDrive/Área de Trabalho/SaaS Restaurante/Sistema de restaurante` no WSL).
- Planeja hospedar em VPS (Hostinger, plano KVM, datacenter São Paulo). A revenda pra outros
  restaurantes já saiu do "avaliando" e está construída: camada `saas-core/` (ver seção própria
  acima).
- Prefere respostas diretas com o próximo passo prático; já passou por bastante troubleshooting de
  Docker/WSL/BIOS nesta jornada.

## Regras gerais ao mexer neste projeto

- Não fazer alterações destrutivas no banco — sempre migrations aditivas (`drizzle/000X_*.sql`,
  registradas em `drizzle/meta/_journal.json` e `drizzle/meta/000X_snapshot.json`).
- Migrations com mais de um `ALTER TABLE`/`CREATE TABLE` precisam do separador
  `--> statement-breakpoint` entre eles, senão o drizzle-kit falha ao aplicar.
- Reaproveitar componentes/rotas existentes em vez de recriar — o projeto já tem bastante
  funcionalidade construída incrementalmente ao longo de várias sessões.
- Qualquer mudança visual/estrutural no Admin não deve vazar pro cardápio público, e vice-versa.
