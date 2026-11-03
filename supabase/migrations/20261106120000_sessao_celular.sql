-- Sprout · sessão no celular
-- No iPhone, com o Safari no fundo, a página congela: o relógio do front e o heartbeat param
-- até a pessoa voltar (e às vezes o iPhone até recarrega a aba). Com as regras antigas isso
-- invalidava a sessão (sem heartbeat há mais de 3 min, ou concluída mais de 3 min depois do
-- fim) ou matava a planta (90 s sem heartbeat = aba fechada).
--
-- Regras novas (o tempo continua medido aqui, com o relógio do banco):
-- - concluir vale se passou pelo menos o tempo planejado e no máximo 2 h além dele;
--   heartbeat parado no meio não invalida mais (é a página congelada, não trapaça);
-- - a sessão só vira abandonada (e a planta morre) quando nem dá mais pra concluir:
--   sem heartbeat e já passou do planejado + 2 h.
-- Fechar a aba de propósito continua matando a planta na hora (o front avisa com keepalive).
-- `create or replace` mantém os grants que as funções já tinham.

create or replace function public.finish_session(p_session_id uuid, p_exits int)
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

  if v_elapsed < v_planned - interval '5 seconds' or v_elapsed > v_planned + interval '2 hours' then
    v_reason := 'bad_timing';   -- terminou cedo demais, ou ficou esquecida por horas
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

-- Sessão esquecida: sem heartbeat e já passou do tempo em que ainda daria pra concluir.
-- Vira abandonada e a planta morre. O start_session chama isto; o front também, ao abrir.
create or replace function public.expire_stale_sessions()
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
       and now() > started_at + make_interval(mins => planned_minutes) + interval '2 hours'
    returning plant_id
  ), mortas as (
    update plants set status = 'dead', ended_at = now()
     where id in (select plant_id from expiradas) and status = 'growing'
  )
  select count(*) into v_count from expiradas;
  return v_count;
end;
$$;
