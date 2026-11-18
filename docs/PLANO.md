# Sprout — Arquitetura

## Visão geral

Sprout é um pomodoro em que cada sessão concluída sem trapaça faz crescer um jardim 3D, e desistir ou se distrair faz a planta murchar. O usuário cria um jardim para cada área da vida que quiser (faculdade, treino, inglês, trabalho) e vê o próprio esforço virar paisagem.

- Público: quem procrastina e quer um motivo visual pra manter o foco.
- Princípio central: trapacear não compensa. Sem ranking público, o único enganado é o próprio usuário.
- Regra de ouro técnica: o servidor decide se uma sessão vale; o navegador só detecta distração e relata.
- Nome: Sprout ("broto" em inglês). Antes de lançar, conferir se está livre nas lojas de app, no GitHub e no domínio.

## Stack

React com TypeScript no front e Supabase no back: você já conhece PostgreSQL, e o Supabase te dá Postgres, login e regras de acesso sem escrever um servidor do zero.

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Build | Vite | Rápido, padrão atual pra React |
| Linguagem | TypeScript | Pega erro de tipo antes de rodar; bom passo pra sair do vibe coding |
| 3D | three.js via @react-three/fiber + @react-three/drei | Escreve a cena 3D como componentes React |
| Animação de UI | Motion (antigo Framer Motion), import de motion/react | Transições de tela, anel do timer, avisos |
| Estado local | Zustand | Simples, sem boilerplate; guarda o estado do timer |
| Dados do servidor | TanStack Query | Cache e recarregamento das chamadas ao Supabase |
| Rotas | React Router | Telas: jardins, foco, estatísticas, conta |
| Backend | Supabase (Postgres, Auth, RLS, funções RPC) | Tempo da sessão validado no banco com now() |
| Testes | Vitest | Testar a máquina de estados do timer |
| Deploy | Vercel | Você já usa no portfólio |

Alternativa pra depois: trocar o Supabase por uma API em Spring Boot. Dá mais trabalho, mas treina Java de verdade. A lógica de validação seria a mesma.

## Regras do pomodoro e do crescimento

Cada sessão de foco concluída alimenta uma planta; uma planta adulta precisa de 5 sessões honestas, e desistir no meio mata a planta da vez.

**Ciclo**

- Padrão: 25 min de foco, 5 min de pausa, pausa longa de 15 min a cada 4 ciclos.
- Cada jardim pode ter seu tempo, mas dentro de limites: foco entre 15 e 60 min. Abaixo de 15 vira atalho pra farmar planta.
- Durante o foco não existe botão de pausa. Só "desistir", que mata a planta.
- Pular a pausa é permitido, mas a próxima sessão só começa depois de pelo menos 1 min (evita emendar no automático).

**Crescimento**

- Cada jardim tem uma planta "em crescimento" por vez. Ela ganha pontos ao fim de cada sessão válida: 2 se o usuário diz que focou de verdade, 1 se foi "mais ou menos", 0 se não focou.
- 10 pontos = planta adulta. Ela fica no jardim pra sempre e a próxima sessão planta uma semente nova em outro lugar da ilha.
- Planta que morreu também fica, seca e cinza. O jardim mostra a história real, inclusive os dias ruins.
- Limite diário: no máximo 10 sessões por dia contam pra crescimento (somando todos os jardins). Passou disso, o tempo é registrado nas estatísticas mas não cresce nada.
- 3 dias sem nenhuma sessão num jardim: as folhas amarelam. Uma sessão volta tudo ao normal. Nada é apagado; a ideia é lembrar, não castigar.

## Sistema anti-trapaça

O navegador detecta distração e o servidor mede o tempo; como tudo no navegador pode ser manipulado, nenhuma recompensa é calculada lá.

O objetivo não é parar um hacker, é parar o impulso de se sabotar. Quem edita o JavaScript pra ganhar planta falsa só enganou a si mesmo, e sem ranking não há prêmio nenhum pra isso.

**Ciclo de uma sessão (texto do diagrama)**

```text
Começar (start_session) -> Foco 25 min -> [tempo acabou] -> Revisão ("focou de verdade?") -> Tempo ok? (servidor)
   sim -> Concluída (planta cresce)
   não -> Inválida (sem crescer, sem morrer)
Durante o foco: saiu da aba -> Aviso 10 s
   voltou em até 10 s -> volta pro Foco
   passou de 10 s ou 3 saídas -> Falhou (planta morre)
```

Sair da aba abre um aviso de 10 s; só a sessão que chega ao fim e passa na checagem de tempo do servidor faz a planta crescer.

**No navegador (detectar distração)**

- `visibilitychange` (Page Visibility API) e `blur` da janela: saiu da aba, começa um aviso de 10 s com a planta tremendo e murchando. Voltou a tempo, segue, mas conta uma "saída". Passou de 10 s, a sessão falha.
- 3 saídas numa mesma sessão = falha, mesmo que todas curtas.
- O tempo é medido com `performance.now()`, que não muda se o usuário mexer no relógio do PC. A cada segundo compara com `Date.now()`; se divergirem mais de 2 s, a sessão é marcada como inválida.
- Heartbeat: a cada 60 s o front chama `session_heartbeat` no servidor. Fechar a aba para de mandar, e a sessão expira sozinha.
- No `pagehide` (fechou a aba) tenta avisar o servidor com `navigator.sendBeacon`; se não chegar, o heartbeat resolve.
- Ponto em aberto: no celular, travar a tela também dispara `visibilitychange`, e o navegador não diferencia travar de trocar de app.

**No servidor (decidir se vale)**

- O horário de início é o `now()` do Postgres; o front nunca manda horário.
- Ao finalizar, o banco calcula a duração. Só vale se for pelo menos a duração planejada (tolerância de 5 s) e no máximo a planejada + 3 min.
- Sem heartbeat há mais de 3 min = sessão inválida. Sem heartbeat há mais de 5 min = abandonada, e a planta morre.
- Só uma sessão ativa por usuário (índice único no banco): abrir duas abas pra dobrar não funciona.
- Pontos de crescimento e limite diário são calculados no banco. O usuário não tem permissão de dar update direto em plantas nem em sessões (RLS).

**Honestidade como mecânica**

- Ao fim do foco: "Você focou de verdade?" com sim, mais ou menos e não.
- Responder "não" não cresce a planta, mas também não mata, e soma numa sequência de honestidade que vira um selo no jardim.
- Opcional: marcar o que distraiu (celular, cansaço, barulho, fome). Vira estatística útil: "você se distrai mais com o celular depois das 22h".

**O que o web não consegue**

- Bloquear outros apps ou sites. Isso fica pra v2, com extensão de navegador ou app mobile.

## Modelo de dados

Quatro tabelas bastam pro MVP; jardins o usuário edita livremente, plantas e sessões só mudam pelas funções do servidor.

| Tabela | Colunas principais | Quem escreve |
| --- | --- | --- |
| profiles | id (= auth.users.id), username, timezone, created\_at | Usuário (só a própria linha) |
| gardens | id, user\_id, name, color, biome, focus\_minutes, break\_minutes, created\_at, archived\_at | Usuário (CRUD dos próprios) |
| plants | id, garden\_id, user\_id, species, growth (0 a 10), status (growing, grown, dead), position\_x, position\_z, planted\_at | Só funções RPC |
| sessions | id, user\_id, garden\_id, plant\_id, planned\_minutes, started\_at, last\_heartbeat\_at, ended\_at, status (active, completed, failed, abandoned, invalid), fail\_reason, focus\_rating (sim, medio, nao), distraction\_tag, exits\_count | Só funções RPC |

Restrições que fazem o trabalho pesado:

```sql
-- só uma sessão ativa por usuário
create unique index one_active_session
  on sessions (user_id) where status = 'active';

-- limites do tempo de foco
alter table gardens add constraint focus_range
  check (focus_minutes between 15 and 60);

alter table sessions add constraint rating_values
  check (focus_rating in ('sim', 'medio', 'nao'));

-- RLS: leitura só do que é seu; plants e sessions sem policy de insert/update
alter table plants enable row level security;
create policy "ler minhas plantas" on plants
  for select using (user_id = auth.uid());
```

Estatísticas (minutos por jardim, sequência de dias, sequência de honestidade) saem de views em cima de sessions, sem tabela extra.

## Funções do servidor (RPC)

