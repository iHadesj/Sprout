# Sprout

Pomodoro anti-procrastinação com cara de caderno de campo: cada sessão de foco honesta faz crescer
uma árvore low poly num jardim 3D; desistir faz a árvore morrer. Um jardim por área da vida, e
amigos com ranking da semana, visitas aos jardins, regar e mandar corações.

A especificação está em [docs/PLANO.md](docs/PLANO.md) (com os ajustes feitos na implementação no fim).

## Rodar sem criar nada na nuvem

```bash
npm install
npm run dev:local
```

Sobe um "Supabase de mentira" em `localhost:54321`, com um Postgres de verdade (PGlite) rodando as
mesmas migrations, e o app em `localhost:5173`. Os dados ficam em `.local-db/`; apague a pasta pra zerar.
Serve só pra desenvolver: não tem e-mail de confirmação nem recuperação de senha.

Em desenvolvimento, `/dev/viveiro` mostra todas as árvores em todos os estágios (`/dev/viveiro?perto` aproxima a câmera).

## Rodar com o Supabase de verdade

1. Crie um projeto em [supabase.com](https://supabase.com) (o plano grátis basta).
2. Aplique as migrations de `supabase/migrations/`, em ordem. Dá pra colar cada arquivo no
   **SQL Editor** do painel, ou usar a CLI:
   ```bash
   npx supabase init        # só na primeira vez (cria supabase/config.toml)
   npx supabase link --project-ref SEU-PROJETO
   npx supabase db push
   ```
3. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API).
4. Em **Authentication → URL Configuration**, ponha a URL do app em *Site URL*. Pra testar
   rápido, dá pra desligar *Confirm email* em **Authentication → Sign In / Providers → Email**.
5. `npm run dev`

## Deploy na Vercel

1. Suba o projeto pro GitHub e importe na Vercel (ela reconhece o Vite sozinha).
2. Em **Settings → Environment Variables**, cadastre `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. No Supabase, adicione a URL da Vercel em *Site URL* e *Redirect URLs*.

O `vercel.json` manda toda rota pro `index.html` (o app é uma página só e o React Router cuida das rotas).

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | app com o Supabase do `.env.local` |
| `npm run dev:local` | app + Supabase local (PGlite) |
| `npm test` | testes do timer, das regras e do banco (migrations + RLS + RPCs no PGlite) |
| `npm run e2e` | teste ponta a ponta no Chrome, conferindo os critérios de cada fase |
| `npm run typecheck` / `npm run lint` | TypeScript e oxlint |
| `npm run build` | build de produção em `dist/` |

O E2E usa o Google Chrome instalado (ou o caminho em `CHROME_PATH`) e salva capturas em `e2e/output/`.

## Mapa do código

```text
src/
  app/            rotas, layout, providers
  features/
    auth/         login e cadastro
    gardens/      índice (registro do dia, prancha em destaque), página dupla do jardim, criação
    focus/        timerMachine (função pura), heartbeat em segundo plano, fichas de foco e revisão
    friends/      amigos, ranking da semana, convite, visita, regar e corações
    stats/        diário de campo (as contas são views no banco)
    account/      ficha do pesquisador: nome de usuário e fuso horário
    surprise/     link secreto que ativa enfeites num navegador
    dev/          viveiro (só em desenvolvimento)
  three/          cena 3D: ilha, árvores geradas por código, material facetado com vento, presentes
  lib/            cliente Supabase, api.ts (todas as chamadas), tipos do banco
  stores/         focusStore (Zustand)
supabase/
  migrations/     tabelas, segurança (RLS), funções do ciclo da sessão, estatísticas, árvores, amigos
  tests/          testes do banco rodando num Postgres em WASM
scripts/          Supabase local pra desenvolvimento e E2E
e2e/              teste ponta a ponta
```

A regra que manda em tudo: **o servidor decide se uma sessão vale**. O navegador só detecta
distração e relata; tempo e crescimento são calculados no banco, que não aceita escrita direta em
`plants` nem em `sessions`.
