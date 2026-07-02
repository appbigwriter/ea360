---
name: project-doc-layout
description: Where Launch Studio PRO keeps its source-of-truth docs (PRD is NOT under docs/)
metadata:
  type: project
---

Launch Studio PRO (1LaunchFormula) document layout — source-of-truth locations that differ from the AIOX default `docs/` convention.

- **PRD:** `prd/prd.md` (project root `prd/`, NOT `docs/prd/`). Acceptance criteria live in §12. DB schema §8, LLM routing §5, agents §6, dossier JSON schema §9.2, cost §10, security §11.
- **Skill base:** `prd/software-premium-params.md` — generic Premium tables (§11.x) sourced here.
- **Design System v2 source:** `prd/design-system-v2.html` — CSS tokens extracted into `app/globals.css` (story 1.3).
- **Deliverables / compliance spec:** `docs/deliverables/MVP-DELIVERABLES.md` — maps each deliverable to PRD §12; owner-locked decisions (Next.js 15 + Supabase, paid APIs as mocks, git NOT initialized).
- **Stories:** `docs/stories/{epic}.{story}.story.md` (24 stories, epics 1-7). Central QA audit: `docs/stories/STORIES-QA-REVIEW.md`.

**Why:** the spawn prompt referenced `prd/prd.md` and `docs/deliverables/` directly; a `docs/prd/` path does not exist and will 404.
**How to apply:** when auditing or tracing requirements, read `prd/prd.md` (root) for the PRD. Bash `cd`-relative listing resets between calls in this env — use Glob or absolute paths.