Quatro funções em Postgres controlam todo o ciclo: `start_session`, `session_heartbeat`, `finish_session` e `fail_session`. O front chama com `supabase.rpc('nome', { ... })`.

Todas são `security definer`: rodam com permissão do dono do banco, por isso conseguem escrever em plants e sessions mesmo com a RLS bloqueando o usuário. Por isso também toda query filtra por `auth.uid()`.

**start\_session**

```sql
create or replace function start_session(p_garden_id uuid)
returns sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_garden  gardens;
  v_plant   plants;
  v_session sessions;
begin
  select * into v_garden from gardens
   where id = p_garden_id and user_id = auth.uid() and archived_at is null;
  if not found then
    raise exception 'jardim não encontrado';
  end if;

  -- sessões esquecidas viram abandonadas e a planta morre
  with expiradas as (
    update sessions set status = 'abandoned', ended_at = now()
     where user_id = auth.uid() and status = 'active'
       and last_heartbeat_at < now() - interval '5 minutes'
    returning plant_id
  )
  update plants set status = 'dead'
   where id in (select plant_id from expiradas);

  -- planta em crescimento ou semente nova em posição aleatória
  select * into v_plant from plants
   where garden_id = v_garden.id and status = 'growing'
   limit 1;
  if not found then
    insert into plants (garden_id, user_id, species, growth, status, position_x, position_z)
    values (v_garden.id, auth.uid(), 'arvore', 0, 'growing',
            random() * 8 - 4, random() * 8 - 4)
    returning * into v_plant;
  end if;

  -- o índice único barra uma segunda sessão ativa
  insert into sessions (user_id, garden_id, plant_id, planned_minutes,
                        started_at, last_heartbeat_at, status)
  values (auth.uid(), v_garden.id, v_plant.id, v_garden.focus_minutes,
          now(), now(), 'active')
  returning * into v_session;

  return v_session;
end;
$$;
```

**session\_heartbeat e fail\_session**

```sql
create or replace function session_heartbeat(p_session_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update sessions set last_heartbeat_at = now()
   where id = p_session_id and user_id = auth.uid() and status = 'active';
$$;

create or replace function fail_session(p_session_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_plant uuid;
begin
  update sessions set status = 'failed', ended_at = now(), fail_reason = p_reason
   where id = p_session_id and user_id = auth.uid() and status = 'active'
  returning plant_id into v_plant;

  if v_plant is not null then
    update plants set status = 'dead' where id = v_plant;
  end if;
end;
$$;
```

**finish\_session**

```sql
create or replace function finish_session(
  p_session_id uuid,
  p_focus_rating text,
  p_exits int,
  p_distraction text default null
)
returns sessions
language plpgsql security definer set search_path = public
as $$
declare
  s          sessions;
  v_tz       text;
  v_planned  interval;
  v_elapsed  interval;
  v_today    int;
  v_points   int;
begin
  select * into s from sessions
   where id = p_session_id and user_id = auth.uid() and status = 'active'
   for update;
  if not found then
    raise exception 'sessão inválida';
  end if;

  v_planned := make_interval(mins => s.planned_minutes);
  v_elapsed := now() - s.started_at;

  -- terminou cedo demais, tarde demais ou ficou sem heartbeat
  if v_elapsed < v_planned - interval '5 seconds'
     or v_elapsed > v_planned + interval '3 minutes'
     or now() - s.last_heartbeat_at > interval '3 minutes' then
    update sessions set status = 'invalid', ended_at = now(), exits_count = p_exits
     where id = s.id returning * into s;
    return s;
  end if;

  -- limite diário no fuso do usuário
  select coalesce(timezone, 'America/Sao_Paulo') into v_tz
    from profiles where id = auth.uid();

  select count(*) into v_today from sessions
   where user_id = auth.uid() and status = 'completed'
     and (ended_at at time zone v_tz)::date = (now() at time zone v_tz)::date;

  update sessions
     set status = 'completed', ended_at = now(), focus_rating = p_focus_rating,
         exits_count = p_exits, distraction_tag = p_distraction
   where id = s.id returning * into s;

  v_points := case p_focus_rating when 'sim' then 2 when 'medio' then 1 else 0 end;

  if v_today < 10 and v_points > 0 then
    update plants
       set growth = least(growth + v_points, 10),
           status = case when growth + v_points >= 10 then 'grown' else status end
     where id = s.plant_id;
  end if;

  return s;
end;
$$;
```

Depois de criar, rode `revoke execute on function ... from anon;` em cada uma, pra só usuário logado conseguir chamar.

## Estrutura de pastas do front-end

Organize por funcionalidade (feature), não por tipo de arquivo: tudo do timer fica junto, tudo do jardim fica junto.

```text
src/
  app/                 # rotas, providers (Query, Supabase), layout
  features/
    auth/              # login, cadastro, sessão do Supabase
    gardens/           # listar, criar, editar e arquivar jardins
    focus/
      timerMachine.ts      # estados: idle, focus, review, break
      useFocusSession.ts   # chama as RPCs, controla o ciclo
      useDistractionGuard.ts # visibilitychange, blur, relógio
      useHeartbeat.ts      # chama session_heartbeat a cada 60 s
      FocusScreen.tsx
      ReviewScreen.tsx     # "você focou de verdade?"
    stats/             # gráficos e sequências
  three/
    GardenScene.tsx    # Canvas, luz, câmera
    Island.tsx
    Plant.tsx          # desenha a planta pelo growth/status
    Grass.tsx          # grama instanciada
  components/          # botões, cards, modais reutilizáveis
  lib/
    supabase.ts        # client
    api.ts             # funções tipadas que chamam as RPCs
  stores/
    focusStore.ts      # zustand: sessão atual, tempo, saídas
supabase/
  migrations/          # SQL versionado (tabelas, RLS, funções)
```

Dica de aprendizado: escreva `timerMachine.ts` como uma função pura (estado atual + evento = próximo estado), sem React. Assim dá pra testar no Vitest sem abrir o navegador, e o bug de timer fica fácil de achar. Comece com `useReducer`; se crescer muito, vale olhar XState.

## Cena 3D: low poly detalhado

Mesma ilha clara e aconchegante do plano, mas com o nível de detalhe do projeto do buquê: plantas com muitas facetas e as arestas dos triângulos desenhadas por cima.

**Direção visual**

- Ilha flutuante clara, céu azul suave e cores vivas: verdes, marrom de terra, flores rosa, amarelas e lilás.
- Toda malha com facetas visíveis (`flatShading`) e um contorno fino nas arestas, num tom mais claro da própria cor. Esse contorno é o que dá o acabamento de cristal ou papercraft do buquê.
- Plantas modeladas de verdade: flores com pétalas, folhas facetadas e miolo dourado, em vez de só cone e esfera.
- Pétalas triangulares caem quando a planta fica adulta; folhinhas e pólen flutuam leves no ar.
- Planta morta: mesma forma, dessaturada, levemente tombada e com contorno acinzentado.

**Contorno das arestas**

- Jeito certo: shader com coordenadas baricêntricas. Cada vértice do triângulo recebe (1,0,0), (0,1,0) ou (0,0,1); no fragment shader, o que fica perto da borda ganha a cor do contorno. É uma passada só, sem duplicar geometria. Exige geometria não indexada (`geometry.toNonIndexed()`).
- Pra manter luz e sombra, injete o contorno num `MeshStandardMaterial` com `onBeforeCompile`, ou use `shaderMaterial` do drei.
- Jeito simples pra começar: `EdgesGeometry` + `lineSegments`. Serve pra poucas plantas; troque pelo shader quando o jardim crescer.

**Montando a ilha**

- Ilha: `cylinderGeometry` com 7 a 9 lados e alguns segmentos na altura, pra ter facetas no topo e na terra embaixo, com o mesmo contorno das plantas.
- `<Float>` do drei faz a ilha flutuar devagar.
- Luz: `ambientLight` fraca + `directionalLight` com sombra; `<ContactShadows>` pra sombra suave.
- Câmera: `<OrbitControls>` com zoom e rotação limitados.
- Cor da ilha e das flores puxa pela cor do jardim, assim cada área da vida tem identidade.

**Planta pelo crescimento**

