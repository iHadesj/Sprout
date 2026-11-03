-- Sprout · funções do servidor (RPC) que controlam o ciclo de uma sessão de foco
-- O front chama com supabase.rpc('nome', { ... }). Todas são security definer: rodam
-- com a permissão do dono do banco (escrevem em plants e sessions mesmo com a RLS
-- bloqueando o usuário), por isso toda consulta filtra por auth.uid().
--
-- O navegador nunca manda horário. Os tempos que valem são os do banco (now()):
--   heartbeat a cada 60 s; sem heartbeat há mais de 90 s = a aba sumiu (abandonada)
--   pra concluir: duração entre planejada - 5 s e planejada + 3 min,
--   e algum heartbeat nos últimos 3 min
--
-- Códigos de erro (error.code no supabase-js):
--   SP001 jardim não encontrado     SP002 já existe sessão ativa
--   SP003 sessão não está ativa     SP004 sessão não pode ser avaliada
--   SP005 valor inválido

-- Sessão cuja aba sumiu (fechou sem conseguir avisar) vira abandonada e a planta morre.
-- O start_session chama isto; o front também chama ao abrir o app, pro jardim mostrar a verdade.
create function public.expire_stale_sessions()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  with expiradas as (
    update sessions
       set status = 'abandoned', ended_at = now(), fail_reason = 'no_heartbeat'
     where user_id = auth.uid() and status = 'active'
       and last_heartbeat_at < now() - interval '90 seconds'
    returning plant_id
  ), mortas as (
    update plants set status = 'dead', ended_at = now()
     where id in (select plant_id from expiradas) and status = 'growing'
  )
  select count(*) into v_count from expiradas;
  return v_count;
end;
$$;

create function public.start_session(p_garden_id uuid)
returns public.sessions
language plpgsql security definer set search_path = public
as $$
declare
  v_garden  gardens;
  v_plant   plants;
  v_session sessions;
  v_count   int;
  v_angle   double precision;
  v_radius  double precision;
begin
  select * into v_garden from gardens
   where id = p_garden_id and user_id = auth.uid() and archived_at is null;
  if not found then
    raise exception 'jardim não encontrado' using errcode = 'SP001';
  end if;

  perform expire_stale_sessions();

  -- o índice one_active_session também barra, mas assim o erro sai com nome
  if exists (select 1 from sessions where user_id = auth.uid() and status = 'active') then
    raise exception 'já existe uma sessão de foco em andamento' using errcode = 'SP002';
  end if;

  -- a planta da vez: a que está crescendo neste jardim, ou uma semente nova
  select * into v_plant from plants
   where garden_id = v_garden.id and status = 'growing';
  if not found then
    -- espiral de girassol (ângulo de ouro, ~137,5°): a n-ésima planta fica a sqrt(n)
    -- do centro, então nenhuma cai em cima da outra e a ilha cresce com o jardim
    select count(*) into v_count from plants where garden_id = v_garden.id;
    v_angle  := v_count * 2.399963 + (random() - 0.5) * 0.6;
    v_radius := 0.9 * sqrt(v_count + 0.5) + random() * 0.2;
    insert into plants (garden_id, user_id, species, position_x, position_z)
    values (v_garden.id, auth.uid(),
            (array['margarida', 'tulipa', 'rosa'])[1 + floor(random() * 3)::int],
            cos(v_angle) * v_radius, sin(v_angle) * v_radius)
    returning * into v_plant;
  end if;

  -- o horário de início é o now() do banco
  insert into sessions (user_id, garden_id, plant_id, planned_minutes, started_at, last_heartbeat_at, status)
  values (auth.uid(), v_garden.id, v_plant.id, v_garden.focus_minutes, now(), now(), 'active')
  returning * into v_session;

  return v_session;
end;
$$;

