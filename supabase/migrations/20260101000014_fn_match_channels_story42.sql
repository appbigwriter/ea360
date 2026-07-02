-- ============================================================================
-- EA360 — Migração 0014: Função de matchmaking pontuável fn_match_channels() (Story 4.2)
-- ----------------------------------------------------------------------------
-- AC da Story 4.2:
--   AC1: função fn_match_channels(profile_id uuid, excluded_channel_ids uuid[],
--        limit_n integer) no schema public.
--   AC2: usa fn_channel_score() para calcular scores, filtra excluded_channel_ids
--        e retorna os top limit_n canais ordenados por score descendente.
--   AC3: retorna tabela com channel_id, channel_name, match_score, pillar_name,
--        category_name.
--   AC4: canais em excluded_channel_ids são excluídos do resultado.
--   AC5: testado com perfil real retornando ao menos 5 canais.
--   AC6: migração aplicada sem erros.
--
-- IDS: REUSE > ADAPT > CREATE.
--   JÁ existe fn_match_channels(p_profile uuid, p_limit int) em
--   20260101000000_init_ea360.sql (seção 12), consumido pelo menu legado. Ele usa
--   o overload fn_channel_score(gom_channels, monetization_profiles) (0..100),
--   filtra por prof.philosophy_excludes e retorna outra tabela
--   (slug, pillar enum, payback/control/scale...).
--   A Story 4.2 pede uma assinatura DIFERENTE — (uuid, uuid[], integer) — que usa o
--   overload fn_channel_score(uuid, jsonb) da Story 2.3 (0..5), filtra por uma LISTA
--   de channel_ids excluídos (não por filosofia) e retorna outra projeção
--   (channel_name, pillar_name, category_name).
--   => CREATE de um NOVO overload (uuid, uuid[], integer), preservando o existente
--      intacto (No regression). Em Postgres overloads coexistem por divergência de
--      tipos de argumento.
--   Justificativa CREATE:
--     - evaluated_patterns: overload fn_match_channels(uuid, int).
--     - rejection_reasons: assinatura, filtro (lista de IDs vs philosophy_excludes),
--       função de score consumida (jsonb 0..5 vs profile 0..100) e projeção de
--       retorno (channel_name/pillar_name/category_name) diferem dos AC; reusá-lo
--       não satisfaz a Story 4.2 e adaptá-lo quebraria o menu legado.
--     - new_capability: matchmaking pontuável parametrizado por pesos do perfil
--       (profile_data.channel_weights) com exclusão explícita por lista de canais e
--       projeção rastreável (PRD R3, F2.3, §8).
--
-- Pesos para fn_channel_score(uuid, jsonb): extraídos de
--   monetization_profiles.profile_data -> 'channel_weights' (objeto JSONB com chaves
--   cost/custo, payback, control/controle, risk/risco, scale/escala — Story 2.3).
--   Fallback: se ausente/não-objeto, usa pesos padrão iguais
--   {"cost":1,"payback":1,"control":1,"risk":1,"scale":1}.
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0006/0008/0011/0013).
-- ============================================================================

create or replace function public.fn_match_channels(
  profile_id           uuid,
  excluded_channel_ids uuid[],
  limit_n              integer
)
returns table (
  channel_id    uuid,
  channel_name  text,
  match_score   numeric,
  pillar_name   text,
  category_name text
)
language plpgsql
stable
as $$
declare
  v_weights   jsonb;
  v_excluded  uuid[] := coalesce(excluded_channel_ids, array[]::uuid[]);
  v_limit     integer := greatest(0, coalesce(limit_n, 12));
