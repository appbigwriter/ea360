---
name: project-ea360-mvp
description: EA360 MVP deliverables baseline — source of truth, epic structure, scope boundary
metadata:
  type: project
---

EA360 (Entrepreneur Ads 360) MVP deliverables are listed in `docs/deliverables/MVP-DELIVERABLES.md`: 51 deliverables (D-001..D-051) across 9 epics (E-FND, E-GOM, E-INT, E-MENU, E-ALOC, E-RISK, E-PNL, E-EXEC, E-XACC), each traceable to PRD acceptance criteria.

**Why:** PRD `prd/EA360-PRD.md` is the single source of truth (Article IV — No Invention). MVP scope = core features R1-R7 + foundation; PRD §4 roadmap features are explicitly OUT of MVP.

**How to apply:** When creating epics/stories, derive from this deliverables list and its PRD references, not from new ideas. Stack is fixed: Next.js (App Router/RSC) + Tailwind/shadcn + Supabase (Postgres+RLS, Auth, pgvector) + Anthropic SDK + Firecrawl + n8n + Meta/WhatsApp API. Sequencing: E-FND → E-GOM → E-INT → E-MENU → E-ALOC → (E-RISK ∥ E-PNL) → E-EXEC; E-XACC permeates all. Existential risks: Oracle freshness (D-044) and Meta API access (D-045/D-046, marked Should).
