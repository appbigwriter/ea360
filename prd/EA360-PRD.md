# PRD — Entrepreneur Ads 360 (EA360)

> Product Requirements Document. Base de execução para o time de engenharia. Stack: Next.js, React, Tailwind CSS, Supabase.
> Documentos relacionados: `conceitoEA360.md`, `Guia-de-Opcoes-de-Advertising-EA360.md`, `EA360-apresentacao.html`, `supabase/migrations/0001_init_ea360.sql`, `.env.exemplo`.

---

## 1. Proposta de Valor

**Para** empreendedores e agências que precisam monetizar um negócio **que** não sabem como alocar recursos entre dezenas de canais de receita e temem concentrar risco, **o EA360 é** um alocador de portfólio de monetização **que** diagnostica o momento da empresa, recomenda a carteira de canais que cabe agora e protege contra dependência de plataforma — **diferente de** ferramentas de disparo e BSPs, **o nosso produto** é a camada de julgamento independente, com conformidade no DNA, que não vende volume e por isso recomenda no interesse do cliente.

Pilares de valor: **coerência** (a mistura reflete o empreendedor), **assertividade** (alocação por dado) e **mitigação de risco** (diversificação + guardrails + corte).

---

## 2. Personas

- **Solopreneur / PME** — quer crescer, decide no achismo, teme ban.
- **Agência** — múltiplos clientes, precisa de método replicável e proteção.
- **Beachhead** — comunidade Sextou.biz (empreendedores brasileiros nos EUA).

---

## 3. Recursos do Sistema (core)

### R1 — Entrevista 360

Entrevista conversacional que captura quatro camadas (objetivos & metas, filosofia & valores, momento, recursos) e gera um perfil de monetização estruturado.

- Critérios: salvamento por etapa; perguntas ramificadas via LLM; filtro de filosofia que marca canais a excluir; saída como objeto consultável.

### R2 — GOM (Guia de Opções de Monetização)

Catálogo navegável dos ~50 canais em 3 pilares, cada um com os cinco atributos de comportamento.

- Critérios: leitura pública (sem auth); busca e filtro por pilar/atributo; cada canal com notas 1–5 que alimentam o alocador; seed completo via migração.

### R3 — Menu personalizado

Cruza o perfil (R1) com o GOM (R2) e devolve opções rankeadas com gasto estimado, faixa de retorno, payback, nota de risco e justificativa de fit.

- Critérios: função de matchmaking pontuável; camada de rationale (LLM) com "porquê cabe / porquê evitar"; ordenação por critério.

### R4 — Alocador de portfólio

Distribui a verba entre faixas de risco (núcleo 70 / crescimento 20 / experimento 10, parametrizável).

- Critérios: engine de alocação; simulador de cenário; teto por canal; mínimo entre pilares; todo experimento com kill-criteria.

### R5 — Mitigador de risco

Detecta concentração por plataforma/parceiro, modela downside e impõe guardrails com farol.

- Critérios: detector de concentração; modelo de perda por canal; guardrails configuráveis; flags vermelho/amarelo/verde.

### R6 — Painel 360

Mede real vs. projetado por canal, rebalanceia e realimenta a Entrevista.

- Critérios: ingest de métricas por canal (ROAS, CPA, payback, contribuição); recomendação de rebalanceamento; loop de reavaliação.

### R7 — Nó executor: WhatsApp Ads Advisor

Executa quando o portfólio aloca para mensageria paga.

- Subcomponentes: Arquiteto de funil; Forja de copy (templates aprováveis, categoria correta); Blindagem (pre-flight anti-ban); Oráculo (Q&A RAG sobre regras da Meta).
- Critérios: bot sempre identificado + escape humano; export do fluxo para n8n; Oráculo com fonte citada e re-scrape periódico.

---

## 4. Recursos Adicionais (não-core / roadmap)

- **Multi-tenant de agência** — múltiplos negócios sob uma conta, com papéis.
- **Templates de carteira por setor** — pontos de partida pré-configurados.
- **Comparador de cenários salvos** — versionar alocações e comparar.
- **Alertas proativos** — quando um canal estoura o teto ou um experimento bate o critério de corte.
- **Exportação de relatório** (PDF) da carteira recomendada.
- **Conectores de métrica** — Meta Ads, Google Ads, redes de afiliação, via webhooks/n8n.
- **Modo white-label** para agências revenderem.
- **Biblioteca de criativos** ligada à Forja de copy.

---

## 5. Arquitetura técnica (visão)

- **Front:** Next.js (App Router, Server Actions, RSC) + React + Tailwind CSS.
- **Backend/DB:** Supabase — Postgres com RLS, Auth, Storage, Edge Functions, `pgvector` para o Oráculo.
- **IA:** LLM para Entrevista, Forja de copy e Oráculo; modelo de embeddings para RAG.
- **Frescor do Oráculo:** Firecrawl (re-scrape das políticas da Meta) + cron (Edge Function agendada).
- **Orquestração/execução:** n8n para export de funil e automações; Meta Marketing API + WhatsApp Cloud API + webhooks.
- **Observabilidade:** Sentry + analytics de produto.

