-- ============================================================================
-- EA360 — Migração 0016: Detector de concentração fn_concentration_check() (Story 6.1)
-- ----------------------------------------------------------------------------
-- AC da Story 6.1:
--   AC1: função fn_concentration_check(allocation_id uuid) no schema public.
--   AC2: agrupa allocation_items por pillar_id (canal → categoria → pilar) e
--        calcula % de concentração por pilar.
--   AC3: agrupa por canal individual e calcula % de concentração por canal.
--   AC4: retorna tabela com entity_type (pillar/channel), entity_id, entity_name,
--        concentration_pct, flag_level (green/yellow/red).
--   AC5: flag_level: verde (<40%), amarelo (40–60%), vermelho (>60%).
--   AC6: migração aplicada sem erros.
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE (sem modificar): tabelas allocation_items (Story 5.1), gom_channels /
--     gom_categories / gom_pillars e a hierarquia category_id/pillar_id (Story 2.1).
--     A concentração é derivada do peso de cada item na alocação. Reusar a hierarquia
--     existente evita reinvenção (Article IV) e mantém consistência com o GOM.
--   CREATE (justificado): fn_concentration_check(uuid) NÃO existe. Capacidade nova:
--     mitigador de risco que detecta dependência excessiva por pilar/canal
--     (PRD R5 / §8 / F3.3). Padrões avaliados: fn_channel_score (rejeitado —
--     scoring de canal individual, não agregação de concentração na carteira).
--
-- BASE DE CÁLCULO (decisão de implementação):
--   A concentração de cada entidade = (soma de amount dos itens da entidade) /
--   (soma de amount de todos os itens da alocação) * 100. Usa `amount` como fonte
--   de verdade do peso financeiro real (percentage é informativo e pode não somar
--   100). Se o total de amount for 0, cai de volta para a média de `percentage`
--   por entidade, garantindo resultado útil mesmo sem valores monetários.
--   Thresholds 40%/60% hardcoded para o MVP (Dev Notes — configuráveis no roadmap).
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0008/0014).
-- ============================================================================

drop function if exists public.fn_concentration_check(uuid);

create or replace function public.fn_concentration_check(allocation_id uuid)
returns table (
  entity_type       text,
  entity_id         uuid,
  entity_name       text,
  concentration_pct numeric,
  flag_level        text
)
language sql
stable
as $$
  with items as (
    select
      ai.channel_id,
      ai.amount,
      ai.percentage,
      ch.name              as channel_name,
      cat.pillar_id        as pillar_id,
      pil.name             as pillar_name
    from public.allocation_items ai
    join public.gom_channels   ch  on ch.id  = ai.channel_id
    join public.gom_categories cat on cat.id = ch.category_id
    join public.gom_pillars    pil on pil.id = cat.pillar_id
    where ai.allocation_id = fn_concentration_check.allocation_id
  ),
  totals as (
    -- base de divisão: amount total; fallback para soma de percentage
    select
      nullif(sum(amount), 0)     as total_amount,
      nullif(sum(percentage), 0) as total_percentage
    from items
  ),
  -- AC2/AC3: concentração por entidade. use_amount decide a base de cálculo.
  per_pillar as (
    select
      'pillar'::text as entity_type,
      i.pillar_id    as entity_id,
      i.pillar_name  as entity_name,
      case
        when t.total_amount is not null
          then sum(i.amount) / t.total_amount * 100
        when t.total_percentage is not null
          then sum(i.percentage) / t.total_percentage * 100
        else 0
      end as concentration_pct
    from items i cross join totals t
    group by i.pillar_id, i.pillar_name, t.total_amount, t.total_percentage
  ),
  per_channel as (
    select
      'channel'::text as entity_type,
      i.channel_id    as entity_id,
      i.channel_name  as entity_name,
      case
        when t.total_amount is not null
          then sum(i.amount) / t.total_amount * 100
        when t.total_percentage is not null
          then sum(i.percentage) / t.total_percentage * 100
        else 0
      end as concentration_pct
    from items i cross join totals t
    group by i.channel_id, i.channel_name, t.total_amount, t.total_percentage
  ),
  unified as (
    select * from per_pillar
    union all
    select * from per_channel
  )
  -- AC4/AC5: flag_level por thresholds 40%/60%.
  select
    entity_type,
    entity_id,
    entity_name,
    round(concentration_pct, 2) as concentration_pct,
    case
      when concentration_pct > 60 then 'red'
      when concentration_pct >= 40 then 'yellow'
      else 'green'
    end as flag_level
  from unified
  order by concentration_pct desc, entity_type;
