-- Sprout · estatísticas: views em cima de sessions, sem tabela extra.
--
-- IMPORTANTE: por padrão uma view roda com a permissão de quem a criou (o dono do banco)
-- e ignora a RLS: qualquer usuário leria as sessões de todo mundo por ela.
-- `security_invoker = true` faz a view rodar com a permissão de quem consulta,
-- então a RLS de sessions/gardens/profiles continua valendo.

-- minutos e sessões concluídas por dia, no fuso do usuário
create view public.focus_days with (security_invoker = true) as
select s.user_id,
       (s.ended_at at time zone p.timezone)::date as day,
       count(*)::int as sessions,
       sum(s.planned_minutes)::int as minutes
  from public.sessions s
  join public.profiles p on p.id = s.user_id
 where s.status = 'completed'
 group by s.user_id, (s.ended_at at time zone p.timezone)::date;

-- resumo de cada jardim: tempo, desfechos, honestidade e a última sessão concluída
create view public.garden_stats with (security_invoker = true) as
select g.id as garden_id,
       g.user_id,
       count(s.id) filter (where s.status = 'completed')::int as completed,
       count(s.id) filter (where s.status in ('failed', 'abandoned'))::int as failed,
       count(s.id) filter (where s.status = 'invalid')::int as invalid,
       coalesce(sum(s.planned_minutes) filter (where s.status = 'completed'), 0)::int as minutes,
       -- sequência de honestidade: quantas vezes a pessoa admitiu que não focou
       count(s.id) filter (where s.focus_rating = 'nao')::int as honest_nos,
       max(s.ended_at) filter (where s.status = 'completed') as last_completed_at
  from public.gardens g
  left join public.sessions s on s.garden_id = g.id
 group by g.id, g.user_id;

-- sequência de dias com pelo menos uma sessão concluída (atual e a melhor de todas).
-- Truque "gaps and islands": dia menos a posição dele na lista dá o mesmo valor
-- pra todos os dias seguidos; agrupando por esse valor, cada grupo é uma sequência.
create view public.user_streaks with (security_invoker = true) as
with days as (
  select user_id, day, day - (row_number() over (partition by user_id order by day))::int as run
    from public.focus_days
), runs as (
  select user_id, max(day) as last_day, count(*)::int as length
    from days
   group by user_id, run
)
select r.user_id,
       -- a sequência atual é a que terminou hoje ou ontem (hoje ainda dá tempo)
       coalesce(max(r.length) filter (where r.last_day >= (now() at time zone p.timezone)::date - 1), 0)::int
         as current_streak,
       max(r.length)::int as best_streak
  from runs r
  join public.profiles p on p.id = r.user_id
 group by r.user_id, p.timezone;

-- o que distraiu, e em que hora do dia (no fuso do usuário)
create view public.distraction_stats with (security_invoker = true) as
select s.user_id,
       s.distraction_tag as tag,
       extract(hour from s.ended_at at time zone p.timezone)::int as hour,
       count(*)::int as count
  from public.sessions s
  join public.profiles p on p.id = s.user_id
 where s.distraction_tag is not null
 group by s.user_id, s.distraction_tag, extract(hour from s.ended_at at time zone p.timezone);

revoke all on public.focus_days, public.garden_stats, public.user_streaks, public.distraction_stats from anon;
revoke insert, update, delete, truncate on public.focus_days, public.garden_stats, public.user_streaks, public.distraction_stats
  from authenticated;
