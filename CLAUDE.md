# Sprout

App pomodoro anti-procrastinação com jardins 3D por área da vida (React + TypeScript + Vite, three.js via React Three Fiber, Motion, Zustand, Supabase).

## Antes de qualquer tarefa
- Leia `docs/PLANO.md`: é a especificação do projeto (regras, anti-trapaça, banco, funções SQL, pastas, cena 3D, roadmap).
- Siga o roadmap por fases. Não comece uma fase antes do critério "pronto quando" da anterior estar valendo.

## Como trabalhar comigo
- Estou aprendendo: explique o que cada arquivo e decisão faz, de forma direta, sem me afogar em texto.
- Trabalhe em passos pequenos e me mostre o plano antes de mudanças grandes.
- Se algo do plano parecer errado ou incompleto, aponte antes de implementar.

## Regras do projeto
- O servidor decide se uma sessão vale; o front só detecta distração e relata. Nunca calcule recompensa no front.
- SQL do Supabase vai versionado em `supabase/migrations/`.
- Lógica do timer como função pura em `src/features/focus/timerMachine.ts`, com testes no Vitest.
