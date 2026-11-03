-- Sprout · nome de usuário pode ter ponto (ex.: edu.dev), como no Instagram.
-- Regra: de 3 a 24 caracteres, letras minúsculas, números, _ e ponto; sem ponto no começo,
-- no fim ou dois seguidos (".edu", "edu.", "edu..dev" não valem).

alter table public.profiles drop constraint username_format;
alter table public.profiles add constraint username_format
  check (username ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$' and username !~ '\.\.');

-- o cadastro (trigger em auth.users) usa a mesma regra; nome inválido vira "sem nome"
-- e a pessoa escolhe outro na ficha. `create or replace` mantém o trigger e as permissões.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_username text := lower(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''));
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
begin
  if v_username !~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$' or v_username ~ '\.\.' then
    v_username := null;
  end if;
  if v_timezone is null or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'America/Sao_Paulo';
  end if;

  begin
    insert into profiles (id, username, timezone) values (new.id, v_username, v_timezone);
  exception when unique_violation then
    -- username já usado: cria sem e o usuário escolhe outro na tela de conta
    insert into profiles (id, timezone) values (new.id, v_timezone);
  end;
  return new;
end;
$$;