$$;

comment on function public.fn_concentration_check(uuid) is
  'Story 6.1 — detecta concentração por pilar e por canal de uma alocação. '
  'Retorna entity_type (pillar/channel), entity_id, entity_name, concentration_pct '
  'e flag_level (green <40, yellow 40–60, red >60). Mitigador de risco (PRD R5/§8/F3.3).';

-- ----------------------------------------------------------------------------
-- GATE de verificação — falha o `supabase db push` se algum AC não bater.
-- ----------------------------------------------------------------------------
do $$
declare
  fn_exists   boolean;
  is_stable   boolean;
  alloc_id    uuid;
  red_cnt     int;
  green_cnt   int;
  bad_flag    int;
  total_rows  int;
begin
  -- AC1: função (uuid) existe no schema public
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fn_concentration_check'
      and pg_get_function_identity_arguments(p.oid) = 'allocation_id uuid'
  ) into fn_exists;
  if not fn_exists then
    raise exception 'CONC GATE [AC1]: fn_concentration_check(uuid) inexistente no schema public';
  end if;

  -- AC1: STABLE (lê tabelas)
  select (p.provolatile = 's') into is_stable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'fn_concentration_check'
    and pg_get_function_identity_arguments(p.oid) = 'allocation_id uuid';
  if not is_stable then
    raise exception 'CONC GATE [AC1]: fn_concentration_check(uuid) nao e STABLE';
  end if;

  -- AC4: colunas de retorno corretas
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
    lateral unnest(p.proargnames) as arg(name)
    where n.nspname='public' and p.proname='fn_concentration_check'
      and arg.name in ('entity_type','entity_id','entity_name','concentration_pct','flag_level')
    group by p.oid
    having count(distinct arg.name) = 5
  ) then
    raise exception 'CONC GATE [AC4]: colunas de retorno esperadas ausentes';
  end if;

  -- AC2/AC3/AC5: validação funcional com uma alocação real do seed (se houver)
  select id into alloc_id from public.allocations limit 1;
  if alloc_id is not null then
    select count(*) into total_rows from public.fn_concentration_check(alloc_id);

    -- flag_level só pode ser green/yellow/red
    select count(*) into bad_flag from public.fn_concentration_check(alloc_id)
      where flag_level not in ('green','yellow','red');
    if bad_flag > 0 then
      raise exception 'CONC GATE [AC5]: flag_level fora de {green,yellow,red}';
    end if;

    -- thresholds coerentes: red exige >60, green exige <40
    select count(*) into red_cnt from public.fn_concentration_check(alloc_id)
      where flag_level = 'red' and concentration_pct <= 60;
    if red_cnt > 0 then
      raise exception 'CONC GATE [AC5]: red com concentration_pct <= 60';
    end if;
    select count(*) into green_cnt from public.fn_concentration_check(alloc_id)
      where flag_level = 'green' and concentration_pct >= 40;
    if green_cnt > 0 then
      raise exception 'CONC GATE [AC5]: green com concentration_pct >= 40';
    end if;

    raise notice 'CONC GATE Story 6.1: validacao funcional OK (% linhas).', total_rows;
  else
    raise notice 'CONC GATE: nenhuma alocacao no seed para validacao funcional (pulado).';
  end if;

  -- Alocação inexistente => zero linhas (sem erro)
  if (select count(*) from public.fn_concentration_check('00000000-0000-0000-0000-000000000000'::uuid)) <> 0 then
    raise exception 'CONC GATE: alocacao inexistente deveria retornar 0 linhas';
  end if;

  raise notice 'CONC GATE Story 6.1: OK — assinatura (uuid), STABLE, colunas e flag_level verificados.';
end $$;

-- ============================================================================
-- Fim — Detector de concentração fn_concentration_check() (Story 6.1).
-- ============================================================================
