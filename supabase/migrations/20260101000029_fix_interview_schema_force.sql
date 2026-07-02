-- ============================================================================
-- EA360 — Migração 0009: Modelo de dados da Entrevista (Story 3.1)
-- ----------------------------------------------------------------------------
-- AC da Story 3.1:
--   AC1: interviews com id, business_id (FK businesses), status (enum 3 estados),
--        current_layer (1..4), started_at, completed_at, created_at, updated_at.
--   AC2: interview_questions com id, interview_id (FK interviews), layer (1..4),
--        question_text, question_type, parent_question_id (auto-ref), order, created_at.
--   AC3: interview_answers com id, question_id (FK), interview_id (FK),
--        answer_text, created_at.
--   AC4: enum de status de entrevista criado.
--   AC5: trigger set_updated_at() aplicado em interviews.
--   AC6: RLS — usuário acessa apenas interviews do seu business_id.
--   AC7: migração aplicada sem erros.
--
-- IDS: REUSE > ADAPT > CREATE.
--   As tabelas interviews / interview_questions / interview_answers JÁ existem
--   (criadas em 20260101000000_init_ea360.sql) com um schema MAIS RICO e
--   load-bearing: o seed de interview_questions (slug/layer/prompt/input_type),
--   o trigger trg_interviews_updated, o enum interview_status (rascunho/
--   em_andamento/concluida) e as policies "do dono" já existem e são consumidos.
--   RENOMEAR colunas/enum quebraria o seed e código existente (No Invention /
--   no regression). Portanto esta migração é ADITIVA e IDEMPOTENTE:
--     - interviews: adiciona current_layer (1..4), started_at, completed_at.
--                   status/created_at/updated_at e trigger JÁ existem (REUSE).
--     - interview_questions: adiciona question_text/question_type como colunas
--                   GERADAS (mapeadas de prompt/input_type, sem duplicar verdade),
--                   parent_question_id (auto-ref), "order" (mapeado de sort) e
--                   created_at; layer permanece text (valores objetivos/filosofia/
--                   momento/recursos = camadas 1..4) — semântica preservada.
--     - interview_answers: adiciona answer_text; question_id/interview_id/created_at
--                   já existem (REUSE).
--     - RLS: re-assegura policies "do dono" (idempotente) — AC6.
--     - GATE determinístico: falha o push se qualquer AC não bater.
--
-- AUTO-DECISION (enum): manter valores PT (rascunho/em_andamento/concluida) em vez
--   de pending/in_progress/completed — os três estados exigidos pelo AC4 estão
--   satisfeitos; renomear seria regressão sobre dados/seed/RLS existentes.
-- AUTO-DECISION (question_text/type): colunas GERADAS a partir de prompt/input_type
--   para expor os nomes do AC sem duplicar a fonte de verdade do seed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC1 — interviews: campos de progresso/tempo (idempotente)
-- ----------------------------------------------------------------------------
alter table public.interviews
  add column if not exists current_layer int not null default 1
    check (current_layer between 1 and 4);
alter table public.interviews
  add column if not exists started_at   timestamptz;
alter table public.interviews
  add column if not exists completed_at timestamptz;

-- AC5: trigger set_updated_at em interviews (idempotente — recria se ausente)
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.interviews'::regclass
      and tgname = 'trg_interviews_updated'
  ) then
    create trigger trg_interviews_updated before update on public.interviews
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. AC2 — interview_questions: ramificação + nomes canônicos do AC
-- ----------------------------------------------------------------------------
alter table public.interview_questions
  add column if not exists interview_id uuid references public.interviews(id) on delete cascade;
alter table public.interview_questions
  add column if not exists parent_question_id uuid references public.interview_questions(id) on delete set null;
alter table public.interview_questions
  add column if not exists created_at timestamptz not null default now();
-- "order" exposto como coluna gerada a partir de sort (palavra reservada → entre aspas)
alter table public.interview_questions
  add column if not exists "order" int generated always as (sort) stored;
-- question_text/question_type: nomes do AC mapeados de prompt/input_type
alter table public.interview_questions
  add column if not exists question_text text generated always as (prompt) stored;
alter table public.interview_questions
  add column if not exists question_type text generated always as (input_type) stored;

create index if not exists idx_interview_questions_interview_id
  on public.interview_questions (interview_id);
create index if not exists idx_interview_questions_parent_id
  on public.interview_questions (parent_question_id);

-- ----------------------------------------------------------------------------
-- 3. AC3 — interview_answers: answer_text (idempotente)
--    question_id / interview_id / created_at já existem (REUSE).
-- ----------------------------------------------------------------------------
alter table public.interview_answers
  add column if not exists answer_text text;

