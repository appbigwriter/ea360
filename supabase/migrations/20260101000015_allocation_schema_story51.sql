-- ============================================================================
-- EA360 — Migração 0015: Modelo de alocação e experimentos (Story 5.1)
-- ----------------------------------------------------------------------------
-- AC da Story 5.1:
--   AC1: allocations com id, business_id (FK businesses), recommendation_id
--        (FK recommendations), total_budget, status (enum draft/active/archived),
--        risk_band_ratios (JSONB núcleo/crescimento/experimento), created_at,
--        updated_at.
--   AC2: allocation_items com id, allocation_id (FK), channel_id (FK gom_channels),
--        amount, percentage, risk_band (enum core/growth/experiment),
--        ceiling_pct (teto %), created_at.
--   AC3: experiments com id, allocation_item_id (FK), hypothesis, kill_criteria,
--        target_metric, target_value, deadline, status (enum
--        active/killed/completed), created_at, updated_at.
--   AC4: enums allocation_status, risk_band, experiment_status.
--   AC5: trigger set_updated_at em allocations e experiments.
--   AC6: RLS — usuário acessa apenas alocações do seu business_id.
--   AC7: migração aplicada sem erros (`supabase db push`).
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE (sem modificar): função set_updated_at() e owns_business(uuid), criadas
--          em 20260101000000_init_ea360.sql; tabelas businesses, recommendations
--          e gom_channels como alvos de FK. Reusar evita reinvenção (Article IV) e
--          mantém a RLS consistente com recommendations (Story 4.1) e gom (2.1).
--   CREATE (justificado): allocations, allocation_items, experiments e os 3 enums
--          (allocation_status, risk_band, experiment_status) NÃO existem no schema.
--          Capacidade nova: persistir carteiras de distribuição de verba e
--          experimentos com kill-criteria (PRD §8 / R4). Padrões avaliados:
--          recommendation_items (rejeitado — semântica de ranking de canal, não de
--          alocação de verba com bandas de risco/teto e experimentos).
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0006/0013).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC4 — enums (idempotentes via DO/guard; padrão para criação condicional).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'allocation_status') then
    create type allocation_status as enum ('draft', 'active', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_band') then
    create type risk_band as enum ('core', 'growth', 'experiment');
  end if;
  if not exists (select 1 from pg_type where typname = 'experiment_status') then
    create type experiment_status as enum ('active', 'killed', 'completed');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. AC1 — allocations.
-- ----------------------------------------------------------------------------
create table if not exists public.allocations (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  recommendation_id uuid references public.recommendations (id) on delete set null,
  total_budget      numeric not null default 0 check (total_budget >= 0),
  status            allocation_status not null default 'draft',
  risk_band_ratios  jsonb not null default '{"core": 70, "growth": 20, "experiment": 10}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.allocations add column if not exists recommendation_id uuid references public.recommendations (id) on delete set null;
alter table public.allocations add column if not exists total_budget numeric not null default 0 check (total_budget >= 0);
alter table public.allocations add column if not exists status allocation_status not null default 'draft';
alter table public.allocations add column if not exists risk_band_ratios jsonb not null default '{"core": 70, "growth": 20, "experiment": 10}'::jsonb;


-- ----------------------------------------------------------------------------
-- 3. AC2 — allocation_items.
-- ----------------------------------------------------------------------------
create table if not exists public.allocation_items (
  id            uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations (id) on delete cascade,
  channel_id    uuid not null references public.gom_channels (id) on delete restrict,
  amount        numeric not null default 0 check (amount >= 0),
  percentage    numeric not null default 0 check (percentage >= 0 and percentage <= 100),
  risk_band     risk_band not null,
  ceiling_pct   numeric check (ceiling_pct is null or (ceiling_pct >= 0 and ceiling_pct <= 100)),
  created_at    timestamptz not null default now()
);

alter table public.allocation_items add column if not exists percentage numeric not null default 0 check (percentage >= 0 and percentage <= 100);
alter table public.allocation_items add column if not exists risk_band risk_band not null default 'core';
alter table public.allocation_items add column if not exists ceiling_pct numeric check (ceiling_pct is null or (ceiling_pct >= 0 and ceiling_pct <= 100));
alter table public.allocation_items add column if not exists created_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 4. AC3 — experiments. kill_criteria NOT NULL (todo experimento tem kill-criteria — R4).
-- ----------------------------------------------------------------------------
create table if not exists public.experiments (
  id                 uuid primary key default gen_random_uuid(),
  allocation_item_id uuid not null references public.allocation_items (id) on delete cascade,
  hypothesis         text not null,
  kill_criteria      text not null,
  target_metric      text,
  target_value       numeric,
  deadline           date,
  status             experiment_status not null default 'active',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.experiments add column if not exists allocation_item_id uuid references public.allocation_items (id) on delete cascade;
alter table public.experiments add column if not exists kill_criteria text not null default '';
alter table public.experiments add column if not exists status experiment_status not null default 'active';
alter table public.experiments add column if not exists target_metric text;
alter table public.experiments add column if not exists target_value numeric;
alter table public.experiments add column if not exists deadline date;
alter table public.experiments add column if not exists updated_at timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 5. Índices nas FKs (consistente com o padrão das demais migrações).
-- ----------------------------------------------------------------------------
create index if not exists idx_allocations_business_id        on public.allocations      (business_id);
create index if not exists idx_allocations_recommendation_id  on public.allocations      (recommendation_id);
create index if not exists idx_allocation_items_allocation_id on public.allocation_items (allocation_id);
create index if not exists idx_allocation_items_channel_id    on public.allocation_items (channel_id);
create index if not exists idx_experiments_allocation_item_id on public.experiments      (allocation_item_id);

-- ----------------------------------------------------------------------------
-- 6. AC5 — trigger set_updated_at em allocations e experiments.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_allocations_updated_at on public.allocations;
create trigger trg_allocations_updated_at
  before update on public.allocations
  for each row execute function set_updated_at();

drop trigger if exists trg_experiments_updated_at on public.experiments;
create trigger trg_experiments_updated_at
  before update on public.experiments
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. AC6 — RLS por business_id (idempotente, via owns_business()). Filhas herdam
--    o escopo através do owner da allocation pai.
-- ----------------------------------------------------------------------------
alter table public.allocations      enable row level security;
alter table public.allocation_items enable row level security;
alter table public.experiments      enable row level security;

drop policy if exists "allocations do dono" on public.allocations;
create policy "allocations do dono" on public.allocations
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "allocation_items do dono" on public.allocation_items;
create policy "allocation_items do dono" on public.allocation_items
  for all using (
    exists (
      select 1 from public.allocations a
      where a.id = allocation_items.allocation_id
        and owns_business(a.business_id)
    )
  );

drop policy if exists "experiments do dono" on public.experiments;
create policy "experiments do dono" on public.experiments
  for all using (
    exists (
      select 1
      from public.allocation_items ai
      join public.allocations a on a.id = ai.allocation_id
      where ai.id = experiments.allocation_item_id
        and owns_business(a.business_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 8. GATE de verificação — falha o `supabase db push` se algum AC não bater (AC7).
-- ----------------------------------------------------------------------------
do $$
declare
  missing text;
  has_rls boolean;
  has_trigger boolean;
  fk_ok boolean;
  t text;
  lbl text;
  alloc_cols text[] := array[
    'id','business_id','recommendation_id','total_budget','status',
    'risk_band_ratios','created_at','updated_at'
  ];
  item_cols text[] := array[
    'id','allocation_id','channel_id','amount','percentage','risk_band',
    'ceiling_pct','created_at'
  ];
  exp_cols text[] := array[
    'id','allocation_item_id','hypothesis','kill_criteria','target_metric',
    'target_value','deadline','status','created_at','updated_at'
  ];
begin
  -- AC1: colunas de allocations
  foreach missing in array alloc_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='allocations' and column_name=missing) then
      raise exception 'ALLOC GATE [AC1]: allocations sem coluna %', missing;
    end if;
  end loop;

  -- AC1: FKs business_id e recommendation_id
  foreach missing in array array['business_id','recommendation_id'] loop
    select exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
        and tc.table_name='allocations' and kcu.column_name=missing
    ) into fk_ok;
    if not fk_ok then raise exception 'ALLOC GATE [AC1]: FK % ausente em allocations', missing; end if;
  end loop;

  -- AC2: colunas de allocation_items
  foreach missing in array item_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='allocation_items' and column_name=missing) then
      raise exception 'ALLOC GATE [AC2]: allocation_items sem coluna %', missing;
    end if;
  end loop;

  -- AC2: FKs allocation_id e channel_id
  foreach missing in array array['allocation_id','channel_id'] loop
    select exists (
      select 1 from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
        and tc.table_name='allocation_items' and kcu.column_name=missing
    ) into fk_ok;
    if not fk_ok then raise exception 'ALLOC GATE [AC2]: FK % ausente em allocation_items', missing; end if;
  end loop;

  -- AC3: colunas de experiments
  foreach missing in array exp_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='experiments' and column_name=missing) then
      raise exception 'ALLOC GATE [AC3]: experiments sem coluna %', missing;
    end if;
  end loop;

  -- AC3: FK allocation_item_id
  select exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
      and tc.table_name='experiments' and kcu.column_name='allocation_item_id'
  ) into fk_ok;
  if not fk_ok then raise exception 'ALLOC GATE [AC3]: FK allocation_item_id ausente em experiments'; end if;

  -- AC3: kill_criteria NOT NULL (todo experimento tem kill-criteria — R4)
  if exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='experiments'
        and column_name='kill_criteria' and is_nullable='YES') then
    raise exception 'ALLOC GATE [AC3]: experiments.kill_criteria deve ser NOT NULL';
  end if;

  -- AC4: enums com labels canônicos
  foreach lbl in array array['draft','active','archived'] loop
    if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
        where ty.typname='allocation_status' and e.enumlabel=lbl) then
      raise exception 'ALLOC GATE [AC4]: allocation_status sem label %', lbl;
    end if;
  end loop;
  foreach lbl in array array['core','growth','experiment'] loop
    if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
        where ty.typname='risk_band' and e.enumlabel=lbl) then
      raise exception 'ALLOC GATE [AC4]: risk_band sem label %', lbl;
    end if;
  end loop;
  foreach lbl in array array['active','killed','completed'] loop
    if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid
        where ty.typname='experiment_status' and e.enumlabel=lbl) then
      raise exception 'ALLOC GATE [AC4]: experiment_status sem label %', lbl;
    end if;
  end loop;

  -- AC5: triggers set_updated_at
  select exists (select 1 from pg_trigger
    where tgrelid='public.allocations'::regclass and not tgisinternal
      and tgname='trg_allocations_updated_at') into has_trigger;
  if not has_trigger then raise exception 'ALLOC GATE [AC5]: trigger ausente em allocations'; end if;

  select exists (select 1 from pg_trigger
    where tgrelid='public.experiments'::regclass and not tgisinternal
      and tgname='trg_experiments_updated_at') into has_trigger;
  if not has_trigger then raise exception 'ALLOC GATE [AC5]: trigger ausente em experiments'; end if;

  -- AC6: RLS habilitada + policy nas três tabelas
  foreach t in array array['allocations','allocation_items','experiments'] loop
    select relrowsecurity into has_rls from pg_class where oid = format('public.%I', t)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'ALLOC GATE [AC6]: % sem RLS habilitado', t;
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t) then
      raise exception 'ALLOC GATE [AC6]: % sem policy de RLS', t;
    end if;
  end loop;

  raise notice 'ALLOC GATE Story 5.1: OK — tabelas, FKs, enums, triggers e RLS verificados.';
end $$;

-- ============================================================================
-- Fim — Modelo de alocação e experimentos (Story 5.1).
-- ============================================================================
