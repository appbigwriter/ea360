-- ============================================================================
-- EA360 — Migração 0006: Modelo de dados do GOM (Story 2.1)
-- ----------------------------------------------------------------------------
-- AC da Story 2.1:
--   AC1: gom_pillars  com id, name, description, created_at
--   AC2: gom_categories com id, pillar_id (FK), name, description, created_at
--   AC3: gom_channels com id, category_id (FK), name, description e os 5 scores
--        1..5: cost_score, payback_score, control_score, risk_score, scale_score
--   AC4: índices em gom_channels.category_id e gom_categories.pillar_id
--   AC5: RLS — SELECT público nas três tabelas; DML só service_role (Story 1.5)
--   AC6: aplicável via `supabase db push` sem erros
--
-- IDS: REUSE > ADAPT > CREATE.
--   As três tabelas gom_* JÁ existem (criadas em 20260101000000_init_ea360.sql)
--   com um schema MAIS RICO, e funções load-bearing dependem dele
--   (fn_channel_score usa liquidity/scalability/capital_intensity/control_score/
--    risk_score). RENOMEAR colunas quebraria essas funções e o seed da Story 2.2
--   (No Invention / no regression). Portanto esta migração é ADITIVA e IDEMPOTENTE:
--     1. Adiciona created_at faltante em gom_pillars / gom_categories.
--     2. Expõe os nomes de score canônicos do AC3 como colunas GERADAS, mapeadas
--        às existentes, preservando semântica 1..5:
--          cost_score    := capital_intensity  (intensidade de capital/custo)
--          payback_score := liquidity          (rapidez de retorno = payback)
--          scale_score   := scalability        (escala)
--        control_score e risk_score já existem com o nome exato do AC.
--     3. Garante índices nas FKs (idempotente) — AC4.
--     4. Re-assegura RLS + SELECT público (idempotente) — AC5.
--     5. GATE determinístico: falha o push se qualquer AC não bater.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC1/AC2 — created_at em pilares e categorias (idempotente)
-- ----------------------------------------------------------------------------
alter table public.gom_pillars    add column if not exists created_at timestamptz not null default now();
alter table public.gom_categories add column if not exists created_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 2. AC3 — nomes de score canônicos como colunas geradas (1..5 preservado)
--    GENERATED ALWAYS ... STORED: leitura pelos nomes do AC sem duplicar verdade
--    nem quebrar fn_channel_score / seed da Story 2.2.
-- ----------------------------------------------------------------------------
alter table public.gom_channels
  add column if not exists cost_score    int generated always as (capital_intensity) stored;
alter table public.gom_channels
  add column if not exists payback_score int generated always as (liquidity)         stored;
alter table public.gom_channels
  add column if not exists scale_score   int generated always as (scalability)       stored;
-- control_score e risk_score já existem (1..5 com CHECK) — nada a fazer.

-- ----------------------------------------------------------------------------
-- 3. AC4 — índices nas colunas de FK (idempotente, nomes explícitos)
-- ----------------------------------------------------------------------------
create index if not exists idx_gom_categories_pillar_id on public.gom_categories (pillar_id);
create index if not exists idx_gom_channels_category_id  on public.gom_channels  (category_id);

-- ----------------------------------------------------------------------------
-- 4. AC5 — RLS habilitado + SELECT público; sem policy de escrita (service_role
--    bypassa RLS). Idempotente, alinhado à Story 1.5.
-- ----------------------------------------------------------------------------
alter table public.gom_pillars    enable row level security;
alter table public.gom_categories enable row level security;
alter table public.gom_channels   enable row level security;

drop policy if exists "gom_pillars_public_read"    on public.gom_pillars;
create policy "gom_pillars_public_read"    on public.gom_pillars    for select using (true);

drop policy if exists "gom_categories_public_read" on public.gom_categories;
create policy "gom_categories_public_read" on public.gom_categories for select using (true);

drop policy if exists "gom_channels_public_read"   on public.gom_channels;
create policy "gom_channels_public_read"   on public.gom_channels   for select using (true);

-- ----------------------------------------------------------------------------
-- 5. GATE de verificação — falha o `supabase db push` se algum AC não bater
-- ----------------------------------------------------------------------------
do $$
declare
  missing text;
  idx_count int;
  has_rls boolean;
  write_policies int;
  select_policies int;
  t text;
  catalog_tables text[] := array['gom_pillars','gom_categories','gom_channels'];
  required_channel_scores text[] := array[
    'cost_score','payback_score','control_score','risk_score','scale_score'
  ];
begin
  -- AC1: gom_pillars campos
  foreach missing in array array['id','name','description','created_at'] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='gom_pillars' and column_name=missing) then
      raise exception 'GOM GATE [AC1]: gom_pillars sem coluna %', missing;
    end if;
  end loop;

  -- AC2: gom_categories campos + FK
  foreach missing in array array['id','pillar_id','name','description','created_at'] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='gom_categories' and column_name=missing) then
      raise exception 'GOM GATE [AC2]: gom_categories sem coluna %', missing;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.table_name='gom_categories' and tc.constraint_type='FOREIGN KEY'
      and ccu.table_name='gom_pillars') then
    raise exception 'GOM GATE [AC2]: gom_categories.pillar_id sem FK para gom_pillars';
  end if;

  -- AC3: gom_channels campos base + FK + 5 scores 1..5
  foreach missing in array array['id','category_id','name','description'] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='gom_channels' and column_name=missing) then
      raise exception 'GOM GATE [AC3]: gom_channels sem coluna %', missing;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.table_name='gom_channels' and tc.constraint_type='FOREIGN KEY'
      and ccu.table_name='gom_categories') then
    raise exception 'GOM GATE [AC3]: gom_channels.category_id sem FK para gom_categories';
  end if;
  foreach missing in array required_channel_scores loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='gom_channels' and column_name=missing) then
      raise exception 'GOM GATE [AC3]: gom_channels sem coluna de score %', missing;
    end if;
  end loop;

  -- AC4: índices nas FKs
  select count(*) into idx_count from pg_indexes
    where schemaname='public' and tablename='gom_categories'
      and indexdef ilike '%(pillar_id)%';
  if idx_count = 0 then
    raise exception 'GOM GATE [AC4]: sem índice em gom_categories.pillar_id';
  end if;
  select count(*) into idx_count from pg_indexes
    where schemaname='public' and tablename='gom_channels'
      and indexdef ilike '%(category_id)%';
  if idx_count = 0 then
    raise exception 'GOM GATE [AC4]: sem índice em gom_channels.category_id';
  end if;

  -- AC5: RLS ON + SELECT público + zero policy de escrita
  foreach t in array catalog_tables loop
    select relrowsecurity into has_rls from pg_class where oid = format('public.%I', t)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'GOM GATE [AC5]: % sem RLS habilitado', t;
    end if;
    select count(*) into select_policies from pg_policies
      where schemaname='public' and tablename=t and cmd in ('SELECT','ALL');
    if select_policies = 0 then
      raise exception 'GOM GATE [AC5]: % sem policy de SELECT pública', t;
    end if;
    select count(*) into write_policies from pg_policies
      where schemaname='public' and tablename=t and cmd in ('INSERT','UPDATE','DELETE','ALL');
    if write_policies > 0 then
      raise exception 'GOM GATE [AC5]: % tem policy de escrita exposta a anon/authenticated', t;
    end if;
  end loop;

  raise notice 'GOM GATE Story 2.1: OK — tabelas, FKs, índices, scores 1..5 e RLS público verificados.';
end $$;

-- ============================================================================
-- Fim — Modelo de dados do GOM (Story 2.1).
-- ============================================================================