| growth | Aparência |
| --- | --- |
| 0 | Semente facetada meio enterrada |
| 1 a 3 | Broto com 2 folhas |
| 4 a 6 | Muda: caule, 4 a 6 folhas e botão fechado |
| 7 a 9 | Planta jovem: botão abrindo, primeiras pétalas |
| 10 | Adulta: flores abertas, miolo dourado, pétalas caindo ao completar |
| status dead | Mesma forma, cinza e tombada |

- Modelagem: no Blender, mirando algo entre 200 e 800 triângulos por planta, exportando .glb e carregando com `useGLTF`. Ou gerar as flores por código, reaproveitando o que você fez no projeto do buquê.
- Cada espécie com uma malha por estágio. A troca de estágio anima com escala (lerp no `useFrame`) e um leve brilho no contorno.
- Murchar durante a distração: a planta lê do `focusStore` quantos segundos o usuário está fora, treme e perde saturação aos poucos.

**Desempenho (mais importante com esse nível de detalhe)**

- Plantas da mesma espécie e estágio com `InstancedMesh`.
- LOD com `<Detailed>` do drei: perto da câmera a versão completa, longe uma versão com bem menos triângulos.
- Só a planta em crescimento usa o detalhe máximo o tempo todo; as outras podem ser mais simples.
- Limite de plantas por ilha (algo como 40 a 60); passou disso, a ilha cresce ou a planta mais antiga vira parte do cenário.
- `frameloop="demand"` quando nada anima e `dpr={[1, 2]}`.
- Testar num PC fraco e num celular intermediário desde a Fase 3, não só no final.

## Animações com Motion

Motion (o novo nome do Framer Motion, `npm i motion`, import de `motion/react`) cuida só da interface 2D; o que se mexe dentro da cena 3D fica com o R3F.

- Troca de telas: `<AnimatePresence>` envolvendo as rotas, com fade e leve deslize.
- Anel do timer: um `<motion.circle>` com `pathLength` indo de 1 a 0 conforme o tempo passa.
- Aviso de saída da aba: barra vermelha que entra pelo topo e esvazia em 10 s.
- Tela de revisão: os três botões (sim, mais ou menos, não) entram em sequência com `staggerChildren`.
- Cards de jardim: `whileHover` com leve elevação e `layout` pra reorganizar a grade quando um jardim é criado ou arquivado.
- Acessibilidade: `useReducedMotion()` desliga movimentos grandes pra quem ativou "reduzir movimento" no sistema.

## Ranking, ligas e compartilhamento

O ranking é entre amigos e em ligas semanais, pontua constância e só conta sessão validada pelo servidor. Entra depois do MVP, porque dá a outras pessoas um motivo real pra trapacear.

**Pontuação**

| Ação | Pontos |
| --- | --- |
| Sessão concluída e válida no modo estrito | 10 |
| Primeira sessão do dia (mantém a sequência) | +5 |
| Completar 7 dias seguidos | +20 |
| Teto diário de sessões | 100 pontos (10 sessões) |

- A resposta "focou de verdade?" não vale ponto no ranking, senão todo mundo responde "sim". Ela continua valendo só pro crescimento do jardim.
- Sessão no modo livre (pode sair da aba) cresce o jardim mas não pontua.
- Participar é opcional: quem desliga usa o app só com o próprio jardim.

**Ligas semanais**

- Grupos de até 30 usuários de ritmo parecido, nas ligas Semente, Broto, Muda, Árvore e Floresta.
- Fecha toda segunda às 00:00 (horário de Brasília): os 5 primeiros sobem, os 5 últimos descem, pontos zeram.

**Grupos de amigos**

- Criados por link de convite (código único). Ranking semanal só entre os membros.
- Meta coletiva da semana (ex.: 40 h somadas). Bateu, todo mundo ganha uma planta rara.
- Salas de estudo juntos: até 5 pessoas numa sessão; se uma sai da aba, a árvore do grupo murcha pra todos.

**Anti-trapaça reforçado**

- Heartbeat recebido com menos de 30 s do anterior é ignorado (limite de requisições).
- Job diário marca a conta como suspeita se ela bate o teto de sessões quase todo dia ou manda heartbeats regulares demais. Conta marcada sai da liga até revisão, mas o jardim continua normal.
- Botão de denúncia dentro dos grupos.

**Recompensas**

- Biomas, skins de planta e decorações na ilha, liberados por conquista, nunca comprados no início.
- Selos no perfil: "30 dias seguidos", "honestidade de ferro", "subiu pra Floresta".

**Compartilhamento**

- Card pro story: posição na liga, horas da semana e um print do jardim. Gerado no navegador a partir do canvas 3D (`preserveDrawingBuffer` ligado no R3F) e enviado com `navigator.share`.
- Timelapse de 10 s do jardim crescendo: o front reproduz o histórico de sessões na cena e grava com `canvas.captureStream()` + `MediaRecorder`.
- Jardim público em `/g/:username`, só se o usuário ativar.
- Convite pro grupo por link: "me ultrapassa se for capaz".

**Banco de dados (novas tabelas)**

| Tabela | Colunas principais | Quem escreve |
| --- | --- | --- |
| groups | id, name, owner\_id, invite\_code, weekly\_goal\_minutes, created\_at | Usuário (dono) |
| group\_members | group\_id, user\_id, role, joined\_at | RPC join\_group |
| leagues | id, tier, week\_start | Job semanal |
| league\_members | league\_id, user\_id, points, final\_rank | Só funções |
| score\_events | id, user\_id, session\_id, points, reason, created\_at | Só finish\_session |
| achievements | id, code, name, description | Admin |
| user\_achievements | user\_id, achievement\_id, earned\_at | Só funções |
| reports | id, reporter\_id, reported\_id, group\_id, reason, status | Usuário |

- Em profiles: `ranked_opt_in`, `flagged`, `public_garden`. Em sessions: `mode` (estrito ou livre).
- O `finish_session` passa a inserir um score\_event quando a sessão é válida, estrita, o usuário participa do ranking e não está marcado.
- Ranking = view somando score\_events da semana por usuário. O fechamento das ligas e o job de suspeitos rodam com a extensão pg\_cron do Postgres.

## Roadmap

Comece sem 3D e sem servidor: se o timer e o anti-trapaça não funcionarem bem sozinhos, jardim bonito nenhum salva o app.

1. **Fase 1 · Timer e regras, sem servidor** — Entrega: máquina de estados do pomodoro, guarda de distração (aba e relógio), tela de revisão. Pronto quando: ficar 10 s fora da aba falha a sessão e mexer no relógio invalida.
2. **Fase 2 · Conta e servidor (Supabase)** — Entrega: login, tabelas, RLS e as RPCs start, heartbeat, finish e fail. Pronto quando: o tempo da sessão é medido só pelo banco e update direto em plants é bloqueado.
3. **Fase 3 · Jardim 3D low poly detalhado** — Entrega: ilha e plantas facetadas com contorno nas arestas, estágios de crescimento, planta murchando. Pronto quando: cada sessão concluída aparece crescendo na cena do jardim certo.
4. **Fase 4 · Polimento e deploy** — Entrega: animações com Motion, estatísticas, sequência de honestidade, deploy na Vercel. Pronto quando: um amigo usa por uma semana sem precisar te perguntar nada.
5. **v2 · Depois do MVP** — Ranking e ligas, salas de estudo juntos, extensão que bloqueia sites, PWA, app mobile. Entra só depois de usar o MVP por algumas semanas.

Cada fase termina num critério testável; só passe pra próxima quando ele for verdade.

## Ajustes feitos na implementação

O que mudou em relação ao texto acima, e por quê. As migrations em `supabase/migrations/` são a fonte da verdade do SQL.

**Segurança**

- `revoke execute ... from anon` não basta: o Postgres dá EXECUTE pra `PUBLIC` em toda função nova. As RPCs fazem `revoke ... from public, anon` e `grant ... to authenticated`.
- Além da RLS, `plants` e `sessions` perderam o privilégio de escrita: tentar dar update vira erro explícito ("permission denied") em vez de "0 linhas".
- As views de estatística usam `security_invoker = true`. Sem isso, uma view ignora a RLS e qualquer usuário leria as sessões de todos.
- Jardim não pode ser apagado, só arquivado: apagar levaria junto as plantas mortas e as sessões, e "o jardim mostra a história real".
- O `profile` é criado por um trigger em `auth.users` no cadastro, e o fuso horário é validado (um fuso inválido quebraria a conta de "hoje").

