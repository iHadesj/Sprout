-- Sprout · foto de perfil
--
-- A foto fica no Supabase Storage, no bucket público `avatars`, em `<id do dono>/<aleatório>.webp`.
-- Público quer dizer: quem tiver o link vê a foto (é assim que ela aparece pros amigos sem
-- precisar de um link temporário). O nome do arquivo é aleatório, então não dá pra adivinhar.
--
-- Quem grava é sempre o dono: as regras abaixo só deixam enviar e apagar dentro da pasta com o
-- próprio id. O front reduz a foto pra 256 px em WebP antes de enviar (uns 20 a 40 KB); o limite
-- de 300 KB e os tipos aceitos são a garantia do lado do servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 300000, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- (storage.foldername(name))[1] é a primeira pasta do caminho: tem que ser o id de quem envia
create policy "enviar minha foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- apagar no Storage lê o arquivo antes: sem esta regra o delete não acha nada
create policy "ver meus arquivos de foto" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "apagar minha foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- qual foto a pessoa está usando (null = o raminho desenhado)
alter table public.profiles add column avatar_path text;

-- a foto tem que estar na pasta do próprio dono: sem isto, dava pra apontar pro arquivo de outra
-- pessoa (o update do perfil é livre pro dono, pela RLS)
alter table public.profiles add constraint avatar_path_own_folder check (
  avatar_path is null
  or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9-]{8,64}\.(webp|jpg|png)$')
);

-- amigos e ranking passam a devolver a foto. Mudar o que uma função devolve exige recriá-la.
drop function public.list_friends();
create function public.list_friends()
returns table (user_id uuid, username text, avatar_path text, status text, direction text, since timestamptz)
language sql stable security definer set search_path = public
as $$
  select other.id, other.username, other.avatar_path, f.status,
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

drop function public.friend_ranking();
create function public.friend_ranking()
returns table (user_id uuid, username text, avatar_path text, minutes int, sessions int, is_me boolean)
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
  select pr.id, pr.username, pr.avatar_path,
         coalesce(sum(c.planned_minutes) filter (where c.nth <= 10), 0)::int,
         (count(c.*) filter (where c.nth <= 10))::int,
         pr.id = auth.uid()
    from people pe
    join profiles pr on pr.id = pe.id
    left join counted c on c.user_id = pe.id
   group by pr.id, pr.username, pr.avatar_path
   order by 4 desc, pr.username;
$$;

revoke execute on function public.list_friends(), public.friend_ranking() from public, anon;
grant execute on function public.list_friends(), public.friend_ranking() to authenticated;
