-- ============================================================================
-- EA360 — Migração 00022: Tabela whatsapp_templates — Forja de copy (Story 8.2)
-- ----------------------------------------------------------------------------
-- AC2/AC4: templates WhatsApp Business com category Meta, salvos por funil.
-- ============================================================================
create table if not exists public.whatsapp_templates (
  id            uuid primary key default gen_random_uuid(),
  funnel_id     uuid not null references public.funnels (id) on delete cascade,
  business_id   uuid not null references public.businesses (id) on delete cascade,
  name          text not null,
  category      text not null check (category in ('UTILITY','MARKETING','AUTHENTICATION')),
  language      text not null default 'pt_BR',
  stage         text,
  body_text     text not null,
  header_text   text,
  footer_text   text,
  buttons       jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_wa_templates_funnel   on public.whatsapp_templates (funnel_id);
create index if not exists idx_wa_templates_business on public.whatsapp_templates (business_id);

alter table public.whatsapp_templates enable row level security;
drop policy if exists "wa_templates do dono" on public.whatsapp_templates;
create policy "wa_templates do dono" on public.whatsapp_templates
  for all using (owns_business(business_id)) with check (owns_business(business_id));

do $$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema='public' and table_name='whatsapp_templates' and column_name='category') then
    raise exception 'WA TEMPLATE GATE [AC2]: whatsapp_templates sem coluna category';
  end if;
  raise notice 'WA TEMPLATE GATE Story 8.2: OK — tabela + category check + RLS.';
end $$;
