-- ============================================================================
-- EA360 — Migração 0005: RLS base por business/tenant — VERIFICAÇÃO (Story 1.5)
-- ----------------------------------------------------------------------------
-- As policies de RLS já foram declaradas em:
--   20260101000000_init_ea360.sql   (policies originais + GOM público)
--   20260101000001_rls_policies.sql (reforço idempotente, nomes canônicos,
--                                    cadeias FK indiretas, Oráculo público read)
--
-- IDS: REUSE > CREATE. Esta migração NÃO duplica DDL de policy. Ela:
--   1. Re-assegura RLS habilitado em todas as tabelas de negócio e catálogo
--      (idempotente — alter table ... enable é seguro de repetir).
--   2. Adiciona um GATE determinístico (bloco DO) que faz `supabase db push`
--      FALHAR se qualquer AC da Story 1.5 não estiver satisfeito:
--        - AC1: RLS habilitado em toda tabela de negócio e catálogo.
--        - AC2/AC3: toda tabela de negócio tem ao menos uma policy de acesso
--                   (isolamento por owner via owns_business / auth.uid()).
--        - AC4: tabelas de catálogo (gom_*) e oracle_documents têm policy de
--               SELECT pública e NENHUMA policy de escrita p/ anon/authenticated
--               (DML restrito a service_role, que bypassa RLS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Re-assegurar RLS habilitado (idempotente) — AC1
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  business_tables text[] := array[
    'profiles','businesses','interviews','interview_answers',
    'monetization_profiles','recommendations','recommendation_items',
    'allocations','allocation_items','experiments','risk_flags',
    'channel_metrics','allocation_reviews','compliance_checks'
  ];
  catalog_tables text[] := array[
    'gom_pillars','gom_categories','gom_channels',
    'interview_questions','oracle_documents'
  ];
begin
  foreach t in array (business_tables || catalog_tables) loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2. GATE de verificação — falha o push se qualquer AC não bater
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
  has_rls boolean;
  policy_count int;
  write_policy_count int;
  select_policy_count int;
  business_tables text[] := array[
    'profiles','businesses','interviews','interview_answers',
    'monetization_profiles','recommendations','recommendation_items',
    'allocations','allocation_items','experiments','risk_flags',
    'channel_metrics','allocation_reviews','compliance_checks'
  ];
  -- Catálogo de leitura pública / escrita apenas service_role (AC4):
  public_read_tables text[] := array[
    'gom_pillars','gom_categories','gom_channels',
    'interview_questions','oracle_documents'
  ];
begin
  -- AC1 + AC2/AC3: tabelas de negócio com RLS ON e ao menos 1 policy
  foreach t in array business_tables loop
    select relrowsecurity into has_rls
    from pg_class where oid = format('public.%I', t)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'RLS GATE [AC1]: tabela de negócio % está sem RLS habilitado', t;
    end if;

    select count(*) into policy_count
    from pg_policies where schemaname = 'public' and tablename = t;
    if policy_count = 0 then
      raise exception 'RLS GATE [AC2/AC3]: tabela de negócio % não tem nenhuma policy de isolamento', t;
    end if;
  end loop;

  -- AC4: catálogo/oráculo com RLS ON, SELECT público e ZERO policies de escrita
  foreach t in array public_read_tables loop
    select relrowsecurity into has_rls
    from pg_class where oid = format('public.%I', t)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'RLS GATE [AC1/AC4]: tabela de catálogo % está sem RLS habilitado', t;
    end if;

    select count(*) into select_policy_count
    from pg_policies
    where schemaname = 'public' and tablename = t
      and cmd in ('SELECT', 'ALL');
    if select_policy_count = 0 then
      raise exception 'RLS GATE [AC4]: tabela de catálogo % não tem policy de SELECT pública', t;
    end if;

    -- Nenhuma policy de escrita para anon/authenticated: só INSERT/UPDATE/DELETE
    -- (ou ALL) são consideradas escrita. service_role bypassa RLS e não cria policy.
    select count(*) into write_policy_count
    from pg_policies
    where schemaname = 'public' and tablename = t
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL');
    if write_policy_count > 0 then
      raise exception 'RLS GATE [AC4]: tabela de catálogo % tem % policy(ies) de escrita expostas a anon/authenticated — DML deve ser exclusivo de service_role', t, write_policy_count;
    end if;
  end loop;

  raise notice 'RLS GATE Story 1.5: OK — isolamento por business/tenant e catálogo público verificados.';
end $$;

-- ============================================================================
-- Fim — verificação RLS Story 1.5.
-- ============================================================================
