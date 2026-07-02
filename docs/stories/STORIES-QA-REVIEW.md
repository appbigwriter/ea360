# STORIES-QA-REVIEW — Auditoria de Conformidade das Stories EA360

> **Autor:** @qa (Quinn, Guardian) — autônomo
> **Data:** 2026-06-26
> **Fontes de verdade:** `prd/EA360-PRD.md`, `docs/deliverables/MVP-DELIVERABLES.md`
> **Escopo:** 51 stories em `docs/stories/` (1.1 → 9.5)
> **Princípio aplicado:** AIOX Article IV — No Invention (toda AC deve rastrear a um recurso/fase/modelo do PRD)

---

## Veredito

**OK** — Cobertura **100%** dos 51 deliverables MVP (D-001 → D-051). Mapeamento 1:1 story↔deliverable, ACs testáveis e rastreáveis, sem requisitos inventados que rompam a conformidade. Sem gaps críticos.

| Métrica                                      | Resultado    |
| -------------------------------------------- | ------------ |
| Deliverables MVP cobertos                    | 51/51 (100%) |
| Recursos core do PRD (R1–R7) cobertos        | 7/7          |
| Fases do PRD (F1–F4) cobertas                | 4/4          |
| Stories com ACs testáveis                    | 51/51        |
| Stories com requisito inventado (bloqueante) | 0            |
| Gaps críticos                                | 0            |
| Observações não-bloqueantes                  | 6            |

---

## Matriz de Rastreabilidade (Deliverable → Story → PRD)

