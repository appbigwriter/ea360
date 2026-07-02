# EA360 — MVP Deliverables (Conformidade com o PRD)

> **Autor:** @pm (Morgan, Strategist) — autônomo
> **Data:** 2026-06-26
> **Fonte única de verdade:** `prd/EA360-PRD.md` (+ `prd/conceitoEA360.md`, `prd/0001_init_ea360.sql`)
> **Princípio:** AIOX Article IV — No Invention. Todo entregável rastreia a um recurso (R1–R7), fase (F1–F4), modelo de dados (§8), arquitetura (§5) ou métrica de sucesso (§10) do PRD. Nada foi inventado.
> **Stack declarada (PRD §5–§7):** Next.js (App Router, RSC, Server Actions) + React + Tailwind/shadcn, Supabase (Postgres+RLS, Auth, Storage, Edge Functions, pgvector), Anthropic SDK (LLM), provedor de embeddings, Firecrawl, n8n, Meta/WhatsApp API.

## Como ler este documento

- **ID:** identificador estável do entregável (D-NNN).
- **Épico:** agrupamento por fase do PRD §9 (F1–F4) mais épicos transversais (E-FND, E-XACC).
- **Critérios de aceite (rastreáveis):** citação direta dos critérios do PRD com referência (`R#`, `F#.#`, `§#`).
- **Prioridade:** MoSCoW. **Must** = bloqueia conformidade MVP; **Should** = necessário para MVP completo mas com fallback; **Could** = melhora valor sem bloquear.

> Escopo MVP = recursos **core** do PRD §3 (R1–R7) + fundação. Os "Recursos Adicionais / roadmap" (PRD §4) ficam **fora** do MVP e estão listados ao final como referência (não entregáveis MVP).

---

## Mapa de Épicos

| Épico  | Nome                                                | Fonte PRD         | Deliverables  |
| ------ | --------------------------------------------------- | ----------------- | ------------- |
| E-FND  | Fundação, Auth & Schema                             | F1.1–F1.2, §5, §8 | D-001 → D-005 |
| E-GOM  | GOM (Guia de Opções de Monetização)                 | R2, F1.3–F1.4, §8 | D-006 → D-010 |
| E-INT  | Entrevista 360 & Perfil                             | R1, F2.1–F2.2, §8 | D-011 → D-016 |
| E-MENU | Menu Personalizado (matchmaking)                    | R3, F2.3–F2.4, §8 | D-017 → D-021 |
| E-ALOC | Alocador de Portfólio                               | R4, F3.1–F3.2, §8 | D-022 → D-027 |
| E-RISK | Mitigador de Risco                                  | R5, F3.3, §8      | D-028 → D-031 |
| E-PNL  | Painel 360                                          | R6, F3.4, §8      | D-032 → D-036 |
| E-EXEC | Nó Executor WhatsApp + Oráculo                      | R7, F4.1–F4.4, §8 | D-037 → D-046 |
| E-XACC | Transversais (métricas, observabilidade, qualidade) | §10, §5, §7       | D-047 → D-051 |

---

## E-FND — Fundação, Auth & Schema

### D-001 — Bootstrap do projeto Next.js + Tailwind

- **Épico:** E-FND
- **Critérios de aceite (PRD):** "projeto Next.js, Tailwind" (F1.1); stack Front = "Next.js (App Router, Server Actions, RSC) + React + Tailwind CSS" (§5); bibliotecas núcleo `next`, `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer` + UI `@radix-ui/*`+`shadcn/ui`, `lucide-react`, `cmdk`, `framer-motion` (§7).
- **Prioridade:** Must

### D-002 — Cliente Supabase (SSR) e configuração de ambiente

- **Épico:** E-FND
- **Critérios de aceite (PRD):** Backend/DB = Supabase Postgres+RLS, Auth, Storage, Edge Functions (§5); libs `@supabase/supabase-js`, `@supabase/ssr` (§7); pré-requisitos Supabase CLI (§6); env conforme `.env.exemplo` (cabeçalho PRD).
- **Prioridade:** Must

### D-003 — Autenticação (login/cadastro) e identidade

- **Épico:** E-FND
- **Critérios de aceite (PRD):** "login/cadastro, RLS base" (F1.1); tabelas de Identidade `profiles`, `businesses` (§8); Supabase Auth (§5).
- **Prioridade:** Must

