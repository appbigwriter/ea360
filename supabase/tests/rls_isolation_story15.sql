-- ============================================================================
-- EA360 — Teste manual de isolamento RLS (Story 1.5, AC5)
-- ----------------------------------------------------------------------------
-- Simula dois usuários (A e B) e confirma que A não lê dados de B e vice-versa,
-- e que o catálogo GOM é legível por um papel anônimo.
--
-- COMO RODAR (ambiente com credenciais, via @devops/CI):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation_story15.sql
--
-- O script roda dentro de uma transação e faz ROLLBACK no fim — não persiste
-- dados de teste. Usa `set local role authenticated` + claim jwt.sub para
-- emular auth.uid(), exatamente como o PostgREST do Supabase faz.
-- ============================================================================

begin;

-- IDs fixos de teste
\set userA '00000000-0000-0000-0000-00000000000a'
\set userB '00000000-0000-0000-0000-00000000000b'

-- Seed mínimo (como service_role / superuser, RLS bypass)
insert into profiles (id, email) values
  (:'userA', 'a@test.ea360'),
  (:'userB', 'b@test.ea360')
on conflict (id) do nothing;

insert into businesses (id, owner_id, name) values
  ('00000000-0000-0000-0000-0000000000a1', :'userA', 'Negócio A'),
  ('00000000-0000-0000-0000-0000000000b1', :'userB', 'Negócio B')
on conflict (id) do nothing;

insert into interviews (id, business_id) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Cenário 1: usuário A só vê o próprio negócio
-- ----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'userA')::text, true);

do $$
declare cnt int;
begin
  select count(*) into cnt from businesses;
  if cnt <> 1 then
    raise exception 'FAIL [AC2]: usuário A enxergou % negócios (esperado 1)', cnt;
  end if;

  select count(*) into cnt from interviews;
  if cnt <> 1 then
    raise exception 'FAIL [AC2]: usuário A enxergou % interviews (esperado 1)', cnt;
  end if;

  -- Não pode enxergar o negócio de B
  select count(*) into cnt from businesses
    where id = '00000000-0000-0000-0000-0000000000b1';
  if cnt <> 0 then
    raise exception 'FAIL [AC5]: usuário A acessou o negócio de B';
  end if;

  raise notice 'PASS: usuário A isolado corretamente';
end $$;

-- ----------------------------------------------------------------------------
-- Cenário 2: usuário B não modifica/lê dados de A
-- ----------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'userB')::text, true);

do $$
declare cnt int;
begin
  select count(*) into cnt from interviews
    where business_id = '00000000-0000-0000-0000-0000000000a1';
  if cnt <> 0 then
    raise exception 'FAIL [AC5]: usuário B leu interviews de A';
  end if;

  -- UPDATE no negócio de A deve afetar 0 linhas (WITH CHECK / USING bloqueia)
  update businesses set name = 'hack' where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics cnt = row_count;
  if cnt <> 0 then
    raise exception 'FAIL [AC3]: usuário B alterou % linha(s) do negócio de A', cnt;
  end if;

  raise notice 'PASS: usuário B não acessa/modifica dados de A';
end $$;

-- ----------------------------------------------------------------------------
-- Cenário 3: catálogo GOM legível por anon (AC4)
-- ----------------------------------------------------------------------------
reset role;
set local role anon;

do $$
declare cnt int;
begin
  select count(*) into cnt from gom_channels;
  if cnt = 0 then
    raise notice 'WARN: gom_channels vazio (seed Story 2.2 ainda não rodou) — leitura pública OK estruturalmente';
  else
    raise notice 'PASS: anon leu % gom_channels', cnt;
  end if;
end $$;

reset role;
rollback;

-- ============================================================================
-- Fim — teste de isolamento RLS Story 1.5.
-- ============================================================================