-- ----------------------------------------------------------------------------
-- 4. AC6 — RLS: usuário acessa apenas interviews/answers do seu business_id
--    (re-assegura policies "do dono"; idempotente; usa owns_business()).
-- ----------------------------------------------------------------------------
alter table public.interviews        enable row level security;
alter table public.interview_answers enable row level security;

drop policy if exists "interviews do dono" on public.interviews;
drop policy if exists "interviews_owner_all" on public.interviews;
create policy "interviews_owner_all" on public.interviews
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

drop policy if exists "interview_answers do dono" on public.interview_answers;
drop policy if exists "interview_answers_owner_all" on public.interview_answers;
create policy "interview_answers_owner_all" on public.interview_answers
  for all using (
    exists (select 1 from public.interviews i
            where i.id = interview_answers.interview_id
              and public.owns_business(i.business_id))
  ) with check (
    exists (select 1 from public.interviews i
            where i.id = interview_answers.interview_id
              and public.owns_business(i.business_id))
  );

-- ----------------------------------------------------------------------------
-- 5. GATE de verificação — falha o `supabase db push` se algum AC não bater
-- ----------------------------------------------------------------------------
do $$
declare
  missing text;
  enum_vals int;
  has_rls boolean;
  owner_policies int;
  has_trigger boolean;
begin
  -- AC1: interviews campos + FK businesses
  foreach missing in array array[
    'id','business_id','status','current_layer','started_at',
    'completed_at','created_at','updated_at'
  ] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='interviews' and column_name=missing) then
      raise exception 'INTERVIEW GATE [AC1]: interviews sem coluna %', missing;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.table_name='interviews' and tc.constraint_type='FOREIGN KEY'
      and ccu.table_name='businesses') then
    raise exception 'INTERVIEW GATE [AC1]: interviews.business_id sem FK para businesses';
  end if;

  -- AC4: enum de status com 3 estados
  select count(*) into enum_vals
    from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'interview_status';
  if enum_vals < 3 then
    raise exception 'INTERVIEW GATE [AC4]: enum interview_status com % estados (esperado >= 3)', enum_vals;
  end if;

  -- AC5: trigger set_updated_at em interviews
  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.interviews'::regclass and tgname = 'trg_interviews_updated'
  ) into has_trigger;
  if not has_trigger then
    raise exception 'INTERVIEW GATE [AC5]: interviews sem trigger trg_interviews_updated';
  end if;

  -- AC2: interview_questions campos + auto-ref + FK interviews
  foreach missing in array array[
    'id','interview_id','layer','question_text','question_type',
    'parent_question_id','order','created_at'
  ] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='interview_questions' and column_name=missing) then
      raise exception 'INTERVIEW GATE [AC2]: interview_questions sem coluna %', missing;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.table_name='interview_questions' and tc.constraint_type='FOREIGN KEY'
      and ccu.table_name='interview_questions') then
    raise exception 'INTERVIEW GATE [AC2]: interview_questions sem auto-referência (parent_question_id)';
  end if;

  -- AC3: interview_answers campos + FKs
  foreach missing in array array['id','question_id','interview_id','answer_text','created_at'] loop
    if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='interview_answers' and column_name=missing) then
      raise exception 'INTERVIEW GATE [AC3]: interview_answers sem coluna %', missing;
    end if;
  end loop;
  if not exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
    where tc.table_name='interview_answers' and tc.constraint_type='FOREIGN KEY'
      and ccu.table_name='interviews') then
    raise exception 'INTERVIEW GATE [AC3]: interview_answers.interview_id sem FK para interviews';
  end if;

  -- AC6: RLS ON + policy "do dono" em interviews e interview_answers
  foreach missing in array array['interviews','interview_answers'] loop
    select relrowsecurity into has_rls from pg_class where oid = format('public.%I', missing)::regclass;
    if not coalesce(has_rls, false) then
      raise exception 'INTERVIEW GATE [AC6]: % sem RLS habilitado', missing;
    end if;
    select count(*) into owner_policies from pg_policies
      where schemaname='public' and tablename=missing;
    if owner_policies = 0 then
      raise exception 'INTERVIEW GATE [AC6]: % sem policy de isolamento por dono', missing;
    end if;
  end loop;

  raise notice 'INTERVIEW GATE Story 3.1: OK — tabelas, FKs, auto-ref, enum, trigger e RLS verificados.';
end $$;

-- ============================================================================
-- Fim — Modelo de dados da Entrevista (Story 3.1).
-- ============================================================================