**Ciclo da sessão (RPCs)**

- `finish_session(p_session_id, p_exits)` é chamada sozinha quando o tempo acaba e só confere o tempo. A resposta "focou de verdade?" vai em `rate_session(p_session_id, p_focus_rating, p_distraction)`, que calcula o crescimento. Motivo: com a nota dentro do `finish_session`, quem não visse o timer acabar (estudando num livro) teria só ~3 min pra responder e perderia uma sessão honesta.
- `invalidate_session(p_session_id)`: relógio mexido invalida sem matar a planta. O `fail_session` mataria.
- `expire_stale_sessions()`: sessão sem heartbeat há mais de **90 s** vira abandonada e a planta morre. Antes eram 5 min, só no `start_session`, e isso deixava o usuário bloqueado esse tempo todo depois de fechar a aba. O app chama ao abrir, pro jardim mostrar a verdade.
- `session_heartbeat` devolve `true/false`: o front descobre se a sessão foi encerrada em outro lugar.
- O aviso de "fechou a aba" usa `fetch` com `keepalive`, não `sendBeacon`, que não manda os headers `apikey` e `Authorization` que o Supabase exige.
- Posição da planta nova: espiral de girassol (ângulo de ouro) em vez de `random() * 8 - 4`. As plantas não se sobrepõem e a ilha cresce com elas. Espécies: margarida, tulipa e rosa.
- Erros com código próprio (`SP001`… `SP005`), pra tela saber o que aconteceu.

**Front**

- O 1 min mínimo depois de pular a pausa fica no `timerMachine` (é regra de hábito, não de validade).
- Durante o foco: confirmação ao fechar/recarregar a aba (`beforeunload`), bloqueio de navegação dentro do app (`useBlocker`) e Wake Lock pra tela do celular não apagar sozinha (atenua o "ponto em aberto" do celular).
- Sininho no fim do foco e da pausa (Web Audio), pra quem não está olhando a tela.
- Login e cadastro em rotas próprias (`/entrar`, `/criar-conta`) debaixo de um `AuthLayout` com uma cena 3D tela cheia: uma ilha pequena com uma muda que reage ao form (folhas brotam com os campos, murcham no erro, floresce no sucesso). O form só relata o estado; quem decide se o login vale continua sendo o Supabase.

**Interpretações**

- "Sequência de honestidade" = quantas vezes a pessoa respondeu "não". Vira selo: 1 (Primeira sinceridade), 5 (Selo de honestidade), 15 (Honestidade de ferro), mostrado no painel e como um marco na ilha.
- "3 dias sem sessão" = 72 h sem sessão concluída (ou desde a criação do jardim).
- Biomas no MVP: campo, cerrado e neve.

**Decidido: sair da aba não conta mais (substitui as regras de aba acima)**

- O modo estrito deixava inviável focar em tarefas *no computador* (VS Code, PDF, aula em outra aba): abrir outro app mostrava o aviso de 10 s e matava a planta. Decisão: existe só o "modo livre", com o crescimento de sempre (sim +2, mais ou menos +1, não 0).
- Saíram: o aviso de 10 s, o limite de 3 saídas, a planta murchando e os motivos `away_too_long`/`too_many_exits` no front (o banco ainda aceita, por causa das sessões antigas). O critério da Fase 1 "ficar 10 s fora da aba falha a sessão" deixa de valer; os outros continuam.
- O que segura a sessão agora: o tempo medido pelo `now()` do banco, a detecção de relógio mexido, o heartbeat (fechar a aba mata a planta), uma sessão por vez, o limite diário e a pergunta honesta no fim.
- O relógio do foco e o heartbeat rodam num Web Worker (`src/lib/backgroundClock.ts`): com a aba em segundo plano, o Chrome segura os timers comuns em até 1x por minuto, e o heartbeat chegaria perto do limite de 90 s do servidor. O heartbeat passou de 60 s pra 30 s.
- No fim do foco e da pausa, além do sininho, uma notificação do sistema (permissão pedida no clique de "Começar foco").
- `finish_session` continua recebendo `p_exits` (o front manda 0), pra não mudar a assinatura no banco.

**Visual: "Caderno de botânico" (substitui as seções de visual e cena acima)**

- Só tema claro, de papel: Newsreader (texto e títulos) e IBM Plex Mono (números e etiquetas). Saíram o modo escuro, o botão de tema e o vidro.
- Cada jardim é uma "prancha" numerada; a página do jardim é uma página dupla (a ilha emoldurada à esquerda, a ficha à direita). A página principal tem o registro do dia (foco de hoje, sequência e a semana em carimbos), a prancha do último jardim aberto com "Focar agora" e o índice.
- Foco, revisão, pausa e fim viram fichas; árvore adulta ganha o carimbo "ADULTA", e sessão perdida ou inválida, "PERDIDA"/"INVALIDADA".
- Estatísticas = "Diário de campo"; conta = "Ficha do pesquisador". A cor das barras (`--chart-bar`) foi validada pelo método da skill de dataviz.
- O login ficou com o desenho próprio dele (cena 3D com a muda que reage ao form, texto em sans).

**Plantas e cena**

- Flores viraram árvores: pinheiro, macieira e cerejeira (migration `20261102120000_arvores.sql` converte as antigas). A cor do jardim aparece nas frutas, flores e bolinhas da adulta.
- No lugar do "contorno escuro nas arestas": copas feitas de dezenas de folhas curvas (distribuídas pelo ângulo de ouro), um fio de luz nas arestas, brilho de contorno (fresnel) e vento no shader. Luz de ilustração: sol quente, sombra azulada e contraluz.
- Ilha com contorno orgânico de 22 lados (em vez de 9), lábio de grama, estratos de terra com degraus, e a base se dissolvendo na cor do papel.

**Amigos (parte da v2, antecipada)**

- Amizade por pedido (nome de usuário, o outro aceita) ou por link de convite (`/amigo/<código>`, aceita na hora). Migration `20261103120000_amigos.sql`.
- Ranking só entre amigos, por minutos de foco na semana (segunda 00:00, Brasília), só sessão concluída pelo servidor e até 10 por dia. Sem ligas públicas: sem a vigia de aba, ranking contra desconhecidos daria motivo pra trapacear.
- Interações sem chat: visitar a ilha do amigo, regar (1 por amigo por dia) e mandar corações (1 a 999 por envio). Quem recebe vê o regador e os corações na ilha ao abrir o Sprout. É enfeite: nada disso mexe em planta ou sessão.
- Amigos não leem as tabelas um do outro: tudo passa por funções que conferem a amizade (`friend_ranking`, `friend_gardens`, `friend_plants`, `send_gift`...). Erros novos: `SP006` (não encontrado), `SP007` (não são amigos), `SP008` (já regou hoje).

**Surpresa**

- `src/features/surprise/surprise.ts`: a árvore velha (com neve em cima no bioma neve) aparece nos jardins de duas contas, pelo id do dono do jardim (o id não muda, o nome de usuário pode mudar): nos jardins de qualquer uma das duas, pra quem estiver olhando. Nada no banco e nada que mexa em regra.
- Antes era um link `?ref=` que marcava o navegador; isso vazava pra outra conta no mesmo navegador. O link antigo agora só é limpo da barra.
- Cervinho (2026-11-15): nos mesmos jardins da árvore velha, menos no cerrado, toda vez que o jardim abre um filhote chega pulando, para ao lado da árvore, olha pra câmera e corre pra trás do tronco, onde some. A câmera abre de perto no palco dele e se afasta depois. Não aparece durante o foco nem com "reduzir movimento". Arquivos: `src/three/Fawn.tsx` (boneco e cena), `fawnGeometry.ts` (as partes, facetadas), `fawnMotion.ts` (poses, linha do tempo e caminhos, em funções puras com testes) e `oldTreeSpot.ts` (lugar da árvore, usado pelos dois).
- O sumiço funciona de qualquer ângulo porque não depende de esconder o bicho inteiro: um plano de corte passa pela câmera e pelo meio do tronco, e o que cruza pro outro lado não é desenhado. A borda do corte fica sempre atrás do tronco.

**Página principal em blocos e mais interações (2026-11-03)**

