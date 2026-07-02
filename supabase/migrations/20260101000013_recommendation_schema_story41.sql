-- ============================================================================
-- EA360 — Migração 0013: Modelo de dados de recomendação (Story 4.1)
-- ----------------------------------------------------------------------------
-- AC da Story 4.1:
--   AC1: recommendations com id, business_id (FK businesses), profile_id
--        (FK monetization_profiles), status (enum draft/active/archived),
--        created_at, updated_at.
--   AC2: recommendation_items com id, recommendation_id (FK), channel_id
--        (FK gom_channels), match_score (numeric), estimated_spend (numeric),
--        return_range_min/max (numeric), payback_months (numeric),
--        risk_score (numeric), rationale (text), fit_reason (text),
--        avoid_reason (text), rank_position (integer), created_at.
--   AC3: enum de status de recomendação.
--   AC4: trigger set_updated_at() em recommendations.
--   AC5: RLS — usuário acessa apenas recomendações do seu business_id.
--   AC6: migração aplicada sem erros (`supabase db push`).
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE: as tabelas recommendations e recommendation_items JÁ existem
--          (20260101000000_init_ea360.sql) com FKs, índices por business_id /
--          recommendation_id, RLS via owns_business() ("recommendations do dono",
--          "rec_items do dono") e o enum recommendation_status já criado.
--          O trigger set_updated_at() e a função owns_business() também já existem.
--          Recriar/renomear quebraria a RLS, os índices e futuras stories de
--          matchmaking (fn_match_channels, Story 4.2/4.4) — regressão proibida
--          (No Invention / no regression).
--   ADAPT (aditivo, < 30%):
--     1. recommendations: adicionar updated_at + trigger set_updated_at (AC1/AC4).
--     2. recommendation_status: adicionar os labels canônicos do AC3
--        (draft/active/archived) ao enum existente (gerada/revisada/arquivada),
--        sem remover os legados — preserva o default e dados existentes.
--     3. recommendation_items: expor os nomes de coluna canônicos do AC2 como
--        colunas GERADAS mapeadas às existentes onde há equivalência semântica
--        (match_score := score, fit_reason := rationale_fit,
--         avoid_reason := rationale_avoid, rank_position := rank), e adicionar as
--        colunas exigidas pelo AC que ainda não existiam (estimated_spend,
--        return_range_min/max, payback_months, risk_score, rationale, created_at).
--     4. RLS re-assegurada (idempotente) — AC5.
--     5. GATE determinístico — falha o push se algum AC não bater (AC6).
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0006/0011).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC3 — labels canônicos do enum de status (aditivo, preserva legados).
--    ADD VALUE não pode rodar dentro de bloco transacional implícito junto com
--    uso imediato; por isso fica no topo, isolado e idempotente (IF NOT EXISTS).
-- ----------------------------------------------------------------------------
alter type recommendation_status add value if not exists 'draft';
alter type recommendation_status add value if not exists 'active';
alter type recommendation_status add value if not exists 'archived';

-- ----------------------------------------------------------------------------
-- 2. AC1/AC4 — updated_at + trigger set_updated_at em recommendations.
-- ----------------------------------------------------------------------------
alter table public.recommendations
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_recommendations_updated_at on public.recommendations;
create trigger trg_recommendations_updated_at
  before update on public.recommendations
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. AC2 — recommendation_items: colunas canônicas do AC.
--    3a. Equivalências semânticas -> colunas GERADAS (sem duplicar verdade nem
--        quebrar consumidores que usam os nomes legados).
-- ----------------------------------------------------------------------------
alter table public.recommendation_items
  add column if not exists match_score   numeric generated always as (score)           stored;
alter table public.recommendation_items
  add column if not exists fit_reason    text    generated always as (rationale_fit)    stored;
alter table public.recommendation_items
  add column if not exists avoid_reason  text    generated always as (rationale_avoid)  stored;
alter table public.recommendation_items
  add column if not exists rank_position int     generated always as (rank)             stored;

-- 3b. Colunas exigidas pelo AC2 que ainda não existiam (aditivas).
alter table public.recommendation_items
  add column if not exists estimated_spend   numeric;
alter table public.recommendation_items
  add column if not exists return_range_min  numeric;
alter table public.recommendation_items
  add column if not exists return_range_max  numeric;
alter table public.recommendation_items
  add column if not exists payback_months    numeric;
alter table public.recommendation_items
  add column if not exists risk_score        numeric;