| Épico  | Deliverable                                | Story | Recurso/Fase PRD      | Status |
| ------ | ------------------------------------------ | ----- | --------------------- | ------ |
| E-FND  | D-001 Bootstrap Next.js+Tailwind           | 1.1   | F1.1, §5, §7          | ✅     |
| E-FND  | D-002 Cliente Supabase SSR                 | 1.2   | §5, §7, §6            | ✅     |
| E-FND  | D-003 Auth + identidade                    | 1.3   | F1.1, §8              | ✅     |
| E-FND  | D-004 Schema completo                      | 1.4   | F1.2, §8              | ✅     |
| E-FND  | D-005 RLS base                             | 1.5   | F1.1, §5, §8          | ✅     |
| E-GOM  | D-006 Modelo GOM                           | 2.1   | R2, §8                | ✅     |
| E-GOM  | D-007 Seed ~50 canais                      | 2.2   | R2, F1.3              | ✅     |
| E-GOM  | D-008 fn_channel_score                     | 2.3   | §8, R2                | ✅     |
| E-GOM  | D-009 GOM Browser público                  | 2.4   | R2, F1.4, §7          | ✅     |
| E-GOM  | D-010 Detalhe de canal                     | 2.5   | R2, F1.4              | ✅     |
| E-INT  | D-011 Modelo Entrevista                    | 3.1   | R1, §8                | ✅     |
| E-INT  | D-012 UI conversacional                    | 3.2   | R1, F2.1              | ✅     |
| E-INT  | D-013 Perguntas ramificadas LLM            | 3.3   | R1, F2.1, §5, §7      | ✅     |
| E-INT  | D-014 Salvamento por etapa                 | 3.4   | R1, F2.1              | ✅     |
| E-INT  | D-015 Perfil de monetização                | 3.5   | R1, §8, F2.2          | ✅     |
| E-INT  | D-016 Filtro de filosofia                  | 3.6   | R1, F2.2              | ✅     |
| E-MENU | D-017 Modelo recomendação                  | 4.1   | §8                    | ✅     |
| E-MENU | D-018 fn_match_channels                    | 4.2   | R3, §8, F2.3          | ✅     |
| E-MENU | D-019 Cálculo gasto/retorno/payback/risco  | 4.3   | R3                    | ✅     |
| E-MENU | D-020 Rationale LLM                        | 4.4   | R3, F2.4, §5          | ✅     |
| E-MENU | D-021 UI do menu                           | 4.5   | R3, F2.4              | ✅     |
| E-ALOC | D-022 Modelo alocação                      | 5.1   | §8                    | ✅     |
| E-ALOC | D-023 Engine 70/20/10                      | 5.2   | R4, F3.1              | ✅     |
| E-ALOC | D-024 Simulador de cenário                 | 5.3   | R4, F3.1, §7          | ✅     |
| E-ALOC | D-025 Teto por canal                       | 5.4   | R4, F3.2              | ✅     |
| E-ALOC | D-026 Mínimo entre pilares                 | 5.5   | R4, F3.2              | ✅     |
| E-ALOC | D-027 Kill-criteria                        | 5.6   | R4, F3.2, §8          | ✅     |
| E-RISK | D-028 fn_concentration_check               | 6.1   | R5, §8, F3.3          | ✅     |
| E-RISK | D-029 Downside por canal                   | 6.2   | R5, F3.3              | ✅     |
| E-RISK | D-030 Guardrails configuráveis             | 6.3   | R5                    | ✅     |
| E-RISK | D-031 Flags farol                          | 6.4   | R5, §8                | ✅     |
| E-PNL  | D-032 Modelo métricas/reviews              | 7.1   | §8                    | ✅     |
| E-PNL  | D-033 Ingest de métricas                   | 7.2   | R6, F3.4              | ✅     |
| E-PNL  | D-034 Real vs. projetado                   | 7.3   | R6, F3.4, §7          | ✅     |
| E-PNL  | D-035 Rebalanceamento                      | 7.4   | R6, F3.4              | ✅     |
| E-PNL  | D-036 Loop de reavaliação                  | 7.5   | R6                    | ✅     |
| E-EXEC | D-037 Arquiteto de funil                   | 8.1   | R7                    | ✅     |
| E-EXEC | D-038 Forja de copy                        | 8.2   | R7, F4.1, §5          | ✅     |
| E-EXEC | D-039 Blindagem anti-ban                   | 8.3   | R7, F4.1, §8, §10     | ✅     |
| E-EXEC | D-040 Bot identificado + escape            | 8.4   | R7                    | ✅     |
| E-EXEC | D-041 Oráculo pgvector + modelo            | 8.5   | §5, §8, F4.2          | ✅     |
| E-EXEC | D-042 Ingestão + embeddings                | 8.6   | §5, §7, F4.2          | ✅     |
| E-EXEC | D-043 Oráculo Q&A com fonte                | 8.7   | R7, F4.2              | ✅     |
| E-EXEC | D-044 Pipeline de frescor                  | 8.8   | R7, §5, §7, F4.3, §10 | ✅     |
| E-EXEC | D-045 Export n8n                           | 8.9   | R7, F4.4, §5          | ✅     |
| E-EXEC | D-046 Integração Meta/WhatsApp             | 8.10  | §5, F4.4, §6          | ✅     |
| E-XACC | D-047 Instrumentação ativação              | 9.1   | §10, §5               | ✅     |
| E-XACC | D-048 Instrumentação valor percebido       | 9.2   | §10                   | ✅     |
| E-XACC | D-049 Observabilidade Sentry               | 9.3   | §5, §7                | ✅     |
| E-XACC | D-050 Base de qualidade TS/ESLint/Prettier | 9.4   | §7, Art. V            | ✅     |
| E-XACC | D-051 Suíte de testes                      | 9.5   | §7                    | ✅     |

**Resultado:** 51/51 deliverables com story correspondente. Nenhum deliverable órfão; nenhuma story órfã.

---

## Verificação Anti-Invenção (Article IV)

Todas as ACs foram verificadas contra o PRD. Itens que poderiam parecer "inventados" mas estão devidamente derivados de critérios do PRD:

