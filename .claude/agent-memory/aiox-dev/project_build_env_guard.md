---
name: project-build-env-guard
description: EA360 `npm run build` fails without Supabase env vars due to fail-fast guard in src/lib/env.ts
metadata:
  type: project
---

`npm run build` (Next.js) falha em "Collecting page data" para rotas que importam o cliente Supabase quando `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` não estão definidas.

**Why:** `src/lib/env.ts` (Story 1.2) usa `requireEnv()` que lança erro no load do módulo se a env var estiver ausente — guard intencional fail-fast.

**How to apply:** No ambiente do agente (sem `.env`), valide build com placeholders: `NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder" npm run build`. Uma falha de build com a mensagem do `[env]` guard é ambiental, não defeito de código. `tsc --noEmit` e `eslint` rodam sem env vars.
