-- Sprout · mais interações entre amigos (sem chat):
-- - plantar uma flor na ilha de um amigo (fica lá, com o nome de quem plantou): 1 por amigo por semana;
-- - aplaudir conquistas (árvore adulta, marcos de dias seguidos) no mural;
-- - chamar pra focar (uma sementinha): 1 por amigo por dia; se ele concluir um foco nas
--   6 h seguintes, quem chamou fica sabendo.
-- Tudo é enfeite e conversa: nada mexe em planta, sessão ou crescimento.
-- Cada ação também vira um "presente" (gifts), que aparece pra quem recebeu ao abrir o Sprout.
--
-- Erro novo: SP009 já plantou uma flor pra esse amigo nesta semana

alter table public.gifts drop constraint gift_kind;
alter table public.gifts add constraint gift_kind check (kind in ('water', 'heart', 'flower', 'clap', 'seed'));
-- detalhe curto do presente (jardim da flor, conquista aplaudida)
alter table public.gifts add column note text;
-- chamado (seed) respondido e já mostrado pra quem chamou
alter table public.gifts add column reply_seen_at timestamptz;

create table public.flowers (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references auth.users (id) on delete cascade,
  garden_id  uuid not null references public.gardens (id) on delete cascade,
  color      text not null,
  position_x double precision not null,
  position_z double precision not null,
  planted_at timestamptz not null default now(),
  constraint flower_color check (color ~ '^#[0-9a-f]{6}$')
);
create index flowers_garden on public.flowers (garden_id);
create index flowers_from on public.flowers (from_id, planted_at);

create table public.claps (
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  event_key  text not null,
  created_at timestamptz not null default now(),
  primary key (from_id, event_key)
);
create index claps_event on public.claps (event_key);

alter table public.flowers enable row level security;
alter table public.claps enable row level security;

create policy "ver flores que plantei ou que estão nos meus jardins" on public.flowers
  for select to authenticated
  using (from_id = auth.uid() or exists (select 1 from gardens g where g.id = garden_id and g.user_id = auth.uid()));
create policy "ver meus aplausos" on public.claps
  for select to authenticated using (auth.uid() in (from_id, to_id));

revoke all on public.flowers, public.claps from anon;
revoke insert, update, delete, truncate on public.flowers, public.claps from authenticated;

-- ---------- presentes: regar, corações e chamar pra focar ----------

/** Regar e chamar pra focar: 1 por amigo por dia. Corações: 1 a 999 por envio. */
create or replace function public.send_gift(p_to uuid, p_kind text, p_amount int default 1)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_tz text;
begin
  if p_kind not in ('water', 'heart', 'seed') or p_amount not between 1 and 999 then
    raise exception 'presente inválido' using errcode = 'SP005';
  end if;
  if not are_friends(auth.uid(), p_to) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  if p_kind in ('water', 'seed') then
    select coalesce(timezone, 'America/Sao_Paulo') into v_tz from profiles where id = auth.uid();
    if exists (
      select 1 from gifts
       where from_id = auth.uid() and to_id = p_to and kind = p_kind
         and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date
    ) then
      raise exception '%', case p_kind when 'water' then 'você já regou esse jardim hoje' else 'você já chamou essa pessoa hoje' end
        using errcode = 'SP008';
    end if;
  end if;
  insert into gifts (from_id, to_id, kind, amount)
  values (auth.uid(), p_to, p_kind, case when p_kind = 'heart' then p_amount else 1 end);
end;
$$;

-- muda o retorno (ganha `notes`): precisa apagar e criar de novo
drop function public.unseen_gifts();