### D-004 — Migração de schema completa (tabelas, enums, triggers, funções)

- **Épico:** E-FND
- **Critérios de aceite (PRD):** "todas as tabelas, enums, triggers, funções" (F1.2); modelo de dados §8 com todas as tabelas (Identidade, GOM, Diagnóstico, Recomendação, Alocação, Risco, Painel, Executor/Oráculo) e funções `set_updated_at()`, `fn_channel_score()`, `fn_match_channels()`, `fn_concentration_check()`; base em `supabase/migrations/0001_init_ea360.sql`.
- **Prioridade:** Must

### D-005 — Políticas RLS base por business/tenant

- **Épico:** E-FND
- **Critérios de aceite (PRD):** "RLS base" (F1.1); "Postgres com RLS" (§5); isolamento por `businesses`/`profiles` (§8).
- **Prioridade:** Must

---

## E-GOM — GOM (Guia de Opções de Monetização) — R2

### D-006 — Modelo de dados do GOM (pilares, categorias, canais)

- **Épico:** E-GOM
- **Critérios de aceite (PRD):** tabelas GOM `gom_pillars`, `gom_categories`, `gom_channels` (§8); "Catálogo navegável dos ~50 canais em 3 pilares, cada um com os cinco atributos" (R2); 3 pilares (Ads, Afiliações, Parcerias) e cinco atributos Custo/Payback/Controle/Risco/Escala (conceito §5, referenciado pelo PRD R2).
- **Prioridade:** Must

### D-007 — Seed completo dos ~50 canais com atributos e notas 1–5

- **Épico:** E-GOM
- **Critérios de aceite (PRD):** "seed completo via migração" e "cada canal com notas 1–5 que alimentam o alocador" (R2); "Seed do GOM — popular pilares, categorias e os ~50 canais com atributos" (F1.3); fonte `Guia-de-Opcoes-de-Advertising-EA360.md` semeada pela migração.
- **Prioridade:** Must

### D-008 — Função de scoring de canal `fn_channel_score()`

- **Épico:** E-GOM
- **Critérios de aceite (PRD):** função `fn_channel_score()` (§8); notas 1–5 "que alimentam o alocador" (R2).
- **Prioridade:** Must

### D-009 — GOM Browser: navegação pública com busca e filtro

- **Épico:** E-GOM
- **Critérios de aceite (PRD):** "leitura pública (sem auth); busca e filtro por pilar/atributo" (R2); "GOM browser — UI pública de navegação, busca e filtro do guia" (F1.4); command palette/busca via `cmdk` (§7).
- **Prioridade:** Must

### D-010 — Página de detalhe do canal (cinco atributos + notas)

- **Épico:** E-GOM
- **Critérios de aceite (PRD):** "cada canal com notas 1–5" e "cinco atributos de comportamento" (R2); leitura pública (R2/F1.4).
- **Prioridade:** Should

---

## E-INT — Entrevista 360 & Perfil de Monetização — R1

### D-011 — Modelo de dados da Entrevista

- **Épico:** E-INT
- **Critérios de aceite (PRD):** tabelas `interviews`, `interview_questions`, `interview_answers` (§8); captura das "quatro camadas (objetivos & metas, filosofia & valores, momento, recursos)" (R1).
- **Prioridade:** Must

### D-012 — UI conversacional da Entrevista 360

- **Épico:** E-INT
- **Critérios de aceite (PRD):** "Entrevista conversacional que captura quatro camadas" (R1); "UI conversacional" (F2.1).
- **Prioridade:** Must

### D-013 — Perguntas ramificadas via LLM (Anthropic SDK)

- **Épico:** E-INT
- **Critérios de aceite (PRD):** "perguntas ramificadas via LLM" (R1); "perguntas ramificadas" (F2.1); IA "LLM para Entrevista" (§5); `@anthropic-ai/sdk` (§7).
- **Prioridade:** Must

### D-014 — Salvamento por etapa (resumir entrevista)

- **Épico:** E-INT
- **Critérios de aceite (PRD):** "salvamento por etapa" (R1 e F2.1).
- **Prioridade:** Must

### D-015 — Geração e persistência do Perfil de Monetização

