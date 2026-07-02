-- ============================================================================
-- EA360 — Migração 00021: Tabela funnels — Arquiteto de funil (Story 8.1)
-- ----------------------------------------------------------------------------
-- AC4: funil gerado salvo associado ao business_id. AC6: bot_disclosure obrigatório.
-- DRIFT: tabela nova (CREATE). Idempotente. RLS por business (owns_business).
-- ============================================================================
create table if not exists public.funnels (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  objective       text,
  product         text,
  audience        text,
  cta             text,
  bot_disclosure  text not null,
  structure       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_funnels_business on public.funnels (business_id);

drop trigger if exists trg_funnels_updated_at on public.funnels;
create trigger trg_funnels_updated_at
  before update on public.funnels
  for each row execute function set_updated_at();

alter table public.funnels enable row level security;
drop policy if exists "funnels do dono" on public.funnels;
create policy "funnels do dono" on public.funnels
  for all using (owns_business(business_id)) with check (owns_business(business_id));

do $$
begin
  if exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='funnels' and column_name='bot_disclosure' and is_nullable='YES') then
    raise exception 'FUNNEL GATE [AC6]: funnels.bot_disclosure deve ser NOT NULL';
  end if;
  raise notice 'FUNNEL GATE Story 8.1: OK — tabela funnels + bot_disclosure NOT NULL + RLS.';
end $$;
