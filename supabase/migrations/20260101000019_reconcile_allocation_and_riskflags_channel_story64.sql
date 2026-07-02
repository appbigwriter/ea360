-- ============================================================================
-- EA360 — Migração 0019: Reconciliação do schema de alocação + risk_flags.channel
-- ----------------------------------------------------------------------------
-- CONTEXTO (drift detectado ao provisionar o DB real):
--   A migração 0000 (init) criou um ESQUELETO simples de allocations /
--   allocation_items (tier/share_pct, sem recommendation_id/status/risk_band) e os
--   enums allocation_tier/flag_level. As migrações de story (0015+) usaram
--   `create table if not exists` + DO blocks e NÃO foram aplicadas ao DB real — os
--   enums allocation_status/risk_band e as colunas ricas que o CÓDIGO espera
--   (Stories 5.x/6.x) estavam ausentes. Resultado: o runtime não rodava contra o DB.
--
-- Esta migração é PURAMENTE ADITIVA e IDEMPOTENTE: cria os enums faltantes e adiciona
-- apenas as colunas que o código existente já lê/escreve, alinhando o DB ao contrato
-- do código. Não remove nada; colunas legadas (tier, share_pct, split_*) permanecem.
--
-- Inclui ainda `risk_flags.channel_id` (Story 6.4 — AC6: persistir flag por canal).
--
-- Article IV: nenhuma coluna/enum é "inventada" — todos rastreiam a 0015/0017/0018
-- e ao uso real do código (PRD §8 / R4 / R5).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Enums faltantes (0015 nunca aplicou seus DO blocks no DB real).
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'allocation_status') then
    create type allocation_status as enum ('draft', 'active', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_band') then
    create type risk_band as enum ('core', 'growth', 'experiment');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. allocations — colunas esperadas pelo código (0015 / actions.ts).
-- ----------------------------------------------------------------------------
alter table public.allocations
  add column if not exists recommendation_id uuid references public.recommendations (id) on delete set null;

do $$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='allocations' and column_name='status') then
    alter table public.allocations add column status allocation_status not null default 'draft';
  end if;
end $$;

alter table public.allocations
  add column if not exists risk_band_ratios jsonb not null default '{"core": 70, "growth": 20, "experiment": 10}'::jsonb;

create index if not exists idx_allocations_recommendation_id on public.allocations (recommendation_id);

-- ----------------------------------------------------------------------------
-- 2. allocation_items — colunas esperadas pelo código (percentage, risk_band,
--    ceiling_pct). `tier` (legado, NOT NULL) fica NULLABLE para o INSERT do código
--    (que usa risk_band) não falhar. `share_pct` legado permanece.
-- ----------------------------------------------------------------------------
alter table public.allocation_items
  add column if not exists percentage numeric not null default 0 check (percentage >= 0 and percentage <= 100);

do $$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='allocation_items' and column_name='risk_band') then
    alter table public.allocation_items add column risk_band risk_band not null default 'core';
  end if;
end $$;

alter table public.allocation_items
  add column if not exists ceiling_pct numeric check (ceiling_pct is null or (ceiling_pct >= 0 and ceiling_pct <= 100));

-- `tier` legado (0000) era NOT NULL sem default; o código usa risk_band. Permite NULL.
do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='allocation_items'
        and column_name='tier' and is_nullable='NO') then
    alter table public.allocation_items alter column tier drop not null;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. risk_flags — `channel_id` (Story 6.4 — AC6: flag por canal). Nullable: flags
--    de carteira (ex.: downside total) não têm canal específico.
-- ----------------------------------------------------------------------------
alter table public.risk_flags
  add column if not exists channel_id uuid references public.gom_channels (id) on delete cascade;

create index if not exists idx_risk_flags_channel on public.risk_flags (channel_id);

-- ----------------------------------------------------------------------------
-- 4. GATE de verificação — falha o push se o schema não bater com o código.
-- ----------------------------------------------------------------------------
do $$
declare
  missing text;
  alloc_cols text[] := array['recommendation_id','status','risk_band_ratios','guardrail_config'];
  item_cols  text[] := array['percentage','risk_band','ceiling_pct','downside_estimate'];
begin
  foreach missing in array alloc_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='allocations' and column_name=missing) then
      raise exception 'RECONCILE GATE: allocations sem coluna %', missing;
    end if;
  end loop;

  foreach missing in array item_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='allocation_items' and column_name=missing) then
      raise exception 'RECONCILE GATE: allocation_items sem coluna %', missing;
    end if;
  end loop;

  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='risk_flags' and column_name='channel_id') then
    raise exception 'RECONCILE GATE [6.4]: risk_flags sem channel_id';
  end if;

  raise notice 'RECONCILE GATE 0019: OK — schema de alocação + risk_flags.channel_id alinhados ao código.';
end $$;

-- ============================================================================
-- Fim — Reconciliação do schema (Stories 5.x/6.x) + risk_flags.channel_id (6.4).
-- ============================================================================
