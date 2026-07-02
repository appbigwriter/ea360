-- ============================================================================
-- EA360 — Migração 0017: Coluna downside_estimate em allocation_items (Story 6.2)
-- ----------------------------------------------------------------------------
-- AC da Story 6.2:
--   AC1: downside_estimate por item = amount * risk_loss_rate, onde
--        risk_loss_rate = (risk_score - 1) / 4 * 0.8 + 0.2
--        (risk 1 => 20% de perda; risk 5 => 100% de perda).
--   AC2: downside total da carteira = soma dos downside_estimate por canal.
--   AC3: valores exibidos na UI (por canal + total) — fora desta migração.
--   AC4: downside_estimate persistido em allocation_items (coluna nova aqui).
--   AC5: cálculo na engine TypeScript (calcDownside) — fora desta migração.
--
-- IDS: REUSE > ADAPT > CREATE.
--   REUSE (sem modificar): tabela allocation_items (Story 5.1, migração 0015) e seu
--     contrato de colunas. Apenas ADICIONAMOS uma coluna aditiva — não recriamos a
--     tabela nem alteramos colunas existentes, mantendo compatibilidade total com
--     o GATE da Story 5.1 (Article IV — No Invention).
--   CREATE (justificado): coluna downside_estimate NÃO existe. Capacidade nova:
--     persistir a perda máxima estimada por canal (PRD R5 "modela downside" / F3.3
--     "modelo de downside"). O valor é calculado pela engine (AC5) e gravado pela
--     Server Action allocateBudget.
--
-- Migração ADITIVA e IDEMPOTENTE (mesmo padrão das migrações 0006/0013/0015).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC4 — coluna downside_estimate (>= 0, default 0, nullable=false para que o
--    total da carteira seja sempre somável sem coalesce). Itens legados existentes
--    recebem 0 e serão recalculados na próxima geração de carteira.
-- ----------------------------------------------------------------------------
alter table public.allocation_items
  add column if not exists downside_estimate numeric not null default 0
    check (downside_estimate >= 0);

comment on column public.allocation_items.downside_estimate is
  'Story 6.2 — perda máxima estimada do canal em R$. '
  'downside = amount * ((risk_score - 1) / 4 * 0.8 + 0.2). '
  'Calculado pela engine TypeScript (calcDownside) e persistido pela Server Action.';

-- ----------------------------------------------------------------------------
-- 2. GATE de verificação — falha o `supabase db push` se o AC4 não bater.
-- ----------------------------------------------------------------------------
do $$
begin
  -- AC4: coluna existe
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allocation_items'
      and column_name = 'downside_estimate'
  ) then
    raise exception 'DOWNSIDE GATE [AC4]: allocation_items sem coluna downside_estimate';
  end if;

  -- AC4: NOT NULL (total sempre somável)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'allocation_items'
      and column_name = 'downside_estimate'
      and is_nullable = 'YES'
  ) then
    raise exception 'DOWNSIDE GATE [AC4]: downside_estimate deve ser NOT NULL';
  end if;

  -- AC1: check de não-negatividade presente
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'allocation_items'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%downside_estimate%'
  ) then
    raise exception 'DOWNSIDE GATE [AC1]: check de downside_estimate >= 0 ausente';
  end if;

  raise notice 'DOWNSIDE GATE Story 6.2: OK — coluna downside_estimate verificada.';
end $$;

-- ============================================================================
-- Fim — Coluna downside_estimate em allocation_items (Story 6.2).
-- ============================================================================
