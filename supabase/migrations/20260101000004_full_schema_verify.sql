-- ----------------------------------------------------------------------------
-- Story 1.4 — Migração de schema completa (tabelas, enums, triggers, funções)
--
-- O schema completo do PRD §8 já é provido pela migração base
-- `20260101000000_init_ea360.sql` (fonte de verdade, AC8) e reconciliado pela
-- migração de identidade `20260101000003_identity_story13.sql` (Story 1.3).
--
-- Esta migração é ADITIVA, IDEMPOTENTE e NÃO-DESTRUTIVA. Ela:
--   1. Renomeia o trigger `trg_profiles_updated` (na verdade aplicado em
--      `monetization_profiles`) para `trg_monetization_profiles_updated`,
--      corrigindo o nome enganoso sem alterar comportamento (AC3).
--   2. Garante (guard defensivo) o trigger `set_updated_at()` em TODAS as
--      tabelas que possuem coluna `updated_at` (AC3).
--   3. Executa um GATE de verificação que falha a migração caso qualquer
--      tabela (AC1), enum (AC2) ou função (AC3-6) declarado no PRD §8 esteja
--      ausente — tornando os Acceptance Criteria verificáveis em `db push`.
--
-- Reuso (IDS REUSE > ADAPT > CREATE): nenhuma DDL de tabela/enum/função é
-- duplicada; apenas reconciliação de nomes e verificação determinística.
-- ----------------------------------------------------------------------------

-- 1. Corrige nome enganoso do trigger de monetization_profiles (AC3)
drop trigger if exists trg_profiles_updated on monetization_profiles;
drop trigger if exists trg_monetization_profiles_updated on monetization_profiles;
create trigger trg_monetization_profiles_updated
  before update on monetization_profiles
  for each row execute function set_updated_at();

-- 2. Guard idempotente: garante trigger set_updated_at() em toda tabela com
--    coluna updated_at no schema public (AC3).
do $$
declare
  r record;
  trg_name text;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and t.table_type = 'BASE TABLE'
  loop
    trg_name := 'trg_' || r.table_name || '_set_updated_at';
    if not exists (
      select 1
      from pg_trigger tg
      join pg_class cl on cl.oid = tg.tgrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
      where ns.nspname = 'public'
        and cl.relname = r.table_name
        and not tg.tgisinternal
        and tg.tgfoid = 'public.set_updated_at()'::regprocedure
    ) then
      execute format(
        'create trigger %I before update on public.%I '
        || 'for each row execute function public.set_updated_at()',
        trg_name, r.table_name
      );
    end if;
  end loop;
end $$;

-- 3. GATE de verificação dos Acceptance Criteria (AC1, AC2, AC3-6)
do $$
declare
  expected_tables text[] := array[
    'profiles','businesses','gom_pillars','gom_categories','gom_channels',
    'interviews','interview_questions','interview_answers','monetization_profiles',
    'recommendations','recommendation_items','allocations','allocation_items',
    'experiments','risk_flags','channel_metrics','allocation_reviews',
    'oracle_documents','compliance_checks'
  ];
  expected_enums text[] := array[
    'pillar_type','payback_level','control_level','scale_level','effort_mode',
    'allocation_tier','interview_status','recommendation_status','flag_level'
  ];
  expected_funcs text[] := array[
    'set_updated_at','fn_channel_score','fn_match_channels','fn_concentration_check'
  ];
  missing text;
  t text;
  e text;
  f text;
begin
  -- AC1: tabelas
  foreach t in array expected_tables loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t and table_type = 'BASE TABLE'
    ) then
      raise exception 'Story 1.4 GATE (AC1): tabela ausente: %', t;
    end if;
  end loop;

  -- AC2: enums
  foreach e in array expected_enums loop
    if not exists (
      select 1 from pg_type ty
      join pg_namespace ns on ns.oid = ty.typnamespace
      where ns.nspname = 'public' and ty.typname = e and ty.typtype = 'e'
    ) then
      raise exception 'Story 1.4 GATE (AC2): enum ausente: %', e;
    end if;
  end loop;

  -- AC3-6: funções
  foreach f in array expected_funcs loop
    if not exists (
      select 1 from pg_proc pr
      join pg_namespace ns on ns.oid = pr.pronamespace
      where ns.nspname = 'public' and pr.proname = f
    ) then
      raise exception 'Story 1.4 GATE (AC3-6): função ausente: %', f;
    end if;
  end loop;

  raise notice 'Story 1.4 GATE OK: % tabelas, % enums, % funções verificadas.',
    array_length(expected_tables, 1),
    array_length(expected_enums, 1),
    array_length(expected_funcs, 1);
end $$;
