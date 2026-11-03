-- Sprout · amigos, ranking da semana e presentes (regar e corações)
--
-- Regras:
-- - Amizade nasce de um pedido (pelo nome de usuário) aceito pelo outro, ou de um link de
--   convite (abrir o link do amigo e confirmar já é o "aceite" dos dois lados).
-- - Amigos não leem as tabelas um do outro: só as funções abaixo, que conferem a amizade.
--   Um amigo vê seu nome de usuário, seus minutos da semana, seus jardins e suas árvores.
--   Sessões, distrações e respostas de honestidade continuam só suas.
-- - Ranking = minutos de foco da semana (segunda 00:00, horário de Brasília), só de sessões
--   que o servidor concluiu, até 10 por dia (o mesmo teto do crescimento).
-- - Presente é enfeite: regar (1 por amigo por dia) e corações (1 a 999 por envio).
--   Nada disso mexe em planta ou sessão.
--
-- Códigos de erro novos:
--   SP006 usuário ou convite não encontrado     SP007 vocês não são amigos
--   SP008 já regou esse jardim hoje

-- link de convite de cada pessoa: /amigo/<invite_code>
alter table public.profiles
  add column invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10);

create table public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending',
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (requester_id, addressee_id),
  constraint friendship_status check (status in ('pending', 'accepted')),
  constraint friendship_not_self check (requester_id <> addressee_id)
);

-- o mesmo par só aparece uma vez, em qualquer direção
create unique index friendships_pair
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table public.gifts (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  amount     int  not null default 1,
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  constraint gift_kind check (kind in ('water', 'heart')),
  constraint gift_amount check (amount between 1 and 999),
  constraint gift_not_self check (from_id <> to_id)
);

create index gifts_unseen on public.gifts (to_id) where seen_at is null;
create index gifts_from on public.gifts (from_id, to_id, kind, created_at);

-- ---------- acesso ----------

alter table public.friendships enable row level security;
alter table public.gifts enable row level security;

create policy "ver minhas amizades" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "ver presentes meus" on public.gifts
  for select to authenticated using (auth.uid() in (from_id, to_id));

-- escrever só pelas funções
revoke all on public.friendships, public.gifts from anon;
revoke insert, update, delete, truncate on public.friendships, public.gifts from authenticated;

-- ---------- funções ----------

create function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from friendships
     where status = 'accepted'
       and ((requester_id = p_a and addressee_id = p_b) or (requester_id = p_b and addressee_id = p_a))
  );
$$;

/** Pede amizade pelo nome. Se o outro já tinha pedido, vira amizade na hora. */
create function public.send_friend_request(p_username text)
returns text -- requested | accepted | already
language plpgsql security definer set search_path = public
as $$
declare
  v_other uuid;
  v_row   friendships;
begin
  select id into v_other from profiles where username = lower(btrim(p_username));
  if v_other is null then
    raise exception 'usuário não encontrado' using errcode = 'SP006';
  end if;
  if v_other = auth.uid() then
    raise exception 'esse é você' using errcode = 'SP005';
  end if;

  select * into v_row from friendships
   where (requester_id = auth.uid() and addressee_id = v_other)
      or (requester_id = v_other and addressee_id = auth.uid())
   for update;

  if not found then
    insert into friendships (requester_id, addressee_id) values (auth.uid(), v_other);
    return 'requested';
  end if;
  if v_row.status = 'pending' and v_row.requester_id = v_other then
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = v_other and addressee_id = auth.uid();
    return 'accepted';
  end if;
  return 'already';
end;
$$;

