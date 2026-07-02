---
name: project-launch-studio-pro
description: Launch Studio PRO + EA360 — MVP stories. Launch Studio PRO: 22 stories (2026-06-25). EA360: 51 stories total across 9 epics, 5 added 2026-06-26 (E-XACC 9.1–9.5).
metadata:
  type: project
---

## EA360 Project (F:\Projetos\1EA360)

51 MVP stories across 9 epics. Stack: Next.js 15 App Router + Supabase + Anthropic SDK + pgvector + Firecrawl + n8n + Meta/WhatsApp API.

Stories 1.1–8.10 existed (45 stories). Stories 9.1–9.5 created 2026-06-26 for E-XACC (D047–D051):

- 9.1 Instrumentação de ativação (interview_completed → menu_generated)
- 9.2 Instrumentação de valor percebido (allocation_saved, oracle_queried)
- 9.3 Observabilidade (Sentry / @sentry/nextjs — opcional)
- 9.4 Base de qualidade (TypeScript strict + ESLint + Prettier)
- 9.5 Suíte de testes (Vitest + Testing Library + Playwright e2e)

Epic sequence: E-FND(1) → E-GOM(2) → E-INT(3) → E-MENU(4) → E-ALOC(5) → E-RISK(6) → E-PNL(7) → E-EXEC(8) → E-XACC(9 transversal)

---

## Launch Studio PRO (separate project)

MVP batch of 22 stories created for **Launch Studio PRO** (Suite Sextou.biz Premium Apps).

**Why:** Full-stack premium app with multi-LLM orchestration (all stubs), PLF-based launch dossier generation, Supabase RLS, and a DS v2 mobile-first UI.

**How to apply:** When creating new stories or expanding epics for this project, reference the existing story IDs and their File Lists to avoid duplication.

**Stack**: Next.js 15 App Router + TypeScript strict + Tailwind CSS v3 + Supabase (`@supabase/ssr`)

**All APIs paid (LLM, PDF, Stripe): mock adapters only — zero real keys required**

**Story IDs created:**

- 1.1 Scaffold Next.js 15
- 1.2 Supabase client + Zod env
- 1.3 Design System v2 (fontes + tokens + primitivos)
- 2.1 DB: tabelas base
- 2.2 DB: tabelas premium do app
- 2.3 DB: tabelas premium genéricas (skill base)
- 2.4 DB: RLS + índices + require_premium() + seed
- 3.1 Auth (login/cadastro)
- 3.2 premiumGate middleware
- 3.3 /upgrade page + PremiumGate component
- 4.1 Multi-LLM provider layer + mock adapters + router
- 4.2 Cost tracker
- 4.3 Prompt contracts + dossier schema + safety
- 5.1 Dashboard "Meus Lançamentos"
- 5.2 Briefing inicial (3 campos)
- 5.3 Entrevista multi-step (10 etapas)
- 5.4 Revisão do briefing
- 5.5 Geração do dossiê (orquestra agentes stub)
- 5.6 Preview do dossiê por abas
- 5.7 Histórico + versionamento + regeneração por fase
- 6.1 Export Markdown + JSON
- 6.2 Export PDF (stub) + ZIP pack
- 7.1 Limites por plano + modal upgrade
- 7.2 Rate limit + alertas de custo + sanitização

**Key constraints:**

- Acesso premium: `users.is_premium = TRUE` enforced server-side in middleware
- Conformidade PLF: Pré-Pré → PLC 1/2/3 → Abertura → Fechamento
- Keys server-only, logs sanitizados, nenhuma chave no client

[[feedback-story-creation]]
