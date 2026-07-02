-- ============================================================================
-- EA360 — Migração 00023: labels EN no enum flag_level (unificação)
-- ----------------------------------------------------------------------------
-- O init 0000 criou flag_level em PT (verde/amarelo/vermelho). O código das Stories
-- 6.4 (risk_flags.level) e 8.3 (compliance_checks.flag_level) usa EN
-- (green/yellow/red). Em vez de reescrever o código, ADICIONAMOS os labels EN ao
-- enum (aditivo, idempotente) para unificar. Precisa ser migração própria (o valor
-- novo só é usável após commit — separado das colunas que o referenciam).
-- ============================================================================
alter type public.flag_level add value if not exists 'green';
alter type public.flag_level add value if not exists 'yellow';
alter type public.flag_level add value if not exists 'red';

do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='flag_level' and e.enumlabel='green') then
    raise exception 'FLAG_ENUM GATE: label green nao adicionado';
  end if;
  raise notice 'FLAG_ENUM GATE 00023: OK — labels EN adicionados a flag_level.';
end $$;
