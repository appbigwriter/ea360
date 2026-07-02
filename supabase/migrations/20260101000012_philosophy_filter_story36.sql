-- ============================================================================
-- EA360 — Migração 0012: Filtro de Filosofia (Story 3.6)
-- ----------------------------------------------------------------------------
-- AC da Story 3.6 relevantes a esta migração:
--   AC1: durante a camada "Filosofia & Valores" (layer 2), perguntas específicas
--        sobre valores e restrições éticas são apresentadas.
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE: a pergunta `filosofia_excludentes` (camada 'filosofia') JÁ existe no
--          seed da init (20260101000000_init_ea360.sql, 13.4) e já satisfaz o
--          núcleo do AC1 ("Há canais ou abordagens que você recusa por
--          princípio..."). Não a duplicamos nem a alteramos.
--   ADAPT (aditivo, idempotente): acrescentamos DUAS perguntas específicas de
--          restrições éticas na MESMA camada 'filosofia' para enriquecer o
--          contexto do filtro (push agressivo; valores que orientam canais).
--          Idempotência por `slug` (UNIQUE) com `ON CONFLICT DO NOTHING`.
--
-- AC2/AC3/AC4/AC5 (derivação de exclusões, integração com matchmaking, UI) são
-- implementados na aplicação (Server Actions + página de perfil) — não exigem
-- mudança de schema: `monetization_profiles.profile_data` (JSONB, migração 0011)
-- já comporta `excluded_channels` e `excluded_channel_details`.
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão de 0006/0007/0009/0010/0011).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC1 — perguntas adicionais da camada 'filosofia' (restrições éticas).
--    `sort` 9/10 para não colidir com o seed existente (1..8). Idempotente.
-- ----------------------------------------------------------------------------
insert into public.interview_questions (slug, layer, prompt, input_type, sort) values
  ('filosofia_push_agressivo','filosofia',
   'Você evitaria campanhas de push/marketing agressivo, disparo em massa ou táticas de interrupção, por princípio?',
   'single', 9),
  ('filosofia_valores_canais','filosofia',
   'Há valores ou convicções (ex.: evitar dependência de Big Tech, recusar cupom/desconto, não usar afiliados ou MLM) que devem restringir quais canais recomendamos a você?',
   'multi', 10)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. GATE de verificação — falha o `supabase db push` se o AC1 não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  v_philo_count integer;
begin
  -- AC1: a camada 'filosofia' tem ao menos 2 perguntas para capturar valores e
  -- restrições éticas (a herdada + as adicionadas aqui).
  select count(*) into v_philo_count
  from public.interview_questions
  where layer = 'filosofia';

  if v_philo_count < 2 then
    raise exception 'PHILOSOPHY GATE [AC1]: camada filosofia com % perguntas (esperado >= 2)', v_philo_count;
  end if;

  raise notice 'PHILOSOPHY GATE Story 3.6: OK — % perguntas na camada filosofia.', v_philo_count;
end $$;

-- ============================================================================
-- Fim — Filtro de Filosofia (Story 3.6).
-- ============================================================================
