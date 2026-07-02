---
name: ea360-stack
description: EA360 (Entrepreneur Ads 360) tech stack and dependency baseline — what the app package.json must cover
metadata:
  type: project
---

EA360 is a monetization-portfolio allocator app. Stack per `prd/EA360-PRD.md`: Next.js (App Router/RSC/Server Actions) + React + Tailwind CSS v4 + Supabase (Postgres+RLS, Auth, Storage, Edge Functions, pgvector for the Oráculo RAG).

**Why:** PRD §7 ("Bibliotecas necessárias") is the source-of-truth dependency list. Constitution Article IV (No Invention) — do not add stack/deps beyond PRD.

**How to apply:**

- App `package.json` lives at the **project root** (`F:\Projetos\1EA360\package.json`, name `ea360`). Do NOT confuse with `.aiox-core/package.json` (framework L1, never modify).
- Package manager: **npm** (package-lock.json present). pnpm also available but lockfile is npm.
- Tailwind is **v4** — uses `@tailwindcss/postcss`, which handles prefixing. `autoprefixer` IS installed as a devDep (to honor PRD §7 literal list) but is deliberately NOT wired into `postcss.config.mjs` (only `@tailwindcss/postcss` there) to avoid double-prefixing. `postcss` itself is transitive, not a direct dep. This is the deviation from PRD §7's literal list.
- LLM = Anthropic (`@anthropic-ai/sdk`), embeddings = OpenAI (`openai`, text-embedding-3-small, 1536 dims), scraping = `@mendable/firecrawl-js`.
- Charts: PRD allows recharts OR visx — repo chose `recharts`.
- Quality gates that pass clean: `npm run lint`, `npx tsc --noEmit`. Test stack: vitest + @testing-library/react; e2e: @playwright/test.