- **Épico:** E-INT
- **Critérios de aceite (PRD):** "gera um perfil de monetização estruturado" e "saída como objeto consultável" (R1); tabela `monetization_profiles` (§8); "geração e persistência do objeto de perfil" (F2.2).
- **Prioridade:** Must

### D-016 — Filtro de filosofia (marca canais a excluir)

- **Épico:** E-INT
- **Critérios de aceite (PRD):** "filtro de filosofia que marca canais a excluir" (R1); "filtro de filosofia" (F2.2).
- **Prioridade:** Must

---

## E-MENU — Menu Personalizado (Matchmaking) — R3

### D-017 — Modelo de dados de recomendação

- **Épico:** E-MENU
- **Critérios de aceite (PRD):** tabelas `recommendations`, `recommendation_items` (§8).
- **Prioridade:** Must

### D-018 — Função de matchmaking pontuável `fn_match_channels()`

- **Épico:** E-MENU
- **Critérios de aceite (PRD):** "função de matchmaking pontuável" (R3); `fn_match_channels()` (§8); "Matchmaking — `fn_match_channels`, pontuação e ranking" (F2.3).
- **Prioridade:** Must

### D-019 — Cálculo de gasto estimado, faixa de retorno, payback e nota de risco

- **Épico:** E-MENU
- **Critérios de aceite (PRD):** "opções rankeadas com gasto estimado, faixa de retorno, payback, nota de risco e justificativa de fit" (R3).
- **Prioridade:** Must

### D-020 — Camada de rationale via LLM ("porquê cabe / porquê evitar")

- **Épico:** E-MENU
- **Critérios de aceite (PRD):** "camada de rationale (LLM) com 'porquê cabe / porquê evitar'" (R3); "rationale via LLM" (F2.4); IA LLM (§5).
- **Prioridade:** Must

### D-021 — UI do menu (cards de canal, faróis, ordenação por critério)

- **Épico:** E-MENU
- **Critérios de aceite (PRD):** "ordenação por critério" (R3); "UI do menu — cards de canal, faróis, rationale via LLM, ordenação" (F2.4).
- **Prioridade:** Must

---

## E-ALOC — Alocador de Portfólio — R4

### D-022 — Modelo de dados de alocação e experimentos

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** tabelas `allocations`, `allocation_items`, `experiments` (§8).
- **Prioridade:** Must

### D-023 — Engine de alocação 70/20/10 parametrizável

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** "Distribui a verba entre faixas de risco (núcleo 70 / crescimento 20 / experimento 10, parametrizável)" e "engine de alocação" (R4); "Alocador — engine 70/20/10 ... persistência de carteira" (F3.1).
- **Prioridade:** Must

### D-024 — Simulador de cenário

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** "simulador de cenário" (R4 e F3.1); gráficos via `recharts`/`visx` (§7).
- **Prioridade:** Should

### D-025 — Teto por canal (guardrail)

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** "teto por canal" (R4); "Guardrails — teto por canal ..." (F3.2).
- **Prioridade:** Must

### D-026 — Mínimo entre pilares (guardrail)

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** "mínimo entre pilares" (R4 e F3.2).
- **Prioridade:** Must

### D-027 — Kill-criteria obrigatório por experimento

- **Épico:** E-ALOC
- **Critérios de aceite (PRD):** "todo experimento com kill-criteria" (R4); "kill-criteria de experimento" (F3.2); tabela `experiments` (§8).
- **Prioridade:** Must

---

## E-RISK — Mitigador de Risco — R5

### D-028 — Detector de concentração `fn_concentration_check()`

- **Épico:** E-RISK
- **Critérios de aceite (PRD):** "detector de concentração" (R5); "detecta concentração por plataforma/parceiro" (R5); `fn_concentration_check()` (§8); "Mitigador de risco — `fn_concentration_check` ..." (F3.3).
- **Prioridade:** Must

### D-029 — Modelo de perda/downside por canal

- **Épico:** E-RISK
- **Critérios de aceite (PRD):** "modela downside" e "modelo de perda por canal" (R5); "modelo de downside" (F3.3).
- **Prioridade:** Must

### D-030 — Guardrails configuráveis

- **Épico:** E-RISK
- **Critérios de aceite (PRD):** "impõe guardrails" e "guardrails configuráveis" (R5).
- **Prioridade:** Must

### D-031 — Flags com farol vermelho/amarelo/verde