- A principal virou blocos (bento): o grande tem a ilha do jardim escolhido, a escolha do jardim e o "Começar foco", que já começa a sessão em um clique (`useStartFocus` navega com `state.autostart`; a tela de foco começa sozinha se nada impedir). Ao lado: hoje, sequência, amigos (mural) e jardins.
- Menos texto: três níveis (título da página, título de seção, texto); a etiqueta em mono só rotula dados; sem as frases explicativas e sem o protocolo antes do foco.
- Corações: tocar manda 1, segurar acelera (cada passada manda mais, até 64 por vez); vão pro servidor em lotes de até 999 e sobem ao vivo na ilha do amigo.
- Novas interações (migration `20261105120000_interacoes.sql`): plantar uma flor na ilha de um amigo (1 por semana, fica lá com o nome de quem plantou), aplaudir conquistas no mural (árvore adulta e marcos de dias seguidos; uma vez por conquista; quem recebe vê fogos) e chamar pra focar (1 por dia; se o amigo concluir um foco nas 6 h seguintes, quem chamou fica sabendo). Erro novo: `SP009`.
- Nome de usuário aceita ponto (migration `20261104120000_nome_com_ponto.sql`).

**Layout orgânico, sem grade (2026-11-03, substitui o bento acima)**

- Sai a grade de blocos e qualquer caixa com borda. As cores, as fontes e o papel continuam; muda a forma: botões e chips em cápsula, destaques sobre um halo difuso ou numa "pedrinha" (canto irregular que muda devagar), separadores em onda, listas sem fio entre os itens.
- Peças novas em `src/components/organic/`: `Orbit` (itens num arco), `Wave` (onda que se desenha), `Blob` (mancha atrás da ilha que muda e escorrega na direção do mouse), `Pebble` (número numa pedrinha), `Drift` (lista com recuos alternados), `Magnetic` (o botão principal puxa pro ponteiro) e `InkUnderline` (traço curvo da navegação). As contas das curvas ficam em `curve.ts`.
- Início: a ilha no centro, hoje e sequência em pedrinhas encostadas nela, os jardins num arco e o "Começar foco" logo abaixo; depois de uma onda, seus jardins e o mural. No celular o botão fica na página (visível sem rolar) e só gruda no rodapé quando sai da tela.
- Jardim: a ilha à esquerda sangrando pra fora da coluna; o painel recua seguindo a curva dela (no lugar do `shape-outside`, que exigiria float), números num cacho de pedrinhas. Foco: o tempo dentro de um anel; as respostas da revisão em cápsulas num arco. Na tela de foco nada se mexe sozinho.
- Amigos: ranking como lista curva com avatar e um traço do tamanho dos minutos; os amigos viram um cacho de avatares (pedrinha colorida pela inicial) com minutos da semana e "Visitar jardim". Visita: a ilha no centro e o coração embaixo, com regar, chamar e plantar num arco em volta.
- Navegação: no celular desce pro rodapé numa cápsula com ícones. A troca de página abre num círculo a partir do clique (o recorte some no fim, pra não cortar o que é fixo).
- Movimento expressivo (molas, pop no clique, pedrinhas boiando). Com "reduzir movimento" no sistema fica só fade.

**Neve, folhas e sombra (2026-11-03)**

- Bioma neve: chão branco frio, montinhos de neve, pedras com neve, capim seco, flores de neve (edelvais, campainha-branca e açafrão na cor do jardim), neve caindo e uma luz mais branca (com a luz quente o branco virava bege).
- Espécies de neve só na aparência: o banco continua guardando pinheiro, macieira ou cerejeira; num jardim de neve elas aparecem (e são chamadas) como abeto, bétula e sorveira, com neve nas copas. Nenhuma migration: crescimento, histórico e ranking não mudam, e trocar o bioma troca a aparência de todas as árvores. O texto do aplauso que o servidor escreve ("sua macieira adulta") continua com o nome do banco.
- Folhas: em vez de triângulos dando voltas no ar, folhas que soltam da altura das copas, caem balançando como pêndulo, pousam no chão, ficam um pouco e somem; fazem sombra.
- Sombra: o sol subiu (sombras curtas, debaixo de cada árvore, em vez de compridas cruzando a ilha) e a borda ficou macia (PCF com raio).

**Sessão no celular (2026-11-03, migration `20261106120000_sessao_celular.sql`)**

- No iPhone, com o Safari no fundo, a página congela: o relógio monotônico do navegador para e o heartbeat também. Antes isso virava "relógio mexido" (sessão inválida), "sem heartbeat" (inválida) ou planta morta (90 s sem heartbeat).
- Front: o TICK diz se a página ficou escondida desde o anterior; nesse caso o relógio do sistema vale (só não pode ter voltado) e o timer se acerta por ele. Com a página visível o tempo todo, divergência continua sendo relógio mexido (o critério da Fase 1 segue valendo).
- Servidor: concluir vale até 2 h depois do tempo planejado e heartbeat parado no meio não invalida mais; a sessão só vira abandonada (planta morre) sem heartbeat e depois do planejado + 2 h. O tempo continua medido pelo banco.
- Se o iPhone recarregar a aba, a tela de foco retoma sozinha a sessão do servidor (quando o heartbeat dela parou), com o tempo que já passou. Se outra aba ainda está viva, oferece "Continuar aqui".
- Fechar a aba de propósito continua matando a planta (aviso com keepalive no `pagehide`; ida pro cache de voltar não conta).
- Notificação no iPhone fica pra depois: o Safari não notifica site comum e a página congelada não dispara aviso na hora; precisaria de push pelo servidor.

## Backlog e progresso

Esta seção é a memória do projeto: o que já foi feito, o que está em andamento e o que falta.
Quem trabalha aqui atualiza esta lista **a cada etapa concluída**, não no fim da tarefa (regra
no `CLAUDE.md`). Marcadores: `[ ]` a fazer, `[~]` em andamento, `[x]` feito, com a data.

### Estado geral (2026-11-16)

Fases 1 a 4 do roadmap estão fechadas, e boa parte da v2 foi antecipada: amigos, ranking da
semana, visita ao jardim, regar, corações, flores plantadas por amigos, aplausos no mural e
chamar pra focar. Biomas campo, cerrado e neve. Surpresas (árvore velha, cervinho).

### Do plano original, ainda não feito

- [ ] Conquistas: tabelas `achievements` / `user_achievements` e a folha de selos no caderno.
- [ ] Card pro story: print do canvas 3D (`preserveDrawingBuffer`) numa prancha de papel + `navigator.share`.
- [ ] Timelapse do jardim (`canvas.captureStream()` + `MediaRecorder`).
- [ ] Jardim público em `/g/:username`, opt-in.
- [ ] Salas de estudo juntos (até 5 pessoas numa sessão).
- [ ] Grupos e ligas semanais (decidido: sem ranking público com desconhecidos).
- [ ] PWA: manifest, service worker, instalar no celular, notificação por service worker no Android.
- [ ] Extensão de navegador que bloqueia sites.

### Melhorias propostas em 2026-11-16

Levantamento feito lendo o código inteiro. A numeração é a da conversa que originou a lista.

**Estética**

- [ ] 1. Grão de papel por cima da cena 3D (ruído em `mix-blend-mode: multiply` sobre o `<Canvas>`): hoje a ilha parece colada na folha, não impressa nela.
- [x] 2. Luz pela hora do dia (2026-11-16). Detalhes abaixo, em "Feito".
- [x] 3. Chuva no dia da perda (2026-11-16). Detalhes abaixo, em "Feito".
- [x] 4. Estação do ano (2026-11-16). Detalhes abaixo, em "Feito".
- [x] 5. Avatar botânico (2026-11-16). Detalhes abaixo, em "Feito".
- [x] 6. Som ambiente no foco (2026-11-16). Detalhes abaixo, em "Feito".

**Interação e features**

- [ ] 7. Intenção da sessão: "o que você vai fazer?" antes do foco; aparece no diário e na ficha da árvore.
- [ ] 8. Prancha da árvore adulta (ficha de herbário) e uma página "Herbário" com todas.
- [ ] 9. Selos / conquistas, apurados por view no banco (nada calculado no front).
- [ ] 10. "Quem está focando agora": RPC `friends_focusing()`, avatar aceso na home, marca de "focaram juntos". Sem chat e sem pontos.
- [ ] 11. Carimbos fechados no mural, no lugar de chat livre.
- [ ] 12. Escolher onde plantar a próxima semente (o servidor valida a posição).
- [ ] 13. Rebobinar o jardim: ver a ilha em qualquer data passada, reconstruída das sessões.
- [ ] 14. Timer flutuante com Document Picture-in-Picture.
- [ ] 15. Guia de respiração na pausa.

