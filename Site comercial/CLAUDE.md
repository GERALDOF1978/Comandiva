# Site comercial — Comandiva (contexto do projeto)

Resposta sempre em português (pt-BR). **Só alterar este site quando o dono pedir explicitamente** (regra antiga do projeto).

## O que é

As páginas do site de venda (mmsystem.tech/comercial): Home, Planos, Cadastro, Sucesso, Cardápio, Termos, Privacidade.
React + Tailwind. **Não tem build próprio**: o projeto irmão `..\Master` copia a pasta `src` para dentro dele
(`scripts/sync-site-comercial.mjs`), compila e publica. As páginas usam peças que moram no Master (`@/lib/track`,
`@/lib/usePageMeta`, `@/lib/trpc`, `@/components/ui/Button` e `Input`, `@/hooks/useScrollReveal`) e falam com o servidor do Master
(`public.plans`, `public.signup`, `public.uploadMenuReference`).

## Estrutura

- `src/pages/*.tsx` — as páginas.
- `src/routes.tsx` — tabela de rotas (`comercialRoutes`) que o Master lê.
- `src/comercial.css` — tema escuro do site (`.comercial-dark`).

## Como ver / alterar

1. Terminal 1 (em `..\Master`): `pnpm run dev:site` (copia a cada alteração) e Terminal 2: `pnpm run dev`.
2. Abrir http://localhost:4000/comercial.
3. Antes de dar por pronto: `pnpm run check` e `pnpm run test` em `..\Master` (há testes que leem estas páginas).

Imagens, logos, `sitemap.xml`, `robots.txt` e `llms.txt` ainda ficam em `..\Master\client\public`.