- **Épico:** E-RISK
- **Critérios de aceite (PRD):** "flags com farol" e "flags vermelho/amarelo/verde" (R5); tabela `risk_flags` (§8).
- **Prioridade:** Must

---

## E-PNL — Painel 360 — R6

### D-032 — Modelo de dados de métricas e reviews

- **Épico:** E-PNL
- **Critérios de aceite (PRD):** tabelas `channel_metrics`, `allocation_reviews` (§8).
- **Prioridade:** Must

### D-033 — Ingest de métricas por canal (ROAS, CPA, payback, contribuição)

- **Épico:** E-PNL
- **Critérios de aceite (PRD):** "ingest de métricas por canal (ROAS, CPA, payback, contribuição)" (R6); "ingest de métricas" (F3.4).
- **Prioridade:** Must

### D-034 — Visualização real vs. projetado por canal

- **Épico:** E-PNL
- **Critérios de aceite (PRD):** "Mede real vs. projetado por canal" (R6); "real vs. projetado" (F3.4); gráficos `recharts`/`visx` (§7).
- **Prioridade:** Must

### D-035 — Recomendação de rebalanceamento

- **Épico:** E-PNL
- **Critérios de aceite (PRD):** "rebalanceia" e "recomendação de rebalanceamento" (R6); "loop de rebalanceamento" (F3.4).
- **Prioridade:** Must

### D-036 — Loop de reavaliação que realimenta a Entrevista

- **Épico:** E-PNL
- **Critérios de aceite (PRD):** "realimenta a Entrevista" e "loop de reavaliação" (R6); ciclo contínuo (conceito §4, referenciado pelo PRD).
- **Prioridade:** Should

---

## E-EXEC — Nó Executor WhatsApp + Oráculo — R7

### D-037 — Arquiteto de funil (CTWA → janela grátis → bot → nurture)

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** subcomponente "Arquiteto de funil" (R7).
- **Prioridade:** Must

### D-038 — Forja de copy (templates aprováveis, categoria correta)

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "Forja de copy (templates aprováveis, categoria correta)" (R7); "Forja & Blindagem — geração de copy/templates" (F4.1); IA "LLM para ... Forja de copy" (§5).
- **Prioridade:** Must

### D-039 — Blindagem: pre-flight anti-ban com farol

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "Blindagem (pre-flight anti-ban)" (R7); "pre-flight anti-ban" (F4.1); tabela `compliance_checks` (§8); métrica "taxa de campanhas que passam a Blindagem sem flag vermelho" (§10).
- **Prioridade:** Must

### D-040 — Bot sempre identificado + escape humano

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "bot sempre identificado + escape humano" (R7).
- **Prioridade:** Must

### D-041 — Oráculo: store vetorial pgvector + modelo de dados

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "pgvector para o Oráculo" (§5); tabela `oracle_documents` (§8); "Oráculo RAG — `pgvector`, ingestão" (F4.2).
- **Prioridade:** Must

### D-042 — Ingestão e embeddings de documentos de política

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "modelo de embeddings para RAG" (§5); SDK de embeddings `openai` (§7); "ingestão" (F4.2).
- **Prioridade:** Must

### D-043 — Oráculo Q&A (RAG) com fonte citada

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "Oráculo (Q&A RAG sobre regras da Meta)" e "Oráculo com fonte citada" (R7); "Q&A com citação" (F4.2).
- **Prioridade:** Must

### D-044 — Pipeline de frescor: Firecrawl + cron (Edge Function)

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "re-scrape periódico" (R7); "Frescor do Oráculo: Firecrawl + cron (Edge Function agendada)" (§5); `@mendable/firecrawl-js` (§7); "Pipeline de frescor — Firecrawl + cron de re-scrape e re-embed" (F4.3); métrica "idade média das fontes (frescor) abaixo do limite" (§10); risco existencial (conceito §9).
- **Prioridade:** Must

### D-045 — Export do fluxo de funil para n8n

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "export do fluxo para n8n" (R7); "Export & execução — export do funil para n8n" (F4.4); n8n (§5, §6).
- **Prioridade:** Should

### D-046 — Integração Meta Marketing API + WhatsApp Cloud API

