"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { trackAllocationSaved } from "@/lib/analytics";
import { computeAndSaveRiskFlags } from "@/app/app/allocation/risk-flags-actions";
import {
  allocateBudgetPure,
  assertBudgetConsistency,
  AllocationError,
  checkGuardrails,
  DEFAULT_GUARDRAILS,
  DEFAULT_RATIOS,
  portfolioDownside,
  sanitizeGuardrailConfig,
  type AllocationChannelInput,
  type GuardrailConfig,
  type GuardrailViolation,
  type PillarMinimums,
  type RiskBandRatios,
} from "@/lib/allocation/engine";

/**
 * Server Action de alocação 70/20/10 (Story 5.2 — AC1, AC5, AC6, AC7).
 *
 * `allocateBudget(recommendationId, totalBudget, ratios?)`:
 *   1. Lê os canais da recomendação (Story 4.x) com `risk_score` do GOM (2.1) e
 *      `match_score` do item (4.2).
 *   2. Roda a engine PURA (`@/lib/allocation/engine`) para distribuir a verba
 *      entre as faixas de risco e seus canais.
 *   3. Persiste o resultado em `allocations` + `allocation_items` (tabelas da
 *      Story 5.1), em duas etapas (insere a alocação, depois os itens).
 *   4. Valida a consistência total = soma dos itens (AC6).
 *
 * RLS isola por dono: usa o client server (anon + sessão), NUNCA o admin client,
 * para que as policies "allocations do dono" / "allocation_items do dono"
 * (migração 0015) garantam que só dados do business do usuário sejam tocados.
 * Nenhum segredo é exposto ao client.
 */

/** Linha de canal recomendado lida para a alocação. */
type RecommendationChannelRow = {
  channel_id: string;
  match_score: number | null;
  gom_channels: {
    risk_score: number | null;
    name: string | null;
    gom_categories: {
      gom_pillars: { slug: string | null; name: string | null } | null;
    } | null;
  } | null;
};

/** Linha da recomendação (para obter o business dono da alocação). */
type RecommendationRow = {
  id: string;
  business_id: string | null;
};

export type AllocateBudgetResult =
  | {
      ok: true;
      allocationId: string;
      itemCount: number;
      totalBudget: number;
      /** Canais que atingiram seu teto nesta alocação (Story 5.4 AC5). */
      cappedChannelIds: string[];
      /** Avisos de mínimo de pilar não atingido (Story 5.5 AC4). */
      pillarWarnings: PillarWarningInfo[];
      /** Perda máxima estimada total da carteira em R$ (Story 6.2 AC2). */
      totalDownside: number;
      /**
       * Violações de guardrail detectadas nesta alocação (Story 6.3 — AC3/AC4).
       * NÃO bloqueiam a alocação: são exibidas como aviso. Vazio quando nenhum
       * guardrail está configurado ou nenhuma regra foi violada.
       */
      guardrailViolations: GuardrailViolation[];
    }
  | {
      ok: false;
      error: string;
      /**
       * Quando a alocação foi RECUSADA por haver violações de guardrail sem a
       * confirmação de ciência (Story 6.3 — AC5), as violações são devolvidas para
       * a UI exibir o modal de "Ciente dos riscos". `false`/ausente nos demais erros.
       */
      requiresAcknowledgement?: boolean;
      guardrailViolations?: GuardrailViolation[];
    };

/** Aviso serializável de mínimo de pilar não atingido (Story 5.5 AC4). */
export type PillarWarningInfo = {
  pillarKey: string;
  requiredAmount: number;
  allocatedAmount: number;
  minPct: number;
};

/**
 * Tetos por canal (Story 5.4): mapa `channelId -> ceiling_pct` (0..100).
 * `ceiling_pct === 0` exclui o canal (AC6). Canais ausentes do mapa => sem teto.
 */
export type ChannelCeilings = Record<string, number>;

/**
 * Mínimos por pilar (Story 5.5): mapa `pillarSlug -> min_pct` (0..100). Slug do
 * `gom_pillars` (`ads`, `afiliacoes`, `parcerias`). Mínimos <= 0 / ausentes => sem
 * restrição (AC5 — padrão = 0% / desativado).
 */
export type PillarMinimumsInput = Record<string, number>;

