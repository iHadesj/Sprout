-- Sprout · as plantas viram árvores low poly (pinheiro, macieira, cerejeira)
-- As flores de antes são convertidas pra uma árvore equivalente, então nenhum jardim perde história.
-- `create or replace` mantém os grants que o start_session já tinha.

alter table public.plants drop constraint species_values;

update public.plants
   set species = case species
                   when 'margarida' then 'macieira'
                   when 'tulipa'    then 'cerejeira'
                   else 'pinheiro'
                 end;

alter table public.plants
  add constraint species_values check (species in ('pinheiro', 'macieira', 'cerejeira'));

create or replace function public.start_session(p_garden_id uuid)
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

  if exists (select 1 from sessions where user_id = auth.uid() and status = 'active') then
    raise exception 'já existe uma sessão de foco em andamento' using errcode = 'SP002';
  end if;

  -- a árvore da vez: a que está crescendo neste jardim, ou uma semente nova
  select * into v_plant from plants
   where garden_id = v_garden.id and status = 'growing';
  if not found then
    -- espiral de girassol (ângulo de ouro): ninguém cai em cima de ninguém
    select count(*) into v_count from plants where garden_id = v_garden.id;
    v_angle  := v_count * 2.399963 + (random() - 0.5) * 0.6;
    v_radius := 0.9 * sqrt(v_count + 0.5) + random() * 0.2;
    insert into plants (garden_id, user_id, species, position_x, position_z)
    values (v_garden.id, auth.uid(),
            (array['pinheiro', 'macieira', 'cerejeira'])[1 + floor(random() * 3)::int],
            cos(v_angle) * v_radius, sin(v_angle) * v_radius)
    returning * into v_plant;
  end if;

  insert into sessions (user_id, garden_id, plant_id, planned_minutes, started_at, last_heartbeat_at, status)
  values (auth.uid(), v_garden.id, v_plant.id, v_garden.focus_minutes, now(), now(), 'active')
  returning * into v_session;

  return v_session;
end;
$$;