alter table public.recommendation_items
  add column if not exists rationale         text;
alter table public.recommendation_items
  add column if not exists created_at        timestamptz not null default now();

-- ----------------------------------------------------------------------------
-- 4. AC5 — RLS por business_id (idempotente). Preserva as policies de init via
--    owns_business(); re-assegura habilitação.
-- ----------------------------------------------------------------------------
alter table public.recommendations      enable row level security;
alter table public.recommendation_items enable row level security;

drop policy if exists "recommendations do dono" on public.recommendations;
create policy "recommendations do dono" on public.recommendations
  for all using (owns_business(business_id)) with check (owns_business(business_id));

drop policy if exists "rec_items do dono" on public.recommendation_items;
create policy "rec_items do dono" on public.recommendation_items
  for all using (
    exists (
      select 1 from public.recommendations r
      where r.id = recommendation_items.recommendation_id
        and owns_business(r.business_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 5. GATE de verificação — falha o `supabase db push` se algum AC não bater (AC6).
-- ----------------------------------------------------------------------------
do $$
declare
  missing text;
  has_rls boolean;
  rec_cols text[] := array['id','business_id','profile_id','status','created_at','updated_at'];
  item_cols text[] := array[
    'id','recommendation_id','channel_id','match_score','estimated_spend',
    'return_range_min','return_range_max','payback_months','risk_score',
    'rationale','fit_reason','avoid_reason','rank_position','created_at'
  ];
  enum_labels text[] := array['draft','active','archived'];
  lbl text;
  t text;
  has_trigger boolean;
  fk_ok boolean;
begin
  -- AC1: campos de recommendations
  foreach missing in array rec_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='recommendations' and column_name=missing) then
      raise exception 'REC GATE [AC1]: recommendations sem coluna %', missing;
    end if;
  end loop;

  -- AC1: FKs business_id e profile_id
  select exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
      and tc.table_name='recommendations' and kcu.column_name='business_id'
  ) into fk_ok;
  if not fk_ok then raise exception 'REC GATE [AC1]: FK business_id ausente'; end if;

  select exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
      and tc.table_name='recommendations' and kcu.column_name='profile_id'
  ) into fk_ok;
  if not fk_ok then raise exception 'REC GATE [AC1]: FK profile_id ausente'; end if;

  -- AC2: campos de recommendation_items
  foreach missing in array item_cols loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='recommendation_items' and column_name=missing) then
      raise exception 'REC GATE [AC2]: recommendation_items sem coluna %', missing;
    end if;
  end loop;

  -- AC2: FKs recommendation_id e channel_id
  select exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
      and tc.table_name='recommendation_items' and kcu.column_name='recommendation_id'
  ) into fk_ok;
  if not fk_ok then raise exception 'REC GATE [AC2]: FK recommendation_id ausente'; end if;

  select exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    where tc.constraint_type='FOREIGN KEY' and tc.table_schema='public'
      and tc.table_name='recommendation_items' and kcu.column_name='channel_id'
  ) into fk_ok;
  if not fk_ok then raise exception 'REC GATE [AC2]: FK channel_id ausente'; end if;

  -- AC3: enum com labels canônicos
  foreach lbl in array enum_labels loop
    if not exists (
      select 1 from pg_enum e
      join pg_type ty on ty.oid = e.enumtypid
      where ty.typname = 'recommendation_status' and e.enumlabel = lbl
    ) then
      raise exception 'REC GATE [AC3]: enum recommendation_status sem label %', lbl;
    end if;
  end loop;

  -- AC4: trigger set_updated_at em recommendations
  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.recommendations'::regclass
      and not tgisinternal
      and tgname = 'trg_recommendations_updated_at'
  ) into has_trigger;
  if not has_trigger then
    raise exception 'REC GATE [AC4]: trigger set_updated_at ausente em recommendations';
  end if;

  -- AC5: RLS habilitada nas duas tabelas
  foreach t in array array['recommendations','recommendation_items'] loop
    select relrowsecurity into has_rls from pg_class where oid = format('public.%I', t)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'REC GATE [AC5]: % sem RLS habilitado', t;
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t) then
      raise exception 'REC GATE [AC5]: % sem policy de RLS', t;
    end if;
  end loop;

  raise notice 'REC GATE Story 4.1: OK — tabelas, FKs, enum, trigger e RLS verificados.';
end $$;

-- ============================================================================
-- Fim — Modelo de dados de recomendação (Story 4.1).
-- ============================================================================
