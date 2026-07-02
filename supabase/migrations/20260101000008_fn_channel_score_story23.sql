-- ============================================================================
-- EA360 — Migração 0008: Função de scoring de canal fn_channel_score() (Story 2.3)
-- ----------------------------------------------------------------------------
-- AC da Story 2.3:
--   AC1: função fn_channel_score(channel_id uuid, weights jsonb) no schema public
--   AC2: recebe pesos para os 5 atributos (Custo, Payback, Controle, Risco, Escala)
--        via weights JSONB
--   AC3: retorna numérico (score ponderado) entre 0 e 5
--   AC4: IMMUTABLE ou STABLE conforme semântica (lê tabela => STABLE)
--   AC5: testes com valores conhecidos retornam scores esperados
--   AC6: migração aplicada sem erros
--
-- IDS: REUSE > ADAPT > CREATE.
--   JÁ existe um overload fn_channel_score(ch gom_channels, p monetization_profiles)
--   em 20260101000000_init_ea360.sql (seção 12), consumido por fn_match_channels.
--   RENOMEAR/SUBSTITUIR esse overload quebraria fn_match_channels (No regression).
--   A Story 2.3 pede uma assinatura DIFERENTE: (uuid, jsonb) -> numeric 0..5.
--   Em Postgres, overloads coexistem por divergência de tipos de argumento.
--   => CREATE de um NOVO overload (uuid, jsonb), preservando o existente intacto.
--   Justificativa CREATE:
--     - evaluated_patterns: overload (gom_channels, monetization_profiles)
--     - rejection_reasons: assinatura, domínio de retorno (0..100 vs 0..5) e
--       semântica (pesos derivados de perfil vs pesos explícitos via JSONB) diferem;
--       reusá-lo quebraria fn_match_channels e não satisfaz o AC.
--     - new_capability: score ponderado parametrizável (0..5) por pesos arbitrários,
--       consumível pelo alocador/matchmaking de forma consistente (PRD §8, R2).
--
-- Mapeamento atributo -> coluna 1..5 em gom_channels (Story 2.1):
--   Custo     -> cost_score    (= capital_intensity; 5 = exige mais caixa)
--   Payback   -> payback_score (= liquidity;         5 = retorno mais rápido)
--   Controle  -> control_score (                     5 = mais controle)
--   Risco     -> risk_score    (                     5 = MAIS arriscado)
--   Escala    -> scale_score   (= scalability;       5 = escala mais longe)
--
-- Direção do score (maior = melhor canal): Payback, Controle e Escala já são
-- "quanto maior melhor". Custo e Risco são "quanto maior pior" => invertidos
-- para a contribuição (6 - valor), mantendo cada termo no intervalo 1..5.
-- Resultado final = média ponderada dos 5 termos (cada um 1..5) => sempre em 1..5,
-- portanto dentro de [0,5] (AC3). Se a soma dos pesos for 0/ausente, retorna 0.
--
-- Chaves aceitas em weights (case-sensitive, com aliases PT/EN):
--   cost     | custo
--   payback
--   control  | controle
--   risk     | risco
--   scale    | escala
-- Pesos ausentes assumem 0. Pesos negativos são tratados como 0 (clamp).
-- ============================================================================

create or replace function public.fn_channel_score(channel_id uuid, weights jsonb)
returns numeric
language plpgsql
stable
as $$
declare
  ch            public.gom_channels;
  w_cost        numeric;
  w_payback     numeric;
  w_control     numeric;
  w_risk        numeric;
  w_scale       numeric;
  w_total       numeric;
  term_cost     numeric;
  term_payback  numeric;
  term_control  numeric;
  term_risk     numeric;
  term_scale    numeric;
  weighted_sum  numeric;
