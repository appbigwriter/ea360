-- ============================================================================
-- EA360 — Migração 0018: Guardrails configuráveis (Story 6.3)
-- ----------------------------------------------------------------------------
-- AC da Story 6.3:
--   AC1: usuário configura guardrails — concentração máx. por pilar (%), por canal
--        (%), downside máx. total (R$ ou %), mínimo por pilar (%).
--   AC2: configurações salvas em JSONB na tabela `allocations` (campo
--        `guardrail_config`).
--
-- Escopo desta migração: APENAS a coluna `guardrail_config jsonb` em `allocations`
-- (AC2). A verificação dos guardrails (AC3–AC5) é implementada na engine TypeScript
-- (`src/lib/allocation/engine.ts` — `checkGuardrails`), não em SQL, seguindo a mesma
-- decisão de manutenibilidade da Story 6.2 (downside na engine, não em SQL puro).
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE (sem modificar): tabela `allocations` (Story 5.1, migração 0015) como alvo
--          da nova coluna; o padrão JSONB já é usado por `risk_band_ratios` na mesma
--          tabela. Reusar o campo JSONB evita uma tabela dedicada (Article IV).
--   ADAPT (< 30%): adiciona UMA coluna nullable a `allocations` — aditiva, não
--          quebra consumidores (Story 5.x leem outras colunas). Sem novo enum/FK.
--
-- Migração ADITIVA e IDEMPOTENTE (`add column if not exists`), no mesmo padrão da
-- migração 0017 (downside_estimate, Story 6.2).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC2 — coluna guardrail_config (JSONB nullable). NULL = sem guardrails
--    configurados (guardrails são OPCIONAIS — aviso, não bloqueio).
-- ----------------------------------------------------------------------------
alter table public.allocations
  add column if not exists guardrail_config jsonb;

comment on column public.allocations.guardrail_config is
  'Story 6.3 — guardrails de risco configuráveis (JSONB). Chaves: '
  'maxPillarConcentrationPct, maxChannelConcentrationPct, minPillarPct, '
  'maxDownsideAmount, maxDownsidePct. NULL = sem guardrails. Verificação na engine '
  '(checkGuardrails) — guardrails avisam, não bloqueiam.';

-- ----------------------------------------------------------------------------
-- 2. GATE de verificação — falha o `supabase db push` se o AC2 não bater.
-- ----------------------------------------------------------------------------
do $$
begin
  -- AC2: coluna guardrail_config existe e é jsonb.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allocations'
      and column_name = 'guardrail_config'
  ) then
    raise exception 'GUARDRAIL GATE [AC2]: allocations sem coluna guardrail_config';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allocations'
      and column_name = 'guardrail_config'
      and data_type = 'jsonb'
  ) then
    raise exception 'GUARDRAIL GATE [AC2]: guardrail_config deve ser jsonb';
  end if;

  -- AC1 (aviso, não bloqueio): a coluna deve ser NULLABLE — guardrails opcionais.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allocations'
      and column_name = 'guardrail_config'
      and is_nullable = 'YES'
  ) then
    raise exception 'GUARDRAIL GATE [AC1]: guardrail_config deve ser NULLABLE (opcional)';
  end if;

  raise notice 'GUARDRAIL GATE Story 6.3: OK — coluna guardrail_config (jsonb, nullable) verificada.';
end $$;

-- ============================================================================
-- Fim — Guardrails configuráveis (Story 6.3).
-- ============================================================================
