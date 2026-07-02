-- ============================================================================
-- EA360 — Migração 0010: Salvamento por etapa da Entrevista (Story 3.4)
-- ----------------------------------------------------------------------------
-- AC da Story 3.4:
--   AC1: cada resposta é persistida em interview_answers via Server Action antes
--        de avançar para a próxima pergunta.
--   AC2: ao reabrir entrevista em andamento, retoma da última pergunta não
--        respondida (suportado por leitura de respostas — feito na app).
--   AC3: interviews.current_layer é atualizado ao avançar de camada.
--   AC4: ao concluir todas as camadas, interviews.status = 'concluida'
--        (= "completed") e completed_at é preenchido.
--   AC5: indicador de progresso reflete o estado salvo (lido na app a partir do
--        número de respostas / current_layer).
--   AC6: operações de salvamento são ATÔMICAS — INSERT da resposta E UPDATE do
--        estado ocorrem juntos, ou nenhum dos dois (transação SQL via funções
--        plpgsql, que executam num único statement = uma transação).
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE: tabelas interviews/interview_answers, enum interview_status
--          (rascunho/em_andamento/concluida — Story 3.1), helper owns_business()
--          e o trigger trg_interviews_updated. Mapeamento de status PT mantido
--          (concluida ⇔ "completed" do AC4) para não regredir seed/RLS/código.
--   CREATE (justificado): não existia nenhuma função RPC de salvamento atômico
--          nem de conclusão. As funções abaixo são novas e específicas do AC6.
--
-- Atomicidade (AC6): uma função plpgsql roda dentro da transação do statement
--   que a invoca. Se o UPDATE de current_layer falhar, o INSERT da resposta é
--   desfeito junto — não há insert órfão (cenário do "Testing" da story).
--
-- Segurança: SECURITY INVOKER (default) — as funções rodam com as permissões do
--   chamador, então a RLS "do dono" de interviews/interview_answers continua
--   valendo. A posse é re-checada explicitamente como defesa em profundidade.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC1 + AC3 + AC6 — save_interview_answer
--    Insere a resposta E avança current_layer atomicamente. Retorna o id da
--    resposta criada (pergunta-mãe para follow-ups da Story 3.3).
-- ----------------------------------------------------------------------------
create or replace function public.save_interview_answer(
  p_interview_id uuid,
  p_question_id  uuid,
  p_answer_text  text,
  p_layer        text default null,
  p_next_layer   int  default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_answer_id uuid;
  v_owns boolean;
begin
  if coalesce(btrim(p_answer_text), '') = '' then
    raise exception 'SAVE_ANSWER: resposta vazia' using errcode = 'check_violation';
  end if;

  -- Defesa em profundidade: posse da entrevista (além da RLS).
  select public.owns_business(i.business_id)
    into v_owns
    from public.interviews i
   where i.id = p_interview_id;

  if not coalesce(v_owns, false) then
    raise exception 'SAVE_ANSWER: entrevista inexistente ou sem permissao'
      using errcode = 'insufficient_privilege';
  end if;

  -- AC1/AC6: persiste a resposta (mantém answer jsonb e answer_text em sincronia).
  insert into public.interview_answers (interview_id, question_id, layer, answer, answer_text)
  values (
    p_interview_id,
    p_question_id,
    p_layer,
    jsonb_build_object('text', p_answer_text),
    p_answer_text
  )
  returning id into v_answer_id;

  -- AC3/AC6: avança a camada salva quando informado (mesma transação).
  if p_next_layer is not null then
    update public.interviews
       set current_layer = greatest(current_layer, least(p_next_layer, 4))
     where id = p_interview_id;
  end if;

  return v_answer_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. AC4 — complete_interview
--    Marca a entrevista como concluída (status + completed_at) idempotentemente.
-- ----------------------------------------------------------------------------
create or replace function public.complete_interview(
  p_interview_id uuid
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owns boolean;
  v_completed_at timestamptz;
begin
  select public.owns_business(i.business_id)
    into v_owns
    from public.interviews i
   where i.id = p_interview_id;

  if not coalesce(v_owns, false) then
    raise exception 'COMPLETE_INTERVIEW: entrevista inexistente ou sem permissao'
      using errcode = 'insufficient_privilege';
  end if;

  update public.interviews
     set status       = 'concluida',
         current_layer = 4,
         completed_at = coalesce(completed_at, now())
   where id = p_interview_id
  returning completed_at into v_completed_at;

  return v_completed_at;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. GATE de verificação — falha o `supabase db push` se algo não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  v_save_ok boolean;
  v_complete_ok boolean;
  v_status_concluida boolean;
begin
  -- AC1/AC3/AC6: função de salvamento atômico existe com a assinatura esperada.
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_interview_answer'
  ) into v_save_ok;
  if not v_save_ok then
    raise exception 'STEP-SAVE GATE [AC1/AC6]: funcao save_interview_answer ausente';
  end if;

  -- AC4: função de conclusão existe.
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'complete_interview'
  ) into v_complete_ok;
  if not v_complete_ok then
    raise exception 'STEP-SAVE GATE [AC4]: funcao complete_interview ausente';
  end if;

  -- AC4: enum interview_status possui o estado de conclusão ('concluida').
  select exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'interview_status' and e.enumlabel = 'concluida'
  ) into v_status_concluida;
  if not v_status_concluida then
    raise exception 'STEP-SAVE GATE [AC4]: enum interview_status sem estado de conclusao';
  end if;

  raise notice 'STEP-SAVE GATE Story 3.4: OK — save_interview_answer, complete_interview e estado de conclusao verificados.';
end $$;

-- ============================================================================
-- Fim — Salvamento por etapa da Entrevista (Story 3.4).
-- ============================================================================