begin
  -- Canal inexistente => NULL (sem score possível)
  select * into ch from public.gom_channels where id = channel_id;
  if not found then
    return null;
  end if;

  if weights is null or jsonb_typeof(weights) <> 'object' then
    return 0;
  end if;

  -- Extrai pesos (aliases PT/EN), default 0, clamp em >= 0
  w_cost    := greatest(0, coalesce((weights->>'cost')::numeric,    (weights->>'custo')::numeric,    0));
  w_payback := greatest(0, coalesce((weights->>'payback')::numeric,                                   0));
  w_control := greatest(0, coalesce((weights->>'control')::numeric, (weights->>'controle')::numeric, 0));
  w_risk    := greatest(0, coalesce((weights->>'risk')::numeric,    (weights->>'risco')::numeric,    0));
  w_scale   := greatest(0, coalesce((weights->>'scale')::numeric,   (weights->>'escala')::numeric,   0));

  w_total := w_cost + w_payback + w_control + w_risk + w_scale;
  if w_total = 0 then
    return 0;
  end if;

  -- Termos 1..5 (maior = melhor). Custo e Risco invertidos (6 - valor).
  term_cost    := 6 - ch.cost_score;     -- custo alto penaliza
  term_payback := ch.payback_score;      -- payback rápido é bom
  term_control := ch.control_score;      -- mais controle é bom
  term_risk    := 6 - ch.risk_score;     -- risco alto penaliza
  term_scale   := ch.scale_score;        -- mais escala é bom

  weighted_sum :=
      term_cost    * w_cost
    + term_payback * w_payback
    + term_control * w_control
    + term_risk    * w_risk
    + term_scale   * w_scale;

  -- Média ponderada => 1..5; clamp defensivo em [0,5] (AC3)
  return round(greatest(0, least(5, weighted_sum / w_total)), 4);
end;
$$;

comment on function public.fn_channel_score(uuid, jsonb) is
  'Story 2.3 — score ponderado (0..5) de um canal dado um perfil de pesos JSONB '
  '(cost/custo, payback, control/controle, risk/risco, scale/escala). Custo e Risco '
  'invertidos (maior=pior). Coexiste com o overload (gom_channels, monetization_profiles).';

-- ----------------------------------------------------------------------------
-- GATE de verificação — falha o `supabase db push` se algum AC não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  fn_exists      boolean;
  is_stable      boolean;
  ret_type       text;
  sample_id      uuid;
  s_all          numeric;
  s_max          numeric;
  s_min          numeric;
  s_zero         numeric;
begin
  -- AC1: função (uuid, jsonb) existe no schema public
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_channel_score'
      and pg_get_function_identity_arguments(p.oid) = 'channel_id uuid, weights jsonb'
  ) into fn_exists;
  if not fn_exists then
    raise exception 'FN GATE [AC1]: fn_channel_score(uuid, jsonb) inexistente no schema public';
  end if;

  -- AC4: STABLE (provolatile = 's') e AC3: retorno numeric
  select (p.provolatile = 's'), pg_catalog.format_type(p.prorettype, null)
    into is_stable, ret_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'fn_channel_score'
    and pg_get_function_identity_arguments(p.oid) = 'channel_id uuid, weights jsonb';
  if not is_stable then
    raise exception 'FN GATE [AC4]: fn_channel_score(uuid, jsonb) nao e STABLE';
  end if;
  if ret_type <> 'numeric' then
    raise exception 'FN GATE [AC3]: retorno e % (esperado numeric)', ret_type;
  end if;

  -- AC3/AC5: validação funcional com um canal real do seed (se houver)
  select id into sample_id from public.gom_channels limit 1;
  if sample_id is not null then
    s_all := public.fn_channel_score(
      sample_id, '{"cost":1,"payback":1,"control":1,"risk":1,"scale":1}'::jsonb);
    if s_all is null or s_all < 0 or s_all > 5 then
      raise exception 'FN GATE [AC3]: score fora de [0,5]: %', s_all;
    end if;

    -- Peso unico em escala => deve igualar scale_score do canal (sanity AC5)
    s_max := public.fn_channel_score(sample_id, '{"scale":1}'::jsonb);
    if s_max is null or s_max < 1 or s_max > 5 then
      raise exception 'FN GATE [AC5]: score de escala-unica fora de [1,5]: %', s_max;
    end if;

    -- Pesos vazios => 0 (sem peso, sem score)
    s_zero := public.fn_channel_score(sample_id, '{}'::jsonb);
    if s_zero <> 0 then
      raise exception 'FN GATE [AC5]: weights vazio deveria retornar 0, retornou %', s_zero;
    end if;
  else
    raise notice 'FN GATE: nenhum canal no seed para validacao funcional (pulado).';
  end if;

  -- Canal inexistente => NULL
  s_min := public.fn_channel_score('00000000-0000-0000-0000-000000000000'::uuid, '{"scale":1}'::jsonb);
  if s_min is not null then
    raise exception 'FN GATE [AC5]: canal inexistente deveria retornar NULL, retornou %', s_min;
  end if;

  raise notice 'FN GATE Story 2.3: OK — assinatura (uuid,jsonb), STABLE, retorno numeric e scores em [0,5] verificados.';
end $$;

-- ============================================================================
-- Fim — Função de scoring de canal fn_channel_score() (Story 2.3).
-- ============================================================================