- **Thresholds numéricos de concentração** (6.1: verde <40% / amarelo 40–60% / vermelho >60%) — operacionalização legítima de "flags vermelho/amarelo/verde" (R5). Valores são uma decisão de implementação razoável, não um recurso novo.
- **Fórmula de downside** (6.2: `amount * (1 - (risk_score-1)/4*0.8)`) — operacionalização de "modela downside / modelo de perda por canal" (R5).
- **Gatilhos de reavaliação** (7.5: >90 dias, budget >30%, ROAS <50%) — operacionalização de "loop de reavaliação" (R6). Aceitável como heurística.
- **Frescor <8 dias** (8.8 AC6) — operacionalização da métrica "idade média das fontes abaixo do limite definido" (§10), com limite tornado concreto.
- **`text-embedding-3-small` / `vector(1536)`** (8.5/8.6) — escolha de modelo dentro de "provedor de embeddings (ex.: OpenAI)" (§6/§7). Conforme.

Nenhum desses rompe Article IV: são parâmetros de implementação de recursos existentes, não recursos novos. Roadmap §4 (multi-tenant, white-label, conectores automáticos, PDF, etc.) corretamente **excluído** do MVP — nenhuma story o implementa (7.2 AC6 reafirma ingest manual).

---

## Qualidade das Acceptance Criteria

- **Testáveis:** ACs usam verificações concretas (`SELECT COUNT(*) >= 45`, `npm run build` sem erros, `supabase migration list`, faróis por threshold, validações de soma 100%). Adequado para gate objetivo.
- **Rastreáveis:** maioria das stories cita R#/F#/§# em Dev Notes ou nas próprias ACs.
- **Tolerância a falha de LLM** consistentemente especificada (3.3 AC4, 3.5 AC6, 4.4 AC5, 7.4 AC6) — bom alinhamento com robustez.
- **Segurança:** chaves server-only explicitadas (3.3 AC6, 8.6 AC5, 8.8 AC8); credenciais Meta criptografadas (8.10 AC2). RLS isolado por business (1.5, e cada modelo de dados).

---

## Observações Não-Bloqueantes (melhorias recomendadas, não gaps de cobertura)

1. **G-1 (médio) — Sobreposição de farol de risco entre 4.5 e 6.4.** Story 4.5 AC2 define farol por `risk_score` (1–2 verde / 3 amarelo / 4–5 vermelho) no menu; Story 6.4 redefine farol combinando concentração + guardrails. São contextos diferentes (menu vs. carteira), mas convém documentar que o farol de 6.4 NÃO substitui o de 4.5 para evitar implementação divergente.
2. **G-2 (baixo) — Persistência de `funnels` definida ad-hoc.** Stories 8.1/8.4 propõem tabela `funnels` (não listada no §8 do PRD). É uma extensão necessária para R7, porém não consta no modelo de dados canônico. Recomenda-se registrar como ADR/migração explícita para manter rastreabilidade (não invalida cobertura — R7 exige funil).
3. **G-3 (baixo) — `whatsapp_templates` idem.** Story 8.2 cria tabela não presente no §8. Mesma observação que G-2: extensão legítima de R7, formalizar via migração documentada.
4. **G-4 (baixo) — Status de todas as stories = `Draft`.** Nenhuma implementada ainda; esta auditoria é de cobertura/qualidade de especificação, não de implementação. Gate de implementação (testes/lint/build) ocorrerá por story no SDC.
5. **G-5 (baixo) — CodeRabbit desabilitado** em todas as stories (core-config). Sem impacto na conformidade; apenas o gate de implementação dependerá de revisão manual.
6. **G-6 (informativo) — `current_layer` (3.4 AC3) vs. retomada por "última pergunta não respondida" (3.4 AC2).** Verificar na implementação que ambos os mecanismos de progresso convergem para evitar estado inconsistente.

---

## Recomendação de Gate

**APPROVED** para entrar no ciclo de desenvolvimento (SDC). A especificação cobre 100% do MVP definido em MVP-DELIVERABLES.md, que por sua vez cobre integralmente os recursos core R1–R7 do PRD. As observações G-1 a G-6 são refinamentos de implementação, endereçáveis nas stories individuais sem alterar escopo.

**Ação sugerida ao @po/@architect:** formalizar via migração/ADR as tabelas `funnels` e `whatsapp_templates` (G-2/G-3) para manter o §8 do PRD como fonte única de verdade do modelo de dados.