-- Retorna false se a sessão não está mais ativa (encerrada em outra aba, por exemplo).
create function public.session_heartbeat(p_session_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  with batida as (
    update sessions set last_heartbeat_at = now()
     where id = p_session_id and user_id = auth.uid() and status = 'active'
    returning 1
  )
  select exists (select 1 from batida);
$$;

-- Chamada sozinha pelo front quando o tempo acaba. Só confere o tempo:
-- a resposta "focou de verdade?" vem depois, no rate_session, sem pressa.
create function public.finish_session(p_session_id uuid, p_exits int)
returns public.sessions
language plpgsql security definer set search_path = public
as $$
declare
  s         sessions;
  v_planned interval;
  v_elapsed interval;
  v_reason  text;
begin
  select * into s from sessions
   where id = p_session_id and user_id = auth.uid() and status = 'active'
   for update;
  if not found then
    raise exception 'sessão não está ativa' using errcode = 'SP003';
  end if;

  -- a duração é medida aqui, com o relógio do banco
  v_planned := make_interval(mins => s.planned_minutes);
  v_elapsed := now() - s.started_at;

  if v_elapsed < v_planned - interval '5 seconds' or v_elapsed > v_planned + interval '3 minutes' then
    v_reason := 'bad_timing';   -- terminou cedo demais ou tarde demais
  elsif now() - s.last_heartbeat_at > interval '3 minutes' then
    v_reason := 'no_heartbeat'; -- o navegador sumiu no meio do caminho
  end if;

  update sessions
     set status      = case when v_reason is null then 'completed' else 'invalid' end,
         fail_reason = v_reason,
         ended_at    = now(),
         exits_count = least(greatest(coalesce(p_exits, 0), 0), 99)
   where id = s.id
  returning * into s;

  return s;
end;
$$;

-- Resultado da revisão: o front mostra "sua planta cresceu +2" a partir disto.
create type public.rating_result as (
  points       int,  -- quanto a planta cresceu com esta sessão
  outcome      text, -- grew | not_focused | daily_limit | plant_not_growing
  plant_growth int,
  plant_status text
);

-- A resposta do "focou de verdade?" e os pontos de crescimento, calculados aqui.
create function public.rate_session(p_session_id uuid, p_focus_rating text, p_distraction text default null)
returns public.rating_result
language plpgsql security definer set search_path = public
as $$
declare
  s        sessions;
  p        plants;
  r        rating_result;
  v_tz     text;
  v_before int;
begin
  if p_focus_rating is null or p_focus_rating not in ('sim', 'medio', 'nao') then
    raise exception 'resposta inválida' using errcode = 'SP005';
  end if;

  select * into s from sessions
   where id = p_session_id and user_id = auth.uid()
     and status = 'completed' and focus_rating is null
   for update;
  if not found then
    raise exception 'sessão não pode ser avaliada' using errcode = 'SP004';
  end if;

  -- limite diário: só as 10 primeiras sessões concluídas do dia crescem (fuso do usuário)
  select coalesce((select timezone from profiles where id = auth.uid()), 'America/Sao_Paulo') into v_tz;
  select count(*) into v_before from sessions
   where user_id = s.user_id and status = 'completed' and ended_at < s.ended_at
     and (ended_at at time zone v_tz)::date = (s.ended_at at time zone v_tz)::date;

  r.points := case p_focus_rating when 'sim' then 2 when 'medio' then 1 else 0 end;

  select * into p from plants where id = s.plant_id for update;

  if r.points = 0 then
    r.outcome := 'not_focused'; -- "não" não cresce, mas também não mata
  elsif v_before >= 10 then
    r.points := 0;
    r.outcome := 'daily_limit';
  elsif p.status <> 'growing' then
    r.points := 0;
    r.outcome := 'plant_not_growing';
  else
    -- no update, growth à direita ainda é o valor antigo
    update plants
       set growth   = least(growth + r.points, 10),
           status   = case when growth + r.points >= 10 then 'grown' else status end,
           ended_at = case when growth + r.points >= 10 then now() else ended_at end
     where id = p.id
    returning * into p;
    r.outcome := 'grew';
  end if;

  update sessions
     set focus_rating = p_focus_rating, distraction_tag = p_distraction, growth_points = r.points
   where id = s.id;

  r.plant_growth := p.growth;
  r.plant_status := p.status;
  return r;
end;
$$;

-- Desistiu ou se distraiu: a sessão falha e a planta da vez morre.
create function public.fail_session(p_session_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_plant uuid;
begin
  if p_reason is null or p_reason not in ('gave_up', 'away_too_long', 'too_many_exits', 'page_closed') then
    raise exception 'motivo inválido' using errcode = 'SP005';
  end if;

  update sessions set status = 'failed', ended_at = now(), fail_reason = p_reason
   where id = p_session_id and user_id = auth.uid() and status = 'active'
  returning plant_id into v_plant;

  if v_plant is not null then
    update plants set status = 'dead', ended_at = now()
     where id = v_plant and status = 'growing';
  end if;
end;
$$;

-- Relógio do sistema mexido no meio do foco: a sessão não vale, mas a planta não morre.
create function public.invalidate_session(p_session_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update sessions set status = 'invalid', ended_at = now(), fail_reason = 'clock_changed'
   where id = p_session_id and user_id = auth.uid() and status = 'active';
$$;

-- Por padrão o Postgres deixa qualquer um (PUBLIC) executar funções, e o Supabase
-- ainda dá EXECUTE explícito pra anon. Revogar só de anon não bastaria.
revoke execute on function
  public.expire_stale_sessions(),
  public.start_session(uuid),
  public.session_heartbeat(uuid),
  public.finish_session(uuid, int),
  public.rate_session(uuid, text, text),
  public.fail_session(uuid, text),
  public.invalidate_session(uuid)
from public, anon;

grant execute on function
  public.expire_stale_sessions(),
  public.start_session(uuid),
  public.session_heartbeat(uuid),
  public.finish_session(uuid, int),
  public.rate_session(uuid, text, text),
  public.fail_session(uuid, text),
  public.invalidate_session(uuid)
to authenticated;

-- funções de trigger não são pra ninguém chamar direto
revoke execute on function public.handle_new_user(), public.check_timezone() from public, anon, authenticated;