**Decidido não fazer**

- Modo escuro: briga com o tema de papel.
- Qualquer coisa que faça planta crescer sem foco (presente virar árvore, regar a própria ilha).
- Movimento na tela de foco.
- Ranking público com desconhecidos.

### Estética 2 a 6: concluída (2026-11-16)

Etapas, na ordem:

1. [x] Luz pela hora do dia (item 2) — 2026-11-16.
2. [x] Chuva no dia da perda (item 3) — 2026-11-16.
3. [x] Estação do ano (item 4) — 2026-11-16.
4. [x] Avatar botânico (item 5) — 2026-11-16.
5. [x] Som ambiente no foco (item 6) — 2026-11-16.

### Feito

**Luz pela hora do dia (item 2, 2026-11-16)**

- A luz do jardim segue o relógio de quem está olhando: de madrugada é luar azulado, às 5 h a
  primeira luz rasante e rosada, de manhã sol baixo e quente, ao meio-dia alto e claro (a luz
  que existia antes), às 18 h dourado com sombra comprida, às 19:30 crepúsculo arroxeado.
- `src/three/daylight.ts` (novo): função pura `daylightAt(hora, bioma)` com os momentos do dia
  em `KEYS` e interpolação entre eles. Devolve direção e altura do sol, cores (sol, céu, chão,
  contraluz), intensidades e `night` (0 de dia, 1 na noite fechada). Também `hourOf(date)`,
  `shadowReach(elevação, raio)` e `mixHex`. Testes em `daylight.test.ts` (15 casos): o sol nunca
  vem de dentro da ilha, a volta da meia-noite não pula, hora fora de 0–24 dá a volta, a noite
  nunca escurece a ponto de sumir com a ilha, a neve é mais fria que o campo.
- **Não é modo escuro**: o papel continua claro e a luz do céu nunca desce de 0.78, então a ilha
  continua legível de madrugada. É a cor e a altura do sol que mudam, não o tema.
- `SceneLights.tsx`: passou a receber `light` (a luz daquela hora). Sem ela, usa meio-dia — por
  isso o login e o viveiro continuam exatamente como eram. A caixa da sombra cresce quando o sol
  baixa (`shadowReach`), senão a sombra comprida sairia da caixa e não seria desenhada.
- `facetMaterial.ts`: o brilho de contorno (fresnel) era sempre quente (`#fff0cc`). Agora guarda
  a força com que foi criado (`userData.rimStrength`) e `setRimTint` troca só a cor; à noite ele
  vira luar (`#cfdcff`). Sem isso a cena noturna parecia só "escura", não noturna.
- `useSceneMaterials(yellow, motion, depth, night)`: ganhou o `night` e retinge os 4 materiais.
- `Particles.tsx`: `Fireflies`, vaga-lumes que só aparecem de noite. Vagam devagar em volta de um
  ponto e piscam pela escala (zero = sumiu), pra caber num `instancedMesh` só. Não aparecem no
  bioma neve nem com "reduzir movimento".
- `GardenScene.tsx`: lê a hora com `useNow` de 5 em 5 min (a mudança é lenta), calcula a luz e
  passa pra luz, pros materiais e pros vaga-lumes.
- Em desenvolvimento, `?hora=20` em qualquer jardim força a hora da luz, pra ver amanhecer, pôr
  do sol e noite sem esperar o dia passar. Em produção é sempre o relógio de verdade.
- Durante o trabalho apareceu um `-` solto no fim de
  `supabase/migrations/20261022120100_seguranca.sql`, que quebrava os 4 testes do banco
  ("syntax error at or near -"). Removido; `npm test` volta a passar inteiro (164 testes).

**Chuva no dia da perda (item 3, 2026-11-16)**

- No jardim em que uma árvore morreu hoje (desistiu, ou a sessão foi abandonada), chove na ilha
  até virar o dia no fuso da pessoa. É o mesmo princípio das folhas amarelas: o jardim mostra a
  história real, inclusive os dias ruins — sem apagar nada e sem castigar.
- Migration `20261116120000_chuva.sql`: a view `garden_stats` ganhou `last_failed_at`
  (`max(ended_at) filter (where status in ('failed','abandoned'))`), do mesmo jeito que já tinha
  `last_completed_at`. `create or replace view` só deixa acrescentar coluna no fim, e foi o que
  se fez; o `security_invoker = true` continua. Teste novo em `supabase/tests/estatisticas.test.ts`.
- `src/lib/database.types.ts`: `last_failed_at` no Row de `garden_stats`.
- `insights.ts`: `isRaining(lastFailedAt, fuso, agora)` — função pura, compara o dia da perda com
  o dia de hoje **no fuso da pessoa** (meia-noite em São Paulo não é meia-noite em UTC).
  4 testes novos em `insights.test.ts`.
- `daylight.ts`: `overcast(light, amount)` fecha o céu — sol cinza e fraco (45%), contraluz
  menos quente. A luz do céu (`hemisphere`) não muda: chuva não é noite, a ilha continua legível.
- `Particles.tsx`: `Rainfall`, fios d'água caindo depressa e tortos pro lado do mesmo vento das
  folhas; quem passa do chão volta lá pra cima. Um `instancedMesh` só, 120 fios.
- Na chuva, as folhas que caem dão lugar à chuva e os vaga-lumes não aparecem. No bioma neve já
  está nevando, então lá a perda aparece só no céu fechado.
- Passa pela cena como `raining`: `GardenLayout` e `GardensScreen` calculam (view + fuso do
  perfil), `FocusLauncher` e `GardenStage` repassam. O resumo pro leitor de tela também avisa.

**Estação do ano (item 4, 2026-11-16)**

- A cena muda com a estação: primavera com pétalas rosa e verde novo, verão com verde fechado e
  luz quente, outono com a copa alaranjada e muitas folhas caindo, inverno pálido e azulado com
  quase nada no ar.
- Hemisfério **sul** (o app é brasileiro): dezembro é verão, junho é inverno. As datas são as
  convencionais dos solstícios e equinócios. Quem usar de outro hemisfério vê a estação trocada —
  se um dia isso importar, o caminho é escolher a estação no jardim (coluna nova em `gardens`).
- `src/three/season.ts` (novo): `seasonOf(date)` e `seasonLook(season)`, com a cara de cada
  estação (tingimento da copa e da grama, cores e quantidade das folhas que caem, e o empurrão
  na luz). Função pura, 8 testes em `season.test.ts`.
- A copa é tingida **no shader**, não reconstruindo a árvore: `facetMaterial.ts` ganhou
  `uSeason` (cor) e `uSeasonMix` (quanto entra), aplicados só nas partes com folha (`vLeafy`,
  o mesmo atributo que o amarelado do jardim esquecido usa). Multiplica a cor em vez de
  substituir, então o claro-escuro de cada folha continua lá e a copa não vira um borrão.
  Vale pra todas as espécies de uma vez e não custa geometria nova — a árvore seca fica de fora,
  ela já saiu do ciclo.
- `daylight.ts`: `seasonalLight(light, warmth)` dá um empurrão de cor na luz (outono esquenta,
  inverno esfria), sem mexer na força dela. A ordem é hora → estação → chuva.
- `Particles.tsx`: `FallingLeaves` agora recebe `count` (outono 16, inverno 4).
- `useSceneMaterials` passou a receber um objeto (`{ yellow, motion, depth, night, season }`) em
  vez de 5 argumentos soltos, que já estava ilegível.
- No bioma neve é sempre inverno: aquela ilha é de neve o ano inteiro.
- Em desenvolvimento, `?estacao=outono` (primavera, verao, outono, inverno) força a estação.
  Dá pra juntar com `?hora=`, ex.: `/jardim/<id>?estacao=outono&hora=17`.

**Avatar botânico (item 5, 2026-11-16)**

- No lugar da pedrinha com a inicial, cada amigo vira um raminho desenhado a traço: haste
  curva, 2 a 5 folhas alternadas e, na ponta, um botão, um fruto ou um cachinho. Sempre o mesmo
  desenho pra mesma pessoa.
