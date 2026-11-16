# Sprout

App pomodoro anti-procrastinação com jardins 3D por área da vida (React + TypeScript + Vite, three.js via React Three Fiber, Motion, Zustand, Supabase).

## Antes de qualquer tarefa
- Leia `docs/PLANO.md`: é a especificação do projeto (regras, anti-trapaça, banco, funções SQL, pastas, cena 3D, roadmap).
- Leia a seção final `Backlog e progresso` do `docs/PLANO.md`: é onde está o que já foi feito, o que está em andamento e o que falta.
- Siga o roadmap por fases. Não comece uma fase antes do critério "pronto quando" da anterior estar valendo.

## Registro de progresso (obrigatório)
- `docs/PLANO.md` é a memória do projeto. Se a conversa se perder ou os tokens acabarem, só o que estiver escrito lá sobrevive.
- Ao **começar** uma tarefa de várias etapas, escreva a lista das etapas no backlog do `docs/PLANO.md`, com o estado de cada uma.
- Ao **concluir cada etapa**, atualize o `docs/PLANO.md` na mesma resposta: marque a etapa como feita, diga quais arquivos mudaram e o que a decisão resolve. Não deixe para o fim.
- Marcadores do backlog: `[ ]` a fazer, `[~]` em andamento, `[x]` feito (com a data).

## Como trabalhar comigo
- Estou aprendendo: explique o que cada arquivo e decisão faz, de forma direta, sem me afogar em texto.
- Trabalhe em passos pequenos e me mostre o plano antes de mudanças grandes.
- Se algo do plano parecer errado ou incompleto, aponte antes de implementar.

## Regras do projeto
- O servidor decide se uma sessão vale; o front só detecta distração e relata. Nunca calcule recompensa no front.
- SQL do Supabase vai versionado em `supabase/migrations/`.
- Lógica do timer como função pura em `src/features/focus/timerMachine.ts`, com testes no Vitest.
- Tema claro de papel, sem modo escuro. Nada de caixa com borda nem grade de células.
- Nada faz planta crescer além de foco honesto. Presentes de amigos são enfeite.
- Na tela de foco nada se mexe sozinho.