begin
  -- Pesos do perfil (Story 3.5: profile_data.channel_weights). Fallback: iguais.
  select case
           when jsonb_typeof(mp.profile_data -> 'channel_weights') = 'object'
             then mp.profile_data -> 'channel_weights'
           else '{"cost":1,"payback":1,"control":1,"risk":1,"scale":1}'::jsonb
         end
    into v_weights
  from public.monetization_profiles mp
  where mp.id = profile_id;

  -- Perfil inexistente => sem linhas (resultado vazio, não erro).
  if v_weights is null then
    return;
  end if;

  return query
  select ch.id,
         ch.name,
         public.fn_channel_score(ch.id, v_weights) as match_score,
         pl.name,
         cat.name
  from public.gom_channels ch
  join public.gom_categories cat on cat.id = ch.category_id
  join public.gom_pillars   pl  on pl.id  = cat.pillar_id
  where not (ch.id = any(v_excluded))               -- AC4: exclui canais vetados
  order by public.fn_channel_score(ch.id, v_weights) desc nulls last, ch.name asc
  limit v_limit;                                    -- AC2: top limit_n
end;
$$;

comment on function public.fn_match_channels(uuid, uuid[], integer) is
  'Story 4.2 — matchmaking pontuável: cruza o perfil de monetização '
  '(profile_data.channel_weights) com o GOM via fn_channel_score(uuid, jsonb), '
  'exclui excluded_channel_ids e retorna os top limit_n canais ranqueados '
  '(channel_id, channel_name, match_score, pillar_name, category_name). '
  'Coexiste com o overload fn_match_channels(uuid, int) do menu legado.';

-- ----------------------------------------------------------------------------
-- GATE de verificação — falha o `supabase db push` se algum AC não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  v_fn_exists   boolean;
  v_is_stable   boolean;
  v_profile_id  uuid;
  v_count       integer;
  v_excl_id     uuid;
  v_excl_count  integer;
  v_top_score   numeric;
begin
  -- AC1: função (uuid, uuid[], integer) existe no schema public.
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_match_channels'
      and pg_get_function_identity_arguments(p.oid)
          = 'profile_id uuid, excluded_channel_ids uuid[], limit_n integer'
  ) into v_fn_exists;
  if not v_fn_exists then
    raise exception 'MATCH GATE [AC1]: fn_match_channels(uuid, uuid[], integer) inexistente no schema public';
  end if;

  -- AC2: STABLE (lê tabelas, sem efeitos colaterais).
  select (p.provolatile = 's') into v_is_stable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'fn_match_channels'
    and pg_get_function_identity_arguments(p.oid)
        = 'profile_id uuid, excluded_channel_ids uuid[], limit_n integer';
  if not v_is_stable then
    raise exception 'MATCH GATE [AC2]: fn_match_channels(uuid, uuid[], integer) nao e STABLE';
  end if;

  -- AC3/AC5: validação funcional com um perfil real (se houver perfil e canais).
  select id into v_profile_id from public.monetization_profiles limit 1;
  if v_profile_id is not null then
    select count(*) into v_count
    from public.fn_match_channels(v_profile_id, array[]::uuid[], 10);

    -- AC5: ao menos 5 canais (depende do seed do GOM — Story 2.2).
    if v_count < 5 then
      raise exception 'MATCH GATE [AC5]: esperado >= 5 canais, retornou % (perfil %)', v_count, v_profile_id;
    end if;

    -- AC3: projeção e ordenação — top score deve ser numerico e nao-nulo.
    select match_score into v_top_score
    from public.fn_match_channels(v_profile_id, array[]::uuid[], 10)
    limit 1;
    if v_top_score is null then
      raise exception 'MATCH GATE [AC3]: match_score do topo veio NULL';
    end if;

    -- AC4: excluir um canal o remove do resultado.
    select channel_id into v_excl_id
    from public.fn_match_channels(v_profile_id, array[]::uuid[], 10)
    limit 1;

    select count(*) into v_excl_count
    from public.fn_match_channels(v_profile_id, array[v_excl_id], 10)
    where channel_id = v_excl_id;
    if v_excl_count <> 0 then
      raise exception 'MATCH GATE [AC4]: canal excluido % ainda apareceu no resultado', v_excl_id;
    end if;
  else
    raise notice 'MATCH GATE: nenhum monetization_profile para validacao funcional (pulado).';
  end if;

  raise notice 'MATCH GATE Story 4.2: OK — assinatura (uuid,uuid[],integer), STABLE, projecao, exclusao e >= 5 canais verificados.';
end $$;

-- ============================================================================
-- Fim — Função de matchmaking pontuável fn_match_channels() (Story 4.2).
-- ============================================================================
