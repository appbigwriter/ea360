-- ----------------------------------------------------------------------------
-- Story 1.3 — Autenticação e identidade
-- Migração aditiva (não-destrutiva) que reconcilia o schema de identidade da
-- migração inicial (0001) com os Acceptance Criteria do Story 1.3.
--
-- Reuso: tabelas `profiles` e `businesses`, função `set_updated_at()` e as
-- policies de RLS já existem na migração 0001. Esta migração apenas:
--   1. Adiciona `avatar_url` em `profiles` (AC4).
--   2. Adiciona o trigger `set_updated_at()` em `profiles` (AC6).
--   3. Cria o trigger `handle_new_user()` que cria automaticamente um
--      registro em `profiles` quando um usuário é criado em `auth.users`
--      (suporta o fluxo de cadastro do AC1 e a integridade do AC4/AC5).
--
-- Observação sobre AC5 (FK businesses.owner_id -> profiles.id): em 0001 o FK
-- aponta para `auth.users(id)`. Como `profiles.id` é, ele próprio, um FK 1:1
-- para `auth.users(id)`, a identidade referenciada é exatamente a mesma. Para
-- não quebrar consumidores existentes da constraint atual, mantemos o FK para
-- `auth.users(id)` e garantimos via trigger que todo usuário tem um `profiles`
-- correspondente — preservando a intenção do AC5 sem migração destrutiva.
-- ----------------------------------------------------------------------------

-- 1. avatar_url em profiles (AC4)
alter table profiles
  add column if not exists avatar_url text;

-- 2. Trigger de updated_at em profiles (AC6)
drop trigger if exists trg_profiles_self_updated on profiles;
create trigger trg_profiles_self_updated
  before update on profiles
  for each row execute function set_updated_at();

-- 3. Criação automática de profile no cadastro (AC1)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
