-- ============================================================================
-- EA360 — Migração 0002: RLS policies (reforço e complemento)
-- Idempotente. Re-assegura isolamento por usuário, leitura pública do GOM e
-- regras do Oráculo. Complementa as policies já criadas em 20260101000000.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Garantir RLS habilitado em todas as tabelas (idempotente)
-- ----------------------------------------------------------------------------
alter table profiles               enable row level security;
alter table businesses             enable row level security;
alter table interviews             enable row level security;
alter table interview_answers      enable row level security;
alter table monetization_profiles  enable row level security;
alter table recommendations        enable row level security;
alter table recommendation_items   enable row level security;
alter table allocations            enable row level security;
alter table allocation_items       enable row level security;
alter table experiments            enable row level security;
alter table risk_flags             enable row level security;
alter table channel_metrics        enable row level security;
alter table allocation_reviews     enable row level security;
alter table compliance_checks      enable row level security;
alter table gom_pillars            enable row level security;
alter table gom_categories         enable row level security;
alter table gom_channels           enable row level security;
alter table interview_questions    enable row level security;
alter table oracle_documents       enable row level security;

-- ----------------------------------------------------------------------------
-- 1. Helper: o negócio pertence ao usuário autenticado?
--    (recriado por segurança — security definer para evitar recursão de RLS)
-- ----------------------------------------------------------------------------
create or replace function owns_business(b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from businesses where id = b and owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. Identidade — perfil próprio
-- ----------------------------------------------------------------------------
drop policy if exists "perfil próprio" on profiles;
drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_delete_own" on profiles;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on profiles
  for delete using (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Negócios do dono
-- ----------------------------------------------------------------------------
drop policy if exists "negócios do dono" on businesses;
drop policy if exists "businesses_owner_all" on businesses;
create policy "businesses_owner_all" on businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. Tabelas ligadas direto a business_id
-- ----------------------------------------------------------------------------
drop policy if exists "interviews do dono" on interviews;
drop policy if exists "interviews_owner_all" on interviews;
create policy "interviews_owner_all" on interviews
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "monet_profiles do dono" on monetization_profiles;
drop policy if exists "monetization_profiles_owner_all" on monetization_profiles;
create policy "monetization_profiles_owner_all" on monetization_profiles
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "recommendations do dono" on recommendations;
drop policy if exists "recommendations_owner_all" on recommendations;
create policy "recommendations_owner_all" on recommendations
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "allocations do dono" on allocations;
drop policy if exists "allocations_owner_all" on allocations;
create policy "allocations_owner_all" on allocations
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "compliance do dono" on compliance_checks;
drop policy if exists "compliance_checks_owner_all" on compliance_checks;
create policy "compliance_checks_owner_all" on compliance_checks
  for all using (owns_business(business_id)) with check (owns_business(business_id));

-- ----------------------------------------------------------------------------
-- 5. Tabelas filhas indiretas (via FK em cadeia)
-- ----------------------------------------------------------------------------
drop policy if exists "interview_answers do dono" on interview_answers;
drop policy if exists "interview_answers_owner_all" on interview_answers;
create policy "interview_answers_owner_all" on interview_answers
  for all using (
    exists (select 1 from interviews i
            where i.id = interview_answers.interview_id and owns_business(i.business_id))
  ) with check (
    exists (select 1 from interviews i
            where i.id = interview_answers.interview_id and owns_business(i.business_id))
  );

drop policy if exists "rec_items do dono" on recommendation_items;
drop policy if exists "recommendation_items_owner_all" on recommendation_items;
create policy "recommendation_items_owner_all" on recommendation_items
  for all using (
    exists (select 1 from recommendations r
            where r.id = recommendation_items.recommendation_id and owns_business(r.business_id))
  ) with check (
    exists (select 1 from recommendations r
            where r.id = recommendation_items.recommendation_id and owns_business(r.business_id))
  );

drop policy if exists "alloc_items do dono" on allocation_items;
drop policy if exists "allocation_items_owner_all" on allocation_items;
create policy "allocation_items_owner_all" on allocation_items
  for all using (
    exists (select 1 from allocations a
            where a.id = allocation_items.allocation_id and owns_business(a.business_id))
  ) with check (
    exists (select 1 from allocations a
            where a.id = allocation_items.allocation_id and owns_business(a.business_id))
  );

drop policy if exists "experiments do dono" on experiments;
drop policy if exists "experiments_owner_all" on experiments;
create policy "experiments_owner_all" on experiments
  for all using (
    exists (select 1 from allocation_items ai
            join allocations a on a.id = ai.allocation_id
            where ai.id = experiments.allocation_item_id and owns_business(a.business_id))
  ) with check (
    exists (select 1 from allocation_items ai
            join allocations a on a.id = ai.allocation_id
            where ai.id = experiments.allocation_item_id and owns_business(a.business_id))
  );

drop policy if exists "risk_flags do dono" on risk_flags;
drop policy if exists "risk_flags_owner_all" on risk_flags;
create policy "risk_flags_owner_all" on risk_flags
  for all using (
    exists (select 1 from allocations a
            where a.id = risk_flags.allocation_id and owns_business(a.business_id))
  ) with check (
    exists (select 1 from allocations a
            where a.id = risk_flags.allocation_id and owns_business(a.business_id))
  );

drop policy if exists "metrics do dono" on channel_metrics;
drop policy if exists "channel_metrics_owner_all" on channel_metrics;
create policy "channel_metrics_owner_all" on channel_metrics
  for all using (
    exists (select 1 from allocation_items ai
            join allocations a on a.id = ai.allocation_id
            where ai.id = channel_metrics.allocation_item_id and owns_business(a.business_id))
  ) with check (
    exists (select 1 from allocation_items ai
            join allocations a on a.id = ai.allocation_id
            where ai.id = channel_metrics.allocation_item_id and owns_business(a.business_id))
  );

drop policy if exists "allocation_reviews do dono" on allocation_reviews;
drop policy if exists "allocation_reviews_owner_all" on allocation_reviews;
create policy "allocation_reviews_owner_all" on allocation_reviews
  for all using (
    exists (select 1 from allocations a
            where a.id = allocation_reviews.allocation_id and owns_business(a.business_id))
  ) with check (
    exists (select 1 from allocations a
            where a.id = allocation_reviews.allocation_id and owns_business(a.business_id))
  );

-- ----------------------------------------------------------------------------
-- 6. GOM e perguntas — leitura pública (anon + authenticated), sem escrita
-- ----------------------------------------------------------------------------
drop policy if exists "gom pilares públicos" on gom_pillars;
drop policy if exists "gom_pillars_public_read" on gom_pillars;
create policy "gom_pillars_public_read" on gom_pillars for select using (true);

drop policy if exists "gom categorias públicas" on gom_categories;
drop policy if exists "gom_categories_public_read" on gom_categories;
create policy "gom_categories_public_read" on gom_categories for select using (true);

drop policy if exists "gom canais públicos" on gom_channels;
drop policy if exists "gom_channels_public_read" on gom_channels;
create policy "gom_channels_public_read" on gom_channels for select using (true);

drop policy if exists "perguntas públicas" on interview_questions;
drop policy if exists "interview_questions_public_read" on interview_questions;
create policy "interview_questions_public_read" on interview_questions for select using (true);

-- ----------------------------------------------------------------------------
-- 7. Oráculo — leitura pública, escrita apenas via service role
--    (a service_role bypassa RLS; nenhuma policy de escrita p/ anon/auth)
-- ----------------------------------------------------------------------------
drop policy if exists "oracle_documents_public_read" on oracle_documents;
create policy "oracle_documents_public_read" on oracle_documents
  for select using (true);
-- Sem policies de INSERT/UPDATE/DELETE: somente service_role (bypass RLS) escreve.

-- ============================================================================
-- Fim — RLS policies EA360.
-- ============================================================================