---

## 6. Lista de Dependências

### Serviços externos

- **Supabase** — banco, auth, storage, edge functions, vetor.
- **Provedor de LLM** (ex.: Anthropic) — entrevista, copy, oráculo.
- **Provedor de embeddings** (ex.: OpenAI) — vetorização para RAG.
- **Firecrawl** — coleta das páginas de política da Meta.
- **n8n** — orquestração e export de funil.
- **Meta (Graph/Marketing API + WhatsApp Cloud API)** — execução de ads e mensageria.
- **Sentry** (observabilidade), provedor de e-mail transacional (ex.: Resend) — opcionais.

### Pré-requisitos de ambiente

- Node.js LTS, pnpm/npm; Supabase CLI; conta Meta Business + WABA verificada (para o nó executor).

---

## 7. Bibliotecas necessárias

### Núcleo

- `next`, `react`, `react-dom`
- `tailwindcss`, `postcss`, `autoprefixer`
- `@supabase/supabase-js`, `@supabase/ssr`

### IA / RAG

- SDK do LLM escolhido (ex.: `@anthropic-ai/sdk`)
- SDK de embeddings (ex.: `openai`)
- `@mendable/firecrawl-js` (coleta)

### UI / produto

- `@radix-ui/react-*` + `shadcn/ui` (componentes)
- `lucide-react` (ícones)
- `recharts` ou `visx` (gráficos do Painel e do Alocador)
- `framer-motion` (micro-interações)
- `cmdk` (command palette / busca do GOM)

### Forms / validação / dados

- `react-hook-form`, `zod`
- `@tanstack/react-query` (estado de servidor)
- `date-fns`

### Qualidade / DX

- `typescript`, `eslint`, `prettier`
- `vitest` + `@testing-library/react`, `playwright` (e2e)
- `@sentry/nextjs` (opcional)

---

## 8. Modelo de dados (resumo)

Detalhe completo e seed em `supabase/migrations/0001_init_ea360.sql`. Tabelas principais:

- **Identidade:** `profiles`, `businesses`.
- **GOM:** `gom_pillars`, `gom_categories`, `gom_channels`.
- **Diagnóstico:** `interviews`, `interview_questions`, `interview_answers`, `monetization_profiles`.
- **Recomendação:** `recommendations`, `recommendation_items`.
- **Alocação:** `allocations`, `allocation_items`, `experiments`.
- **Risco:** `risk_flags`.
- **Painel:** `channel_metrics`, `allocation_reviews`.
- **Executor/Oráculo:** `oracle_documents`, `compliance_checks`.
- **Funções:** `set_updated_at()`, `fn_channel_score()`, `fn_match_channels()`, `fn_concentration_check()`.

---

## 9. Fases e Subfases de execução

### F1 — Fundação + GOM

- **F1.1** Infra & auth — projeto Next.js, Tailwind, Supabase, login/cadastro, RLS base.
- **F1.2** Schema & migração — todas as tabelas, enums, triggers, funções.
- **F1.3** Seed do GOM — popular pilares, categorias e os ~50 canais com atributos.
- **F1.4** GOM browser — UI pública de navegação, busca e filtro do guia.

### F2 — Diagnóstico → Menu

- **F2.1** Entrevista 360 — UI conversacional, perguntas ramificadas, salvamento por etapa.
- **F2.2** Perfil de monetização — geração e persistência do objeto de perfil + filtro de filosofia.
- **F2.3** Matchmaking — `fn_match_channels`, pontuação e ranking.
- **F2.4** UI do menu — cards de canal, faróis, rationale via LLM, ordenação.

### F3 — Alocação + Risco + Painel

- **F3.1** Alocador — engine 70/20/10, simulador de cenário, persistência de carteira.
- **F3.2** Guardrails — teto por canal, mínimo entre pilares, kill-criteria de experimento.
- **F3.3** Mitigador de risco — `fn_concentration_check`, modelo de downside, flags.
- **F3.4** Painel 360 — ingest de métricas, real vs. projetado, loop de rebalanceamento.

### F4 — Executor WhatsApp + Oráculo

- **F4.1** Forja & Blindagem — geração de copy/templates, pre-flight anti-ban.
- **F4.2** Oráculo RAG — `pgvector`, ingestão, Q&A com citação.
- **F4.3** Pipeline de frescor — Firecrawl + cron de re-scrape e re-embed.
- **F4.4** Export & execução — export do funil para n8n, integração Meta/WhatsApp API.

---

## 10. Métricas de sucesso

- **Ativação:** % de usuários que completam a Entrevista 360 e geram um menu.
- **Valor percebido:** % que salva uma alocação; uso recorrente do Oráculo.
- **Resultado:** melhora de ROAS/CAC reportada; redução de concentração de risco da carteira.
- **Confiança:** taxa de campanhas que passam a Blindagem sem flag vermelho; zero incidentes de ban atribuíveis a recomendação do sistema.
- **Saúde do Oráculo:** idade média das fontes (frescor) abaixo do limite definido.