/** Aceita ou recusa um pedido recebido. Recusar apaga o pedido. */
create function public.respond_friend_request(p_user uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_accept then
    update friendships set status = 'accepted', accepted_at = now()
     where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
  else
    delete from friendships
     where requester_id = p_user and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then
    raise exception 'pedido não encontrado' using errcode = 'SP006';
  end if;
end;
$$;

/** Desfaz a amizade (ou cancela um pedido), de qualquer lado. */
create function public.remove_friend(p_user uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from friendships
   where (requester_id = auth.uid() and addressee_id = p_user)
      or (requester_id = p_user and addressee_id = auth.uid());
$$;

/** Quem é o dono de um convite (pra tela mostrar "edu te convidou" antes de aceitar). */
create function public.invite_info(p_code text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(username, 'alguém') into v_name from profiles where invite_code = p_code;
  if not found then
    raise exception 'convite não encontrado' using errcode = 'SP006';
  end if;
  return v_name;
end;
$$;

/** Aceita o convite de um link: vira amizade direto (o link já é o pedido de quem mandou). */
create function public.join_by_invite(p_code text)
returns text -- nome de quem convidou
language plpgsql security definer set search_path = public
as $$
declare
  v_owner profiles;
begin
  select * into v_owner from profiles where invite_code = p_code;
  if not found then
    raise exception 'convite não encontrado' using errcode = 'SP006';
  end if;
  if v_owner.id = auth.uid() then
    raise exception 'esse convite é seu' using errcode = 'SP005';
  end if;

  update friendships set status = 'accepted', accepted_at = coalesce(accepted_at, now())
   where (requester_id = auth.uid() and addressee_id = v_owner.id)
      or (requester_id = v_owner.id and addressee_id = auth.uid());
  if not found then
    insert into friendships (requester_id, addressee_id, status, accepted_at)
    values (v_owner.id, auth.uid(), 'accepted', now());
  end if;
  return coalesce(v_owner.username, 'alguém');
end;
$$;

/** Amigos e pedidos, com o nome de cada um. */
create function public.list_friends()
returns table (user_id uuid, username text, status text, direction text, since timestamptz)
language sql stable security definer set search_path = public
as $$
  select other.id, other.username, f.status,
         case when f.status = 'accepted' then 'friend'
              when f.requester_id = auth.uid() then 'outgoing'
              else 'incoming' end,
         coalesce(f.accepted_at, f.created_at)
    from friendships f
    join profiles other
      on other.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
   where auth.uid() in (f.requester_id, f.addressee_id)
   order by other.username;
$$;

/**
 * Ranking da semana: você e seus amigos, por minutos de foco concluídos desde segunda
 * 00:00 (Brasília). Só as 10 primeiras sessões concluídas de cada dia contam.
 */
create function public.friend_ranking()
returns table (user_id uuid, username text, minutes int, sessions int, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with people as (
    select auth.uid() as id
    union
    select case when requester_id = auth.uid() then addressee_id else requester_id end
      from friendships
     where status = 'accepted' and auth.uid() in (requester_id, addressee_id)
  ), week as (
    select (date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo') as start
  ), counted as (
    select s.user_id, s.planned_minutes,
           row_number() over (
             partition by s.user_id, (s.ended_at at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
             order by s.ended_at
           ) as nth
      from sessions s
      join profiles p on p.id = s.user_id
     where s.user_id in (select id from people)
       and s.status = 'completed'
       and s.ended_at >= (select start from week)
  )
  select pr.id, pr.username,
         coalesce(sum(c.planned_minutes) filter (where c.nth <= 10), 0)::int,
         (count(c.*) filter (where c.nth <= 10))::int,
         pr.id = auth.uid()
    from people pe
    join profiles pr on pr.id = pe.id
    left join counted c on c.user_id = pe.id
   group by pr.id, pr.username
   order by 3 desc, pr.username;
$$;

/** Jardins de um amigo (ou os seus), pra visitar. */
create function public.friend_gardens(p_user uuid)
returns setof public.gardens
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_user <> auth.uid() and not are_friends(auth.uid(), p_user) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  return query select * from gardens where user_id = p_user and archived_at is null order by created_at;
end;
$$;

/** Plantas de um amigo (todas as dos jardins ativos), pra cena 3D da visita. */
create function public.friend_plants(p_user uuid)
returns setof public.plants
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_user <> auth.uid() and not are_friends(auth.uid(), p_user) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  return query
    select pl.* from plants pl
      join gardens g on g.id = pl.garden_id
     where pl.user_id = p_user and g.archived_at is null
     order by pl.planted_at;
end;
$$;

/** Manda um presente: regar (1 por amigo por dia) ou corações (1 a 999). */
create function public.send_gift(p_to uuid, p_kind text, p_amount int default 1)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_tz text;
begin
  if p_kind not in ('water', 'heart') or p_amount not between 1 and 999 then
    raise exception 'presente inválido' using errcode = 'SP005';
  end if;
  if not are_friends(auth.uid(), p_to) then
    raise exception 'vocês não são amigos' using errcode = 'SP007';
  end if;
  if p_kind = 'water' then
    select coalesce(timezone, 'America/Sao_Paulo') into v_tz from profiles where id = auth.uid();
    if exists (
      select 1 from gifts
       where from_id = auth.uid() and to_id = p_to and kind = 'water'
         and (created_at at time zone v_tz)::date = (now() at time zone v_tz)::date
    ) then
      raise exception 'você já regou esse jardim hoje' using errcode = 'SP008';
    end if;
  end if;
  insert into gifts (from_id, to_id, kind, amount)
  values (auth.uid(), p_to, p_kind, case when p_kind = 'water' then 1 else p_amount end);
end;
$$;

/** Presentes recebidos e ainda não vistos, somados por quem mandou e por tipo. */
create function public.unseen_gifts()
returns table (from_id uuid, from_username text, kind text, amount int, last_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select g.from_id, p.username, g.kind, sum(g.amount)::int, max(g.created_at)
    from gifts g
    join profiles p on p.id = g.from_id
   where g.to_id = auth.uid() and g.seen_at is null
   group by g.from_id, p.username, g.kind
   order by max(g.created_at);
$$;

create function public.mark_gifts_seen()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  update gifts set seen_at = now() where to_id = auth.uid() and seen_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.are_friends(uuid, uuid),
  public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.invite_info(text),
  public.join_by_invite(text),
  public.list_friends(),
  public.friend_ranking(),
  public.friend_gardens(uuid),
  public.friend_plants(uuid),
  public.send_gift(uuid, text, int),
  public.unseen_gifts(),
  public.mark_gifts_seen()
from public, anon;

grant execute on function
  public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friend(uuid),
  public.invite_info(text),
  public.join_by_invite(text),
  public.list_friends(),
  public.friend_ranking(),
  public.friend_gardens(uuid),
  public.friend_plants(uuid),
  public.send_gift(uuid, text, int),
  public.unseen_gifts(),
  public.mark_gifts_seen()
to authenticated;
-- are_friends é só pra uso interno das funções acima
revoke execute on function public.are_friends(uuid, uuid) from authenticated;