/** Presentes recebidos e não vistos, somados por quem mandou e por tipo (com os detalhes). */
create function public.unseen_gifts()
returns table (from_id uuid, from_username text, kind text, amount int, notes text[], last_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select g.from_id, p.username, g.kind, sum(g.amount)::int,
         array_remove(array_agg(distinct g.note), null), max(g.created_at)
    from gifts g
    join profiles p on p.id = g.from_id
   where g.to_id = auth.uid() and g.seen_at is null
   group by g.from_id, p.username, g.kind
   order by max(g.created_at);
$$;

-- ---------- flores ----------

/** Planta uma flor num jardim de um amigo, num lugar livre da ilha (o servidor escolhe). */
create function public.plant_flower(p_garden uuid, p_color text)
returns public.flowers
language plpgsql security definer set search_path = public
as $$
declare
  v_garden gardens;
  v_flower flowers;
  v_x double precision;
  v_z double precision;
  v_angle double precision;
  v_radius double precision;
begin
  select * into v_garden from gardens where id = p_garden and archived_at is null;
  if not found or v_garden.user_id = auth.uid() or not are_friends(auth.uid(), v_garden.user_id) then
    raise exception 'jardim não encontrado' using errcode = 'SP007';
  end if;
  if p_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'cor inválida' using errcode = 'SP005';
  end if;
  if exists (
    select 1 from flowers f join gardens g on g.id = f.garden_id
     where f.from_id = auth.uid() and g.user_id = v_garden.user_id and f.planted_at > now() - interval '7 days'
  ) then
    raise exception 'você já plantou uma flor pra essa pessoa esta semana' using errcode = 'SP009';
  end if;

  -- até 30 tentativas de um lugar a 0,5 de qualquer árvore ou flor; senão, fica a última
  for i in 1..30 loop
    v_angle := random() * 2 * pi();
    v_radius := 0.5 + sqrt(random()) * 1.9;
    v_x := cos(v_angle) * v_radius;
    v_z := sin(v_angle) * v_radius;
    exit when not exists (
      select 1 from plants where garden_id = p_garden and (position_x - v_x) ^ 2 + (position_z - v_z) ^ 2 < 0.25
      union all
      select 1 from flowers where garden_id = p_garden and (position_x - v_x) ^ 2 + (position_z - v_z) ^ 2 < 0.16
    );
  end loop;

  insert into flowers (from_id, garden_id, color, position_x, position_z)
  values (auth.uid(), p_garden, p_color, v_x, v_z)
  returning * into v_flower;
  insert into gifts (from_id, to_id, kind, note) values (auth.uid(), v_garden.user_id, 'flower', v_garden.name);
  return v_flower;
end;
$$;

/** Flores de um jardim (seu ou de um amigo), com o nome de quem plantou. */
create function public.garden_flowers(p_garden uuid)
returns table (id uuid, color text, position_x double precision, position_z double precision, planted_at timestamptz, from_username text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from gardens where gardens.id = p_garden;
  if v_owner is null or (v_owner <> auth.uid() and not are_friends(auth.uid(), v_owner)) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  return query
    select f.id, f.color, f.position_x, f.position_z, f.planted_at, p.username
      from flowers f join profiles p on p.id = f.from_id
     where f.garden_id = p_garden
     order by f.planted_at;
end;
$$;

-- ---------- mural de conquistas e aplausos ----------

/**
 * Conquistas recentes (14 dias) suas e dos amigos: árvore adulta e marcos de dias seguidos
 * (3, 7, 14, 21, 30, 50, 100, 200, 365). Cada uma com quantos aplausos tem e se você já aplaudiu.
 */
create function public.friend_feed()
returns table (event_key text, user_id uuid, username text, kind text, detail text, garden_name text,
               happened_at timestamptz, claps int, clapped boolean, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with people as (
    select auth.uid() as id
    union
    select case when requester_id = auth.uid() then addressee_id else requester_id end
      from friendships
     where status = 'accepted' and auth.uid() in (requester_id, addressee_id)
  ), adults as (
    select 'adult:' || p.id as event_key, p.user_id, 'adult' as kind, p.species as detail, g.name as garden_name,
           p.ended_at as happened_at
      from plants p join gardens g on g.id = p.garden_id
     where p.user_id in (select id from people) and p.status = 'grown'
       and p.ended_at > now() - interval '14 days'
  ), last_days as (
    select fd.user_id, max(fd.day) as last_day from focus_days fd
     where fd.user_id in (select id from people) group by fd.user_id
  ), streaks as (
    select 'streak:' || s.user_id || ':' || s.current_streak || ':' || d.last_day as event_key, s.user_id, 'streak' as kind,
           s.current_streak::text as detail, null::text as garden_name,
           (d.last_day + interval '12 hours') at time zone coalesce(pr.timezone, 'America/Sao_Paulo') as happened_at
      from user_streaks s
      join last_days d on d.user_id = s.user_id
      join profiles pr on pr.id = s.user_id
     where s.user_id in (select id from people)
       and s.current_streak in (3, 7, 14, 21, 30, 50, 100, 200, 365)
  ), events as (
    select * from adults union all select * from streaks
  )
  select e.event_key, e.user_id, pr.username, e.kind, e.detail, e.garden_name, e.happened_at,
         (select count(*) from claps c where c.event_key = e.event_key)::int,
         exists (select 1 from claps c where c.event_key = e.event_key and c.from_id = auth.uid()),
         e.user_id = auth.uid()
    from events e join profiles pr on pr.id = e.user_id
   order by e.happened_at desc
   limit 30;
$$;

/** Aplaude uma conquista de um amigo (uma vez por conquista). Devolve false se já tinha aplaudido. */
create function public.clap(p_to uuid, p_event_key text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_note text;
begin
  if not are_friends(auth.uid(), p_to) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  -- a conquista precisa existir e ser dessa pessoa (o texto do aviso vem daqui, não do navegador)
  if p_event_key ~ '^adult:[0-9a-f-]{36}$' then
    select case species when 'pinheiro' then 'seu pinheiro adulto' else 'sua ' || species || ' adulta' end into v_note from plants
     where id = substr(p_event_key, 7)::uuid and user_id = p_to and status = 'grown';
  elsif p_event_key ~ '^streak:[0-9a-f-]{36}:[0-9]+:[0-9-]{10}$' then
    -- (o cast pra uuid só depois de o formato ser conferido)
    if split_part(p_event_key, ':', 2)::uuid = p_to then
      v_note := 'seus ' || split_part(p_event_key, ':', 3) || ' dias seguidos';
    end if;
  end if;
  if v_note is null then
    raise exception 'conquista não encontrada' using errcode = 'SP006';
  end if;

  insert into claps (from_id, to_id, event_key) values (auth.uid(), p_to, p_event_key)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into gifts (from_id, to_id, kind, note) values (auth.uid(), p_to, 'clap', v_note);
  return true;
end;
$$;

-- ---------- chamar pra focar: quem chamou fica sabendo ----------

/** Chamados seus que a pessoa atendeu (concluiu foco nas 6 h seguintes) e você ainda não viu. */
create function public.nudge_replies()
returns table (gift_id uuid, to_id uuid, to_username text, minutes int)
language sql stable security definer set search_path = public
as $$
  select g.id, g.to_id, p.username, sum(s.planned_minutes)::int
    from gifts g
    join profiles p on p.id = g.to_id
    join sessions s on s.user_id = g.to_id and s.status = 'completed'
                   and s.ended_at > g.created_at and s.ended_at <= g.created_at + interval '6 hours'
   where g.from_id = auth.uid() and g.kind = 'seed' and g.reply_seen_at is null
     and g.created_at > now() - interval '2 days'
   group by g.id, g.to_id, p.username;
$$;

create function public.mark_nudge_replies_seen()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  update gifts set reply_seen_at = now()
   where id in (select gift_id from nudge_replies());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.unseen_gifts(),
  public.plant_flower(uuid, text),
  public.garden_flowers(uuid),
  public.friend_feed(),
  public.clap(uuid, text),
  public.nudge_replies(),
  public.mark_nudge_replies_seen()
from public, anon;

grant execute on function
  public.unseen_gifts(),
  public.plant_flower(uuid, text),
  public.garden_flowers(uuid),
  public.friend_feed(),
  public.clap(uuid, text),
  public.nudge_replies(),
  public.mark_nudge_replies_seen()
to authenticated;