/**
 * Guardrails configuráveis (Story 6.3) + flag de ciência. Passados como objeto
 * opcional para não quebrar os chamadores existentes (Stories 5.4/5.5).
 */
export type AllocateGuardrailOptions = {
  /** Configuração de guardrails do usuário (Story 6.3 — AC1/AC2). */
  guardrailConfig?: GuardrailConfig | null;
  /**
   * `true` quando o usuário confirmou ciência dos riscos (checkbox — AC5),
   * autorizando salvar a carteira mesmo com violações. Quando há violações e este
   * flag é `false`, a Server Action RECUSA persistir e devolve as violações (AC5).
   */
  acknowledged?: boolean;
};

/**
 * Distribui `totalBudget` entre os canais da recomendação seguindo a regra
 * 70/20/10 (ou `ratios` customizado) e persiste a carteira resultante.
 *
 * @param recommendationId id da recomendação de origem (Story 4.1).
 * @param totalBudget      orçamento total a distribuir (>= 0).
 * @param ratios           distribuição por faixa; default 70/20/10 (AC2).
 */
export async function allocateBudget(
  recommendationId: string,
  totalBudget: number,
  ratios: RiskBandRatios = DEFAULT_RATIOS,
  ceilings: ChannelCeilings = {},
  pillarMinimums: PillarMinimumsInput = {},
  guardrailOptions: AllocateGuardrailOptions = {}
): Promise<AllocateBudgetResult> {
  if (!recommendationId) {
    return { ok: false, error: "recommendationId ausente." };
  }

  const supabase = await createClient();

  try {
    // 1. Recomendação + business dono (RLS já restringe ao business do usuário).
    const { data: rec, error: recError } = await supabase
      .from("recommendations")
      .select("id, business_id")
      .eq("id", recommendationId)
      .maybeSingle<RecommendationRow>();

    if (recError || !rec) {
      return { ok: false, error: recError?.message ?? "Recomendação não encontrada." };
    }
    if (!rec.business_id) {
      return { ok: false, error: "Recomendação sem business associado." };
    }

    // 2. Canais da recomendação com risk_score (GOM) e match_score (item).
    const { data: itemRows, error: itemsError } = await supabase
      .from("recommendation_items")
      .select(
        "channel_id, match_score, gom_channels!inner ( risk_score, name, gom_categories!inner ( gom_pillars!inner ( slug, name ) ) )"
      )
      .eq("recommendation_id", recommendationId);

    if (itemsError) {
      return { ok: false, error: itemsError.message };
    }

    const rows = (itemRows ?? []) as unknown as RecommendationChannelRow[];
    const channels: AllocationChannelInput[] = rows
      .filter((r) => r.gom_channels)
      .map((r) => {
        // Teto por canal (Story 5.4): aceita 0..100; valores fora da faixa são
        // ignorados (canal sem teto), evitando inventar guardrails (No Invention).
        const rawCeiling = ceilings[r.channel_id];
        const ceilingPct =
          typeof rawCeiling === "number" &&
          Number.isFinite(rawCeiling) &&
          rawCeiling >= 0 &&
          rawCeiling <= 100
            ? rawCeiling
            : null;
        return {
          channelId: r.channel_id,
          riskScore: r.gom_channels?.risk_score ?? 1,
          matchScore: r.match_score,
          ceilingPct,
          pillarKey: r.gom_channels?.gom_categories?.gom_pillars?.slug ?? null,
        };
      });

    if (channels.length === 0) {
      return {
        ok: false,
        error: "A recomendação não possui canais para alocar. Gere o menu primeiro.",
      };
    }

    // Sanitiza os mínimos por pilar (Story 5.5): só pilares presentes nos canais e
    // com mínimo válido (0..100) entram; valores fora da faixa são descartados para
    // não inventar guardrails (No Invention — Article IV).
    const presentPillars = new Set(
      channels.map((c) => c.pillarKey).filter((k): k is string => !!k)
    );
    const sanitizedMinimums: PillarMinimums = {};
    for (const [key, raw] of Object.entries(pillarMinimums)) {
      if (
        presentPillars.has(key) &&
        typeof raw === "number" &&
        Number.isFinite(raw) &&
        raw > 0 &&
        raw <= 100
      ) {
        sanitizedMinimums[key] = raw;
      }
    }

    // 3. Engine pura: distribui e valida ratios/faixas (AC2, AC3, AC4, AC7) e aplica
    //    o guardrail de mínimo entre pilares (Story 5.5 AC2–AC4).
    const result = allocateBudgetPure(totalBudget, channels, ratios, sanitizedMinimums);
    // AC6: consistência total = soma dos itens (±R$0,01).
    assertBudgetConsistency(result);

    // Story 6.3 (AC3/AC4/AC5): resolve os guardrails efetivos. Precedência:
    //   explícitos (passados pelo caller) > última config salva do business > nenhum.
    // Guardrails NÃO bloqueiam: se houver violações, devolvemos para a UI exibir; só
    // recusamos persistir quando o usuário NÃO confirmou ciência (AC5 — checkbox).
    const explicitConfig = sanitizeGuardrailConfig(guardrailOptions.guardrailConfig ?? null);
    const effectiveConfig =
      explicitConfig ?? (await fetchLatestGuardrailConfig(supabase, rec.business_id));

    let guardrailViolations: GuardrailViolation[] = [];
    if (effectiveConfig) {
      const labels: Record<string, string> = {};
      for (const r of rows) {
        if (r.gom_channels?.name) labels[r.channel_id] = r.gom_channels.name;
        const pillar = r.gom_channels?.gom_categories?.gom_pillars;
        if (pillar?.slug && pillar?.name) labels[pillar.slug] = pillar.name;
      }
      guardrailViolations = checkGuardrails(
        result.items,
        effectiveConfig,
        result.totalBudget,
        labels
      );
      // AC5: violações sem ciência do risco => NÃO persiste; devolve para o modal.
      if (guardrailViolations.length > 0 && !guardrailOptions.acknowledged) {
        return {
          ok: false,
          error:
            "Há violações de guardrail. Confirme que está ciente dos riscos para salvar esta carteira.",
          requiresAcknowledgement: true,
          guardrailViolations,
        };
      }
    }

    // 4. Persiste a alocação (AC5).
    const { data: allocation, error: allocError } = await supabase
      .from("allocations")
      .insert({
        business_id: rec.business_id,
        recommendation_id: rec.id,
        total_budget: result.totalBudget,
        status: "draft",
        // Story 6.3 (AC2): persiste os guardrails efetivos na própria alocação
        // (coluna `guardrail_config`, migração 0018). NULL quando não há guardrails.
        guardrail_config: effectiveConfig,
        // AC6 (Story 5.5): os mínimos por pilar são persistidos como campo adicional
        // dentro do JSONB `risk_band_ratios` (`pillar_minimums`), sem nova migração.
        // Omitido quando nenhum mínimo está ativo (AC5 — padrão = 0% / desativado).
        risk_band_ratios:
          Object.keys(sanitizedMinimums).length > 0
            ? { ...result.ratios, pillar_minimums: sanitizedMinimums }
            : result.ratios,
      })
      .select("id")
      .single<{ id: string }>();

    if (allocError || !allocation) {
      return { ok: false, error: allocError?.message ?? "Falha ao criar a alocação." };
    }

    // 5. Persiste os itens (AC5). Em caso de falha, remove a alocação órfã.
    const itemPayload = result.items.map((item) => ({
      allocation_id: allocation.id,
      channel_id: item.channelId,
      amount: item.amount,
      percentage: item.percentage,
      risk_band: item.riskBand,
      // Persiste o teto configurado para o canal (Story 5.1 campo `ceiling_pct`).
      ceiling_pct: ceilings[item.channelId] ?? null,
      // Persiste a perda máxima estimada do canal (Story 6.2 — AC4). A engine já
      // calculou `downsideEstimate` a partir do amount final e do risk_score.
      downside_estimate: item.downsideEstimate ?? 0,
    }));

    const { error: itemsInsertError } = await supabase.from("allocation_items").insert(itemPayload);

    if (itemsInsertError) {
      await supabase.from("allocations").delete().eq("id", allocation.id);
      return { ok: false, error: itemsInsertError.message };
    }

    // Instrumentação (Analytics - Story 9.2)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      trackAllocationSaved(rec.business_id, user.id, allocation.id, result.totalBudget).catch(
        () => {}
      );
    }

    revalidatePath("/app/allocation");

    // Story 6.4 (AC7): recalcula e persiste os faróis de risco da nova carteira
    // (concentração + risk_score + violações de guardrail). Falha aqui não invalida a
    // alocação — faróis são informativos; a UI pode reprocessar via getRiskFlags.
    await computeAndSaveRiskFlags(allocation.id).catch(() => null);

    return {
      ok: true,
      allocationId: allocation.id,
      itemCount: result.items.length,
      totalBudget: result.totalBudget,
      cappedChannelIds: result.items
        .filter((item) => item.ceilingReached)
        .map((item) => item.channelId),
      pillarWarnings: (result.pillarWarnings ?? []).map((w) => ({
        pillarKey: w.pillarKey,
        requiredAmount: w.requiredAmount,
        allocatedAmount: w.allocatedAmount,
        minPct: w.minPct,
      })),
      // Story 6.2 (AC2): downside total = soma dos downside por canal.
      totalDownside: portfolioDownside(result.items),
      // Story 6.3 (AC4): violações de guardrail detectadas (exibidas como aviso,
      // não bloqueio). Pode ser não-vazio mesmo em sucesso quando o usuário confirmou
      // ciência (AC5). Vazio quando não há guardrails ativos.
      guardrailViolations,
    };
  } catch (err) {
    // Erros de validação da engine (AC2/AC7) chegam aqui como AllocationError com
    // mensagem descritiva; demais erros são logados sem expor detalhes sensíveis.
    if (err instanceof AllocationError) {
      return { ok: false, error: err.message };
    }
    console.error("[allocation] allocateBudget falhou:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro inesperado ao alocar orçamento.",
    };
  }
}

