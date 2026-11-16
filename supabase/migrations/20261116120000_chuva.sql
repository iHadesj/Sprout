-- Sprout · chuva no dia da perda.
--
-- Só aparência: no jardim em que uma planta morreu hoje, chove até virar o dia. Combina com
-- "o jardim mostra a história real, inclusive os dias ruins". Nada aqui muda regra, crescimento
-- nem histórico: a view só passa a dizer *quando* foi a última perda, como já dizia quando foi
-- a última sessão concluída.
--
-- `create or replace view` só deixa acrescentar coluna no fim, e é o que se faz aqui.
-- O `security_invoker = true` continua: sem ele a view ignoraria a RLS.
create or replace view public.garden_stats with (security_invoker = true) as
select g.id as garden_id,
       g.user_id,
       count(s.id) filter (where s.status = 'completed')::int as completed,
       count(s.id) filter (where s.status in ('failed', 'abandoned'))::int as failed,
       count(s.id) filter (where s.status = 'invalid')::int as invalid,
       coalesce(sum(s.planned_minutes) filter (where s.status = 'completed'), 0)::int as minutes,
       -- sequência de honestidade: quantas vezes a pessoa admitiu que não focou
       count(s.id) filter (where s.focus_rating = 'nao')::int as honest_nos,
       max(s.ended_at) filter (where s.status = 'completed') as last_completed_at,
       -- desistiu ou deixou a sessão morrer: a planta daquela vez morreu
       max(s.ended_at) filter (where s.status in ('failed', 'abandoned')) as last_failed_at
  from public.gardens g
  left join public.sessions s on s.garden_id = g.id
 group by g.id, g.user_id;
