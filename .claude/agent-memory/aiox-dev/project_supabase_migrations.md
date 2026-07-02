---
name: project-supabase-migrations
description: EA360 migration conventions and that the Supabase CLI is unavailable in the agent environment (db push deferred to quality gate)
metadata:
  type: project
---

Migrações Supabase do EA360 ficam em `supabase/migrations/` com convenção `2026010100000N_<slug>_story<XY>.sql` (timestamp sequencial, NÃO `00NN_...`). Cada migração de schema é ADITIVA e IDEMPOTENTE e termina com um bloco `DO $$ ... $$` GATE que faz `raise exception` se algum AC não bater — isso falha o `supabase db push` deterministicamente. Funções `set_updated_at()` e `owns_business(uuid)` existem desde `20260101000000_init_ea360.sql` e devem ser REUSADAS (IDS). RLS por tenant usa `owns_business(business_id)`; tabelas filhas herdam escopo via EXISTS na tabela pai.

**Why:** padrão estabelecido nas stories 2.1, 4.1, 5.1; mantém ordenação do push e consistência de RLS entre módulos.

**How to apply:** ao criar migração de schema, siga o naming sequencial, reuse os helpers, e embuta o GATE. O CLI `supabase` NÃO está no PATH do ambiente do agente — `supabase db push` não roda aqui; deixe a aplicação/validação para o quality gate (@dev/@devops) com CLI. Falta de CLI é ambiental, não defeito. `tsc --noEmit` e `eslint` não cobrem `.sql`. Ver [[project-build-env-guard]].
