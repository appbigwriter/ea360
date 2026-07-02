-- ============================================================================
-- EA360 — Migração 00024: compliance_checks — Blindagem anti-ban (Story 8.3)
-- ----------------------------------------------------------------------------
-- AC3: compliance_checks com template_id, check_type, status, issues(JSONB), flag_level.
-- DRIFT: a tabela já existe no esqueleto init 0000. ADITIVA/IDEMPOTENTE. Depende de
-- 00023 (labels EN de flag_level) para o default 'green'.
-- ============================================================================
create table if not exists public.compliance_checks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now()
);

alter table public.compliance_checks
  add column if not exists template_id  uuid references public.whatsapp_templates (id) on delete cascade,
  add column if not exists business_id  uuid references public.businesses (id) on delete cascade,
  add column if not exists check_type   text not null default 'anti-ban',
  add column if not exists status       text,
  add column if not exists flag_level   flag_level not null default 'green',
  add column if not exists issues       jsonb not null default '[]'::jsonb;

create index if not exists idx_compliance_template on public.compliance_checks (template_id);
create index if not exists idx_compliance_business on public.compliance_checks (business_id);

alter table public.compliance_checks enable row level security;
drop policy if exists "compliance do dono" on public.compliance_checks;
create policy "compliance do dono" on public.compliance_checks
  for all using (owns_business(business_id)) with check (owns_business(business_id));

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='compliance_checks' and column_name='issues') then
    raise exception 'COMPLIANCE GATE [AC3]: compliance_checks sem coluna issues';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='compliance_checks' and column_name='template_id') then
    raise exception 'COMPLIANCE GATE [AC3]: compliance_checks sem coluna template_id';
  end if;
  raise notice 'COMPLIANCE GATE Story 8.3: OK — colunas + índices + RLS.';
end $$;
