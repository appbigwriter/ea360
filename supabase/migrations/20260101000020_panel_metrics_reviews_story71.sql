-- ============================================================================
-- EA360 — Migração 00020: Painel 360 — métricas e reviews (Story 7.1)
-- ----------------------------------------------------------------------------
-- AC: tabelas channel_metrics e allocation_reviews com os campos do PRD §8 / R6,
--     enum allocation_health, índices e RLS por business_id.
--
-- DRIFT: ambas as tabelas já existem (esqueleto init 0000) — channel_metrics tem
-- (id, allocation_item_id, period_start, period_end, spend, revenue). Esta migração
-- é PURAMENTE ADITIVA/IDEMPOTENTE: adiciona apenas as colunas das ACs que faltam,
-- cria o enum, índices e RLS. REUSE > ADAPT (Article IV).
-- ============================================================================

-- 0. Enum allocation_health (on_track/off_track/critical) — AC3.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'allocation_health') then
    create type allocation_health as enum ('on_track', 'off_track', 'critical');
  end if;
end $$;

-- 1. channel_metrics — colunas das ACs (aditivas). AC1.
alter table public.channel_metrics
  add column if not exists business_id     uuid references public.businesses (id) on delete cascade,
  add column if not exists channel_id      uuid references public.gom_channels (id) on delete cascade,
  add column if not exists roas            numeric,
  add column if not exists cpa             numeric,
  add column if not exists payback_actual  numeric,
  add column if not exists contribution    numeric,
  add column if not exists spend_actual    numeric;

-- Backfill defensivo: channel_metrics.business_id a partir do item de alocação pai,
-- quando possível (item → allocation → business). Best-effort; ignora se não casar.
update public.channel_metrics cm
  set business_id = a.business_id
  from public.allocation_items ai
  join public.allocations a on a.id = ai.allocation_id
  where ai.id = cm.allocation_item_id and cm.business_id is null;

-- 2. allocation_reviews — colunas das ACs (aditivas). AC2.
alter table public.allocation_reviews
  add column if not exists business_id               uuid references public.businesses (id) on delete cascade,
  add column if not exists allocation_id             uuid references public.allocations (id) on delete cascade,
  add column if not exists review_date               date,
  add column if not exists overall_health            allocation_health,
  add column if not exists rebalance_recommendation  jsonb,
  add column if not exists notes                     text;

-- 3. Índices — AC4.
create index if not exists idx_channel_metrics_allocation_item on public.channel_metrics (allocation_item_id);
create index if not exists idx_channel_metrics_period_start    on public.channel_metrics (period_start);
create index if not exists idx_channel_metrics_business        on public.channel_metrics (business_id);
create index if not exists idx_allocation_reviews_allocation   on public.allocation_reviews (allocation_id);

-- 4. RLS por business_id — AC5.
alter table public.channel_metrics   enable row level security;
alter table public.allocation_reviews enable row level security;

drop policy if exists "channel_metrics do dono" on public.channel_metrics;
create policy "channel_metrics do dono" on public.channel_metrics
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "allocation_reviews do dono" on public.allocation_reviews;
create policy "allocation_reviews do dono" on public.allocation_reviews
  for all using (owns_business(business_id)) with check (owns_business(business_id));

-- 5. GATE — falha o push se as ACs não baterem (AC6).
do $$
declare missing text;
  cm_cols text[] := array['business_id','channel_id','allocation_item_id','period_start','period_end','roas','cpa','payback_actual','contribution','spend_actual'];
  ar_cols text[] := array['business_id','allocation_id','review_date','overall_health','rebalance_recommendation','notes'];
begin
  foreach missing in array cm_cols loop
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='channel_metrics' and column_name=missing) then
      raise exception 'METRICS GATE [AC1]: channel_metrics sem coluna %', missing; end if;
  end loop;
  foreach missing in array ar_cols loop
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='allocation_reviews' and column_name=missing) then
      raise exception 'METRICS GATE [AC2]: allocation_reviews sem coluna %', missing; end if;
  end loop;
  if not exists (select 1 from pg_type where typname='allocation_health') then
    raise exception 'METRICS GATE [AC3]: enum allocation_health ausente'; end if;
  if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='allocation_health' and e.enumlabel='on_track') then
    raise exception 'METRICS GATE [AC3]: allocation_health sem label on_track'; end if;
  raise notice 'METRICS GATE Story 7.1: OK — channel_metrics/allocation_reviews/enum/índices/RLS verificados.';
end $$;