- A semente é o **id**, não o nome de usuário: o id não muda, o nome pode mudar, e seria estranho
  o raminho de alguém virar outro porque a pessoa se renomeou. Sem id, cai no nome.
- `src/features/friends/sprig.ts` (novo): `sprigOf(seed)` devolve os caminhos SVG (haste, folhas,
  ponta) e as cores. A folha é uma gota feita de duas curvas quadráticas; o ponto e a direção de
  encaixe saem da curva da haste (ponto e derivada da cúbica). 8 testes em `sprig.test.ts`,
  inclusive "a mesma pessoa tem sempre o mesmo raminho" e "o desenho cabe na caixa".
- A pedrinha ficou com um véu da cor da pessoa (`color-mix` com o papel), no lugar da cor cheia:
  dá pra diferenciar de longe sem brigar com o traço.
- Atenção de CSS: o preenchimento das folhas e da ponta vai no atributo `fill` de cada caminho
  (a cor é por pessoa), então o CSS **não** declara `fill` nessas classes — regra de CSS ganha de
  atributo de apresentação e apagaria a cor.
- Os três lugares que mostram avatar (`FriendsScreen`) passam `seed={...user_id}`.

**Som ambiente no foco (item 6, 2026-11-16)**

- Na ficha do foco, quatro cápsulas: Silêncio (padrão), Chuva, Vento e Folhas. Tudo gerado no
  Web Audio, sem arquivo de som: ruído filtrado já soa como chuva, e um filtro que abre e fecha
  devagar já soa como vento. Zero download e zero licença de áudio.
- **Desligado por padrão**: ninguém é surpreendido com som. A escolha fica neste navegador
  (`localStorage`), como o último jardim aberto.
- `src/lib/audio.ts` (novo): um `AudioContext` só pro app, com `primeAudio()` (roda no clique de
  "Começar foco", que é o que libera áudio no navegador) e `audio()`. O `chime.ts` passou a usar
  ele em vez de ter o próprio — eram dois contextos pro mesmo app.
- `src/lib/ambience.ts` (novo): monta o caminho do som de cada tipo, entra e sai com fade (som
  que aparece de uma vez assusta), e guarda a preferência. O ruído é um trecho de 3 s em looping
  com o fim misturado ao começo, senão o emendar daria um clique. 6 testes.
- `src/features/focus/Ambience.tsx` (novo): as cápsulas. Começa e para junto com a fase de foco
  (montou, toca; desmontou, para). É um controle parado — não anima sozinho, como o resto da
  tela de foco.
- **Não dá pra conferir o som por aqui**: o que foi verificado é que as cápsulas aparecem,
  marcam, guardam a escolha e que ligar/desligar sem áudio liberado não quebra. Ouvir é com você.

**Chuva e folhas gravadas (2026-11-17)**

- [x] Chuva e folhas deixaram de ser ruído gerado: tocam as gravações de `public/sounds/`
  (`chuva.mp3`, ~5 min; `folhas.mp3`, ~17 s). Vento continua gerado no Web Audio.
- [x] Só um trecho toca, em looping até o foco acabar (qualquer duração): chuva usa 2 min a partir
  da metade do arquivo; folhas, ~15 s a partir do 2º segundo. O fim e o começo dos arquivos ficam
  de fora porque gravação costuma ter fade ali. O recorte é feito em memória, então o arquivo
  original fica intacto e dá pra trocar o trecho mexendo só em `CLIPS` (`src/lib/ambience.ts`).
- [x] A emenda do loop não dá clique nem "corte": `seamlessLoop` mistura o fim do trecho com o
  som que vinha logo antes do começo dele (mistura de potência constante), então o loop vai
  virando o começo aos poucos. A mistura é longa — 4 s na chuva, 2 s nas folhas (`blend` em
  `CLIPS`) — porque com 1 s ainda dava pra notar a troca. Função pura, 4 testes novos.
- [x] Download e recorte acontecem uma vez por aba (cache em `loops`); se o arquivo falhar, o foco
  segue em silêncio e tenta de novo no próximo. Se a pessoa trocar de som enquanto a gravação
  ainda carrega, o que chegar atrasado é ignorado.
- [x] Volume pela metade: o vento foi de 0.2 pra 0.1; as gravações tocam a 0.5 do volume
  original. O sininho do fim não mudou.
- Os arquivos chegaram como `rain.mp3.mp3` e `leaves.mp3.mp3`; foram renomeados e movidos pra
  `public/sounds/`. A chuva tem 7,5 MB e só é baixada quando alguém escolhe "Chuva".

**Ajuste depois de olhar as fotos (2026-11-16)**

Primeira versão de luz e estação ficou fraca demais nas fotos. O que mudou:

- A noite estava clara demais (parecia dia nublado). A luz do céu à noite caiu de 0.78 pra 0.52
  e o "luar" ficou mais azul. Continua legível no papel — não é modo escuro —, mas agora é noite.
- O tingimento da estação multiplicava a cor da folha, e multiplicar verde por laranja continua
  verde. Agora a folha é repintada pelo **brilho** dela vezes a cor da estação: o claro-escuro de
  cada folha continua, mas a cor troca de verdade. Os números de `tint` são "a cor que uma folha
  de brilho médio vira", já divididos pelo brilho — por isso passam de 1.
- Os vaga-lumes cresceram um pouco (0.025 → 0.034) e clarearam: do tamanho antigo não se viam.
- As folhas do raminho do avatar eram pequenas demais pra um avatar de 42 px.
- Fica em aberto: o chão da ilha não muda com a estação (só as árvores, o capim e as folhas no
  ar). No outono o verde do chão contra as copas douradas chama atenção. Mudar isso é mexer no
  `islandGeometry` (as cores são de vértice, não de material), então ficou pra depois.

**Ferramenta: conferência visual (`e2e/visual.mjs`)**

- `node e2e/visual.mjs` sobe o Supabase local + o app no Chrome, monta um jardim de mentira e
  fotografa a ilha nas quatro horas do dia, nas quatro estações, nos dois biomas, com e sem
  chuva, mais a tela de foco e uma folha com vários avatares. As fotos vão pra
  `e2e/output/visual/`.
- Não é teste (não passa nem falha): é pra olhar antes de dizer que uma mudança de estética está
  pronta. Foi assim que os ajustes acima apareceram.

**Cervinho: pulo mais natural e quatro números (2026-11-16)**

O cervinho aparecia toda vez que o jardim abria, sempre com a mesma cena. Duas mudanças:

*Pulo mais natural* (`fawnMotion.ts`)

- Antes todo pulo era igual: mesma duração (0,5 s), mesma tabela de poses, só a altura alternando
  um tiquinho. `hopShapes(hops, seed)` passou a sortear duração, altura e tombo de cada pulo; o
  último é mais baixo e mais longo, porque ele está chegando, não arrancando.
- O corpo agora **tomba pro lado** no ar (`roll` novo na pose, aplicado em `body.rotation.z`),
  alternando de lado a cada pulo. Sem isso ele pulava como brinquedo de corda.
- **Absorção no pouso**: o corpo afunda um pouco e volta, o pescoço dá um tranco e as orelhas
  batem pra baixo. Isso acontece no fim de um pulo e continua no começo do seguinte, então usa
  um `cycleBump` (bump que dá a volta no ciclo) — com o bump normal a emenda entre dois pulos
  dava um salto visível, e o teste "os pulos emendam sem tranco" pegou isso.
- Como as durações agora variam, a entrada inteira dura `enterSeconds(hops, seed)`, não
  `hops * HOP_SECONDS`.

*Quatro números* (`FawnAct`)

- Entre chegar e se assustar ele faz alguma coisa, e o jardim **nunca mostra o mesmo número
  duas vezes seguidas** (`nextShow()` guarda o último numa variável do módulo):
  - `chegada`: o de antes — chega, para e olha (olhar mais longo, 2,9 s);
  - `pastando`: dobra as patas da frente, abaixa até a grama, belisca duas vezes e levanta;
  - `sacudida`: sacode o corpo do pescoço ao rabo, orelhas batendo (rápido, como bicho faz);
  - `pulinho`: dois pulos curtos no lugar, de pernas duras — o "pronk" de filhote.
- Quem faz mais, olha menos: cada número diz quanto dura e quanto de olhar vem depois, pra cena
  inteira continuar em 6 a 8 s.