/**
 * Lê o `guardrail_config` da alocação mais recente do business (RLS isola por
 * dono). Usado para "carregar" guardrails salvos entre sessões (Story 6.3 AC6) e
 * como fallback ao gerar uma nova carteira (guardrails "pegajosos" entre regerações).
 * Retorna `null` quando não há alocação ou nenhuma config ativa.
 */
async function fetchLatestGuardrailConfig(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<GuardrailConfig | null> {
  const { data } = await supabase
    .from("allocations")
    .select("guardrail_config")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ guardrail_config: GuardrailConfig | null }>();
  return sanitizeGuardrailConfig(data?.guardrail_config ?? null);
}

/** Resultado da leitura de guardrails para a UI de configuração (Story 6.3 — AC6). */
export type GuardrailConfigResult = {
  ok: boolean;
  config: GuardrailConfig;
  /** id da alocação à qual a config está associada (null se nenhuma existir). */
  allocationId: string | null;
  error?: string;
};

/**
 * Lê os guardrails configurados pelo usuário. Quando não há alocação (ou a última
 * não tem config), devolve os defaults sugeridos (Dev Note 6.3) — a UI sempre tem um
 * ponto de partida coerente (AC1).
 */
export async function getGuardrailConfig(): Promise<GuardrailConfigResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allocations")
    .select("id, guardrail_config")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; guardrail_config: GuardrailConfig | null }>();

  if (error) {
    return { ok: false, config: DEFAULT_GUARDRAILS, allocationId: null, error: error.message };
  }
  if (!data) {
    return { ok: true, config: DEFAULT_GUARDRAILS, allocationId: null };
  }
  return {
    ok: true,
    allocationId: data.id,
    config: sanitizeGuardrailConfig(data.guardrail_config) ?? DEFAULT_GUARDRAILS,
  };
}

/**
 * Persiste os guardrails do usuário na alocação mais recente (AC2 — JSONB em
 * `allocations.guardrail_config`). Guardrails inválidos são descartados pelo
 * `sanitizeGuardrailConfig` (No Invention — Article IV). Exige ao menos uma
 * carteira; antes disso, não há onde anexar a config.
 */
export async function saveGuardrailConfig(
  config: GuardrailConfig
): Promise<{ ok: boolean; allocationId?: string; error?: string }> {
  const supabase = await createClient();
  const sanitized = sanitizeGuardrailConfig(config);

  const { data, error } = await supabase
    .from("allocations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return {
      ok: false,
      error: "Nenhuma carteira encontrada. Gere uma carteira antes de configurar guardrails.",
    };
  }

  const { error: updError } = await supabase
    .from("allocations")
    .update({ guardrail_config: sanitized })
    .eq("id", data.id);

  if (updError) return { ok: false, error: updError.message };
  return { ok: true, allocationId: data.id };
}
