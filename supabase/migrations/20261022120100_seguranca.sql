-- Sprout · quem pode ler e escrever o quê (Row Level Security)
-- Cada um só enxerga o que é seu. plants e sessions não têm policy de escrita:
-- só mudam pelas funções do servidor, que são security definer (rodam como dono do banco).

alter table public.profiles enable row level security;
alter table public.gardens  enable row level security;
alter table public.plants   enable row level security;
alter table public.sessions enable row level security;

-- (select auth.uid()) em vez de auth.uid(): o Postgres calcula uma vez por consulta, não por linha
create policy "ler meu perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "editar meu perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "ler meus jardins" on public.gardens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "criar jardim" on public.gardens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "editar meus jardins" on public.gardens
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- sem policy de delete: arquivar (archived_at) preserva a história do jardim

create policy "ler minhas plantas" on public.plants
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ler minhas sessões" on public.sessions
  for select to authenticated using (user_id = (select auth.uid()));

-- Além da RLS, tira o privilégio de escrita. O Supabase dá todos os privilégios
-- pra anon e authenticated por padrão; sem isto, "update plants" dá "0 linhas"
-- em silêncio. Com isto, vira erro explícito: permission denied.
revoke all on public.profiles, public.gardens, public.plants, public.sessions from anon;
revoke insert, update, delete, truncate on public.plants, public.sessions from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke delete, truncate on public.gardens from authenticated;
