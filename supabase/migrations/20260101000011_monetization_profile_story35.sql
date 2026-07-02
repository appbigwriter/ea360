-- ============================================================================
-- EA360 — Migração 0011: Perfil de Monetização (Story 3.5)
-- ----------------------------------------------------------------------------
-- AC da Story 3.5:
--   AC1: ao completar a entrevista, sistema chama LLM para gerar um perfil de
--        monetização estruturado (JSON) — feito na app (Server Action).
--   AC2: perfil salvo em monetization_profiles com interview_id (FK) e
--        business_id.
--   AC3: perfil é um objeto JSON consultável com campos objectives, philosophy,
--        current_stage, resources, excluded_channels.
--   AC4: tabela monetization_profiles com id, business_id, interview_id,
--        profile_data (JSONB), created_at, updated_at.
--   AC6: fallback sem LLM → perfil criado com dados brutos das respostas e flag
--        is_llm_generated = false.
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE: a tabela monetization_profiles já existe em
--          20260101000000_init_ea360.sql com id/business_id/interview_id/
--          created_at/updated_at, índice por business_id, trigger de updated_at
--          e policy de RLS "monet_profiles do dono" (via owns_business()).
--          Renomear/recriar quebraria fn_channel_score/fn_match_channels (que
--          dependem do row-type da tabela), o seed e a RLS — regressão (No
--          Invention / no regression).
--   ADAPT (aditivo, < 30%): apenas DUAS colunas novas exigidas pelos AC3/AC4/AC6
--          que ainda não existiam: profile_data (jsonb) e is_llm_generated
--          (boolean). Nada existente é alterado. As colunas estruturadas legadas
--          (goals/horizon/risk_tolerance/...) permanecem intactas para o
--          matchmaking (fn_channel_score). O objeto consultável do AC3 vive em
--          profile_data.
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0006/0009/0010).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC4 — profile_data (JSONB consultável) + AC6 — is_llm_generated.
-- ----------------------------------------------------------------------------
alter table public.monetization_profiles
  add column if not exists profile_data jsonb not null default '{}'::jsonb;

alter table public.monetization_profiles
  add column if not exists is_llm_generated boolean not null default true;

-- AC3: índice GIN para tornar profile_data consultável de forma eficiente pelas
-- stories de matchmaking (E-MENU) — ex.: filtrar por excluded_channels.
create index if not exists idx_monet_profiles_profile_data
  on public.monetization_profiles using gin (profile_data);

-- AC2: índice por interview_id (FK) — consulta "perfil desta entrevista".
create index if not exists idx_monet_profiles_interview_id
  on public.monetization_profiles (interview_id);

-- ----------------------------------------------------------------------------
-- 2. GATE de verificação — falha o `supabase db push` se algo não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  v_profile_data_ok boolean;
  v_flag_ok boolean;
  v_business_fk_ok boolean;
  v_interview_fk_ok boolean;
  v_rls_ok boolean;
begin
  -- AC4: profile_data jsonb existe.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monetization_profiles'
      and column_name = 'profile_data'
      and data_type = 'jsonb'
  ) into v_profile_data_ok;
  if not v_profile_data_ok then
    raise exception 'MONET GATE [AC4]: coluna profile_data (jsonb) ausente';
  end if;

  -- AC6: is_llm_generated boolean existe.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'monetization_profiles'
      and column_name = 'is_llm_generated'
      and data_type = 'boolean'
  ) into v_flag_ok;
  if not v_flag_ok then
    raise exception 'MONET GATE [AC6]: coluna is_llm_generated (boolean) ausente';
  end if;

  -- AC2/AC4: FK business_id → businesses.
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = 'monetization_profiles'
      and kcu.column_name = 'business_id'
  ) into v_business_fk_ok;
  if not v_business_fk_ok then
    raise exception 'MONET GATE [AC2]: FK business_id ausente';
  end if;

  -- AC2: FK interview_id → interviews.
  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and tc.table_name = 'monetization_profiles'
      and kcu.column_name = 'interview_id'
  ) into v_interview_fk_ok;
  if not v_interview_fk_ok then
    raise exception 'MONET GATE [AC2]: FK interview_id ausente';
  end if;

  -- RLS habilitada (isolamento por dono — preserva a policy de init).
  select relrowsecurity into v_rls_ok
  from pg_class
  where oid = 'public.monetization_profiles'::regclass;
  if not coalesce(v_rls_ok, false) then
    raise exception 'MONET GATE: RLS desabilitada em monetization_profiles';
  end if;

  raise notice 'MONET GATE Story 3.5: OK — profile_data, is_llm_generated, FKs e RLS verificados.';
end $$;

-- ============================================================================
-- Fim — Perfil de Monetização (Story 3.5).
-- ============================================================================
