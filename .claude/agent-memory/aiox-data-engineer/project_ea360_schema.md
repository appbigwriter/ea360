---
name: ea360-schema
description: EA360 (Entrepreneur Ads 360) Supabase data model — table groups, RLS strategy, migration layout
metadata:
  type: project
---

EA360 is a monetization-portfolio allocator (Next.js + Supabase). The data model is fully defined across three migrations in `supabase/migrations/`:

- `20260101000000_init_ea360.sql` — extensions (pgcrypto, vector), 9 enums, all tables, inline RLS, business functions (`fn_channel_score`, `fn_match_channels`, `fn_concentration_check`), and GOM seed (3 pillars, 7 categories, 49 channels, 8 interview questions). Source of truth mirrored at `prd/0001_init_ea360.sql` (identical).
- `20260101000001_rls_policies.sql` — idempotent RLS reinforcement; splits per-command policies, makes `owns_business()` SECURITY DEFINER, and closes the init's gap by enabling RLS + public-read on `oracle_documents`.
- `20260101000002_indexes.sql` — performance indexes incl. ivfflat on `oracle_documents.embedding` (vector(1536), cosine).

**Why:** Multi-tenant by `businesses.owner_id = auth.uid()`. GOM tables (`gom_pillars/categories/channels`) and `interview_questions` are public-read (no auth). Oracle docs written only by service_role (RLS bypass).

**How to apply:** Migrations are NOT applied to the live shared prod DB by this agent — application is @devops/deploy-flow responsibility. Connecting to the prod Supabase pooler with env.exemplo creds is denied. Validate SQL statically.