- **Épico:** E-EXEC
- **Critérios de aceite (PRD):** "Meta Marketing API + WhatsApp Cloud API + webhooks" (§5); "integração Meta/WhatsApp API" (F4.4); pré-requisito "conta Meta Business + WABA verificada" (§6).
- **Prioridade:** Should

---

## E-XACC — Transversais (Métricas, Observabilidade, Qualidade)

### D-047 — Instrumentação de ativação (Entrevista completa → menu gerado)

- **Épico:** E-XACC
- **Critérios de aceite (PRD):** métrica "Ativação: % de usuários que completam a Entrevista 360 e geram um menu" (§10); "analytics de produto" (§5).
- **Prioridade:** Should

### D-048 — Instrumentação de valor percebido (alocação salva, uso do Oráculo)

- **Épico:** E-XACC
- **Critérios de aceite (PRD):** "Valor percebido: % que salva uma alocação; uso recorrente do Oráculo" (§10).
- **Prioridade:** Should

### D-049 — Observabilidade (Sentry)

- **Épico:** E-XACC
- **Critérios de aceite (PRD):** "Observabilidade: Sentry + analytics de produto" (§5); `@sentry/nextjs` (§7, opcional).
- **Prioridade:** Could

### D-050 — Base de qualidade: TypeScript, ESLint, Prettier

- **Épico:** E-XACC
- **Critérios de aceite (PRD):** "typescript, eslint, prettier" (§7); AIOX Quality First (Article V).
- **Prioridade:** Should

### D-051 — Suíte de testes (Vitest + Testing Library + Playwright e2e)

- **Épico:** E-XACC
- **Critérios de aceite (PRD):** "vitest + @testing-library/react, playwright (e2e)" (§7).
- **Prioridade:** Should

---

## Fora do MVP (PRD §4 — Roadmap, não entregáveis MVP)

Listados apenas para rastreabilidade. NÃO são entregáveis de conformidade do MVP:

- Multi-tenant de agência (papéis) — §4
- Templates de carteira por setor — §4
- Comparador de cenários salvos (versionar/comparar) — §4
- Alertas proativos (teto estourado / kill-criteria batido) — §4
- Exportação de relatório PDF da carteira — §4
- Conectores de métrica automáticos (Meta/Google/afiliação via webhooks/n8n) — §4
- Modo white-label para agências — §4
- Biblioteca de criativos ligada à Forja — §4

---

## Avaliação de Risco (obrigatória — AIOX PM)

| Risco                                                     | Impacto                                             | Mitigação (dentro do escopo MVP)                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Frescor do Oráculo** (conceito §9: "existencial")       | Conselho de conformidade desatualizado vira passivo | D-044 (Firecrawl+cron) é **Must**; métrica de frescor §10 (D-048 mede uso)                                                      |
| **Acesso à Meta/WhatsApp API** (conceito §9)              | Bloqueia execução real do nó WhatsApp               | D-045/D-046 marcados **Should**; MVP entrega valor como "advisor que gera os ativos" (D-037–D-040) antes da integração profunda |
| **Qualidade de seed do GOM** (R2/F1.3)                    | Alocador e matchmaking dependem das notas 1–5       | D-007 **Must** com seed completo dos ~50 canais; D-008 `fn_channel_score` valida consumo                                        |
| **Conformidade no DNA** (constituição ética, conceito §6) | Recomendação que leva a ban destrói confiança       | D-039 Blindagem + D-016 filtro de filosofia + D-040 bot identificado, todos **Must**; métrica "zero incidentes de ban" (§10)    |
| **RLS/isolamento multi-business**                         | Vazamento de dados entre negócios                   | D-005 RLS base **Must** desde F1.1                                                                                              |

## Sequenciamento recomendado (dependências por fase do PRD §9)

`E-FND → E-GOM → E-INT → E-MENU → E-ALOC → (E-RISK ∥ E-PNL) → E-EXEC`; E-XACC permeia todas as fases.

## Cobertura de conformidade

Todos os recursos core do PRD §3 cobertos: R1 (D-011→D-016), R2 (D-006→D-010), R3 (D-017→D-021), R4 (D-022→D-027), R5 (D-028→D-031), R6 (D-032→D-036), R7 (D-037→D-046). Todas as fases F1–F4 (§9), todas as tabelas e funções do modelo §8, e as métricas de sucesso §10 têm entregável associado.