- O fim é o mesmo pra todos (susto → corre pra trás do tronco e some): é o truque que faz o
  sumiço funcionar de qualquer ângulo, então não se mexe nele.
- `lookPose(t, from)` e `startlePose(u, from)` passaram a receber a pose anterior, pra cada
  número emendar no olhar sem a cabeça dar um pulo (tem teste pra isso).
- `FawnPlan` ganhou `show` (o número + a semente dos pulos). `planFawn(..., show = nextShow())`.
- Em desenvolvimento, `?cervo=pastando` (chegada, pastando, sacudida, pulinho) força o número.
- Testes: 31 em `fawnMotion.test.ts` (eram 18). Os novos cobrem a variação dos pulos, a emenda
  entre pulos, o tombo no ar, as fases de cada número, a emenda número→olhar, nenhum casco
  afundando no chão em número nenhum e o sorteio que não repete.
- `e2e/visual.mjs` ganhou a folha `cervinho.png`: congela o relógio do cervinho (pelo
  `window.__sproutFawn` de desenvolvimento) e fotografa os quatro números em sete instantes.
- **O que não dá pra conferir em foto**: se o movimento *flui* bem é coisa de ver rodando. As
  fotos mostram que as poses estão certas (pastando de cabeça baixa, pulinho no ar, nada
  atravessando o chão); o resto é olhar com `?cervo=`.

**Cervinho: pulo, pescoço e sacudida de bicho de verdade (2026-11-17)**

Três defeitos que apareciam rodando: o pulo era duro (parecia que ele só dobrava a perna e
subia), ao abaixar o pescoço a textura bugava e o pescoço se soltava do corpo, e na sacudida o
cervinho inteiro balançava de um lado pro outro, saindo do chão.

- [x] Pulo (`fawnMotion.ts`) — 2026-11-17.
  - Causa: `settle` punha o corpo na altura "casco mais baixo + lift", então os quatro cascos
    saíam do chão juntos e a pata de trás nunca empurrava. E `keys()` usava smoothstep em cada
    quadro-chave: a velocidade zerava em toda pose (cara de stop-motion).
  - `FawnPose.grounded` virou `contact: [frente, trás]`. Com um par só apoiado, esse par fica
    plantado e o corpo gira em volta dele. Agora a pata de trás estica no chão e empurra o corpo,
    e ele pousa com as da frente primeiro, passando por cima delas (o "bound" de cervo).
  - `curve()` (Catmull-Rom) no lugar de `keys()`: a curva passa pelos quadros-chave sem frear.
  - `airborne()`: no voo o corpo segue uma curva que nasce com a velocidade do empurrão e
    chega no pouso freando. A parábola pura dava um quique na decolagem, porque a perna de trás
    perde alcance quando gira pra trás.
  - O número começa do agachado do último pouso (antes pulava 3 cm de uma vez).
- [x] Pescoço (`fawnGeometry.ts`, `Fawn.tsx`, `RIG.neck`) — 2026-11-17.
  - Causa: o pescoço era um tubo aberto girando até 1,46 rad em volta de um ponto na beira do
    peito. A base saía de dentro do tronco com a boca virada pra cima (aparecia o lado de dentro),
    e a ponta furava a cabeça.
  - Agora são dois gomos (`neckBase`, `neckTop`), cada um uma cápsula com meia esfera centrada
    na junta: girar só gira a esfera em volta do próprio centro, então nunca abre buraco. A
    base dobra 60% (pescoço de bicho dobra mais perto do ombro). A canela ganhou uma bolinha
    na junta pelo mesmo motivo.
  - Pastando: abre as patas da frente pros lados (`LegPose.out`, girando no quadril), o corpo
    desce na frente e o focinho chega na grama. Mastiga mexendo a cabeça (`sway`, novo),
    uma orelha vira pra trás escutando.
- [x] Sacudida (`fawnMotion.ts`) — 2026-11-17.
  - Causa: o `roll` girava o tronco com as pernas penduradas, e o `settle` nem sabia que o
    roll existia: os cascos varriam o chão pros lados e saíam dele.
  - `footY` agora faz a conta 3D (roll e abertura da perna). Na sacudida, as pernas giram o
    contrário do tronco e os cascos ficam plantados. A sacudida nasce na cabeça, passa pro
    tronco e termina no rabo (6 Hz, como cachorro), com as orelhas chicoteando atrasadas.
- Testes: 38 em `fawnMotion.test.ts`. Os novos pegam os três bugs (pata de trás plantada no
  empurrão, frente pousando primeiro, altura do corpo sem tranco, perna sem frear no
  quadro-chave, cascos plantados na sacudida, sacudida da cabeça pro rabo, emenda pulo→número).

### Notebook: ilha inteira, borda esfumada nos quatro lados e tamanhos pela altura da tela (2026-11-18)

Pedido: em notebook a ilha aparecia cortada e tudo parecia "com zoom". Medido com prints em
1366×657, 1536×730, 1280×600 e 1093×520 (este último é um note 1366×768 com a escala do Windows
em 125%). Causas: a câmera só enquadrava a ilha pela largura (nunca pela altura), a moldura só
esfumava em cima e embaixo (dos lados era corte seco), e os tamanhos (títulos, pedrinhas, palco)
eram fixos em pixel, pensados pra tela alta: em 1093×520 o "Começar foco" saía da tela.

- [x] 1. Borda esfumada nos quatro lados da moldura da ilha (início, jardim, visita) — 2026-11-18.
  - `tokens.css`: tokens `--scene-fade-y` (o esfumado de cima e de baixo que já existia) e
    `--scene-fade-x` (novo, 9% de cada lado). As molduras (`GardenLayout`, `FocusLauncher`,
    `FriendGarden`) usam os dois cruzados com `mask-composite: intersect`: só fica visível o
    que está dentro das duas faixas, então os cantos também somem. Acabou o corte seco dos lados.
- [x] 2. Câmera enquadra a ilha pela largura e pela altura, dentro da área sem esfumado — 2026-11-18.
  - `src/three/framing.ts` (novo, função pura): projeta na tela a beirada da grama, o lábio de
    terra e o alto das copas, e acha por busca binária a menor distância em que tudo fica fora
    do esfumado. Antes a distância saía só da largura; numa moldura larga e baixa as copas
    passavam do topo e ilhas grandes encostavam nas laterais. Testes em `framing.test.ts`.
  - O alvo da câmera também desce ou sobe até a ilha ficar no meio da faixa permitida: antes
    sobrava céu vazio em cima, e numa moldura baixa a ilha ficava pequena.
  - `GardenScene.tsx`: `defaultCamera` usa `frameCamera`; o `maxDistance` dos controles
    acompanha a distância calculada (o número fixo antigo puxaria a câmera de volta pra perto).
- [x] 3. Tamanhos pela altura da tela em notebook (títulos, palco, pedrinhas, cabeçalho) — 2026-11-18.
  - `global.css`: `h1` e `h2` usam `min(largura, altura)` da tela no `clamp`. Em tela alta
    nada muda; em tela baixa encolhem junto com a altura.
  - `Layout.module.css`: com altura até 760 px, cabeçalho de 56 px (era 72) e marca/links menores.
  - `FocusLauncher.module.css` (principal): título, o quanto ele morde a ilha, palco (mínimo
    250 px) e as pedrinhas de hoje e da sequência acompanham a altura. As pedrinhas foram um
    pouco pra fora (-7%), porque a ilha agora usa a largura toda.
  - `GardenOverview.module.css` e `GardenLayout.module.css` (jardim): espaço entre os blocos,
    respiro do painel e o cacho de pedrinhas acompanham a altura.
  - `FriendGarden.module.css` (visita): palco com mínimo de 240 px (era 300).
  - Resultado em 1093×520: o "Começar foco" da principal volta a caber na tela.
- [x] 4. Conferir com prints nos tamanhos de notebook, no celular e em tela grande — 2026-11-18.
  - Cenários `note` e `noteMede` em `e2e/output/_scenarios.mjs` (ferramenta local). O
    `noteMede` projeta a borda da ilha e diz quanto da moldura ela ocupa. Ilha grande (39
    árvores): antes ia de 1–6% a 94–99% da largura na página do jardim (encostando nas bordas);
    agora fica entre 8% e 92%, fora do esfumado, em 1093×520, 1366×657, 1920×970 e 390×844.
