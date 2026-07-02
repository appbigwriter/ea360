-- ============================================================================
-- EA360 — Migração 0003: Índices de performance
-- Complementa os índices de FK criados no init. Foco em queries críticas:
-- matchmaking do GOM, painel de métricas, oráculo (RAG) e flags de risco.
-- Idempotente (create index if not exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Identidade / negócios
-- ----------------------------------------------------------------------------
create index if not exists idx_businesses_owner on businesses(owner_id);
create index if not exists idx_businesses_owner_created on businesses(owner_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. GOM — navegação e matchmaking (fn_match_channels faz joins category->pillar)
-- ----------------------------------------------------------------------------
create index if not exists idx_gom_categories_pillar on gom_categories(pillar_id);
create index if not exists idx_gom_channels_category on gom_channels(category_id);
-- filtros frequentes do GOM browser (por atributos de comportamento)
create index if not exists idx_gom_channels_payback on gom_channels(payback);
create index if not exists idx_gom_channels_risk on gom_channels(risk_score);
create index if not exists idx_gom_channels_scale on gom_channels(scale);
-- busca textual leve por nome/slug do canal
create index if not exists idx_gom_channels_name on gom_channels(name);

-- ----------------------------------------------------------------------------
-- 3. Diagnóstico — entrevistas e perfis
-- ----------------------------------------------------------------------------
create index if not exists idx_interviews_business on interviews(business_id);
create index if not exists idx_interviews_business_status on interviews(business_id, status);
create index if not exists idx_interview_answers_interview on interview_answers(interview_id);
create index if not exists idx_interview_answers_question on interview_answers(question_id);
create index if not exists idx_monet_profiles_business on monetization_profiles(business_id);
create index if not exists idx_monet_profiles_interview on monetization_profiles(interview_id);
create index if not exists idx_interview_questions_layer_sort on interview_questions(layer, sort);

-- ----------------------------------------------------------------------------
-- 4. Recomendação — menu rankeado
-- ----------------------------------------------------------------------------
create index if not exists idx_recommendations_business on recommendations(business_id);
create index if not exists idx_recommendations_profile on recommendations(profile_id);
create index if not exists idx_rec_items_recommendation on recommendation_items(recommendation_id);
create index if not exists idx_rec_items_channel on recommendation_items(channel_id);
-- ordenação do menu por rank/score dentro de uma recomendação
create index if not exists idx_rec_items_rec_rank on recommendation_items(recommendation_id, rank);

-- ----------------------------------------------------------------------------
-- 5. Alocação de portfólio
-- ----------------------------------------------------------------------------
create index if not exists idx_allocations_business on allocations(business_id);
create index if not exists idx_alloc_items_allocation on allocation_items(allocation_id);
create index if not exists idx_alloc_items_channel on allocation_items(channel_id);
-- fn_concentration_check agrupa items por allocation; tier usado nos splits
create index if not exists idx_alloc_items_alloc_tier on allocation_items(allocation_id, tier);
create index if not exists idx_experiments_alloc_item on experiments(allocation_item_id);
create index if not exists idx_experiments_status on experiments(status);
create index if not exists idx_experiments_deadline on experiments(deadline) where deadline is not null;

-- ----------------------------------------------------------------------------
-- 6. Risco
-- ----------------------------------------------------------------------------
create index if not exists idx_risk_flags_allocation on risk_flags(allocation_id);
create index if not exists idx_risk_flags_alloc_level on risk_flags(allocation_id, level);

-- ----------------------------------------------------------------------------
-- 7. Painel 360 — métricas (queries por período no painel real vs projetado)
-- ----------------------------------------------------------------------------
create index if not exists idx_channel_metrics_alloc_item on channel_metrics(allocation_item_id);
create index if not exists idx_channel_metrics_item_period on channel_metrics(allocation_item_id, period_start, period_end);
create index if not exists idx_allocation_reviews_allocation on allocation_reviews(allocation_id);

-- ----------------------------------------------------------------------------
-- 8. Oráculo (RAG) — busca vetorial + filtro de frescor
-- ----------------------------------------------------------------------------
-- Índice IVFFLAT para similaridade por cosseno (ajuste lists ao volume de docs).
-- Requer dados para treinar; seguro criar mesmo vazio.
create index if not exists idx_oracle_documents_embedding
  on oracle_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- filtro de documentos obsoletos no pipeline de frescor
create index if not exists idx_oracle_documents_stale on oracle_documents(is_stale);
create index if not exists idx_oracle_documents_fetched on oracle_documents(fetched_at);

-- ----------------------------------------------------------------------------
-- 9. Compliance / Blindagem
-- ----------------------------------------------------------------------------
create index if not exists idx_compliance_checks_business on compliance_checks(business_id);
create index if not exists idx_compliance_checks_business_level on compliance_checks(business_id, level);

-- ============================================================================
-- Fim — índices EA360.
-- ============================================================================
