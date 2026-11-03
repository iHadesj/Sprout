-- Sprout · tabelas do MVP
-- profiles e gardens o usuário edita; plants e sessions só mudam pelas funções do servidor.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique,
  timezone   text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);

create table public.gardens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  color         text not null default '#f08fb0',
  biome         text not null default 'campo',
  focus_minutes int  not null default 25,
  break_minutes int  not null default 5,
  created_at    timestamptz not null default now(),
  archived_at   timestamptz,
  constraint name_length check (char_length(btrim(name)) between 1 and 40),
  constraint color_hex check (color ~ '^#[0-9a-f]{6}$'),
  constraint biome_values check (biome in ('campo', 'cerrado', 'neve')),
  -- abaixo de 15 min vira atalho pra farmar planta
  constraint focus_range check (focus_minutes between 15 and 60),
  constraint break_range check (break_minutes between 3 and 15)
);

create index gardens_user on public.gardens (user_id);

create table public.plants (
  id         uuid primary key default gen_random_uuid(),
  garden_id  uuid not null references public.gardens (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  species    text not null,
  growth     int  not null default 0,
  status     text not null default 'growing',
  position_x real not null,
  position_z real not null,
  planted_at timestamptz not null default now(),
  ended_at   timestamptz, -- quando ficou adulta ou morreu
  constraint species_values check (species in ('margarida', 'tulipa', 'rosa')),
  constraint growth_range check (growth between 0 and 10),
  constraint status_values check (status in ('growing', 'grown', 'dead'))
);

-- cada jardim tem uma planta em crescimento por vez
create unique index one_growing_plant on public.plants (garden_id) where status = 'growing';
create index plants_garden on public.plants (garden_id);

create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  garden_id         uuid not null references public.gardens (id) on delete cascade,
  plant_id          uuid not null references public.plants (id) on delete cascade,
  planned_minutes   int  not null,
  started_at        timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  ended_at          timestamptz,
  status            text not null default 'active',
  fail_reason       text,
  focus_rating      text,
  distraction_tag   text,
  exits_count       int  not null default 0,
  growth_points     int, -- quanto a planta cresceu com esta sessão (preenchido na revisão)
  constraint planned_range check (planned_minutes between 15 and 60),
  constraint status_values check (status in ('active', 'completed', 'failed', 'abandoned', 'invalid')),
  constraint fail_reason_values check (fail_reason in (
    'gave_up', 'away_too_long', 'too_many_exits', 'page_closed', -- relatados pelo navegador
    'clock_changed',                                            -- relógio mexido (navegador)
    'bad_timing', 'no_heartbeat'                                -- decididos pelo servidor
  )),
  constraint rating_values check (focus_rating in ('sim', 'medio', 'nao')),
  constraint distraction_values check (distraction_tag in ('celular', 'cansaco', 'barulho', 'fome', 'outro')),
  constraint exits_range check (exits_count >= 0)
);

-- só uma sessão ativa por usuário: abrir duas abas pra dobrar não funciona
create unique index one_active_session on public.sessions (user_id) where status = 'active';
create index sessions_user_ended on public.sessions (user_id, ended_at desc);
create index sessions_garden on public.sessions (garden_id);
create index sessions_plant on public.sessions (plant_id);

-- Fuso inválido quebraria a conta de "sessões de hoje" das funções.
create function public.check_timezone()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.check_timezone();

-- Cria o profile junto com a conta. auth.users é a tabela do Supabase Auth;
-- username e timezone chegam nos metadados do cadastro (options.data no signUp).
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_username text := lower(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''));
  v_timezone text := new.raw_user_meta_data ->> 'timezone';
begin
  if v_username !~ '^[a-z0-9_]{3,24}$' then
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
