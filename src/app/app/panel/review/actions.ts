"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildRebalanceRecommendation,
  type ChannelPerf,
  type RebalanceRecommendation,
} from "@/lib/panel/rebalance";

/**
 * Recomendação de rebalanceamento (Story 7.4 — AC3, AC5). `generateReview` lê a
 * carteira ativa + métricas reais + experimentos (kill-criteria), classifica os
 * canais (lib pura `buildRebalanceRecommendation`) e persiste em `allocation_reviews`.
 * `applySuggestion` gera uma nova versão da alocação aplicando o ajuste sugerido (AC5).
 * RLS por business (client server, nunca admin).
 */

type ItemRow = {
  id: string;
  channel_id: string;
  amount: number;
  gom_channels: { name: string | null } | null;
};

type ReviewRow = {
  id: string;
  overall_health: "on_track" | "off_track" | "critical" | null;
  rebalance_recommendation: RebalanceRecommendation | null;
  notes: string | null;
  review_date: string | null;
  created_at: string;
};

export type GenerateReviewResult =
  | { ok: true; recommendation: RebalanceRecommendation; reviewId: string }
  | { ok: false; error: string };

export async function generateReview(): Promise<GenerateReviewResult> {
  const supabase = await createClient();

  const { data: alloc } = await supabase
    .from("allocations")
    .select("id, business_id, recommendation_id, total_budget, risk_band_ratios")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      business_id: string;
      recommendation_id: string | null;
      total_budget: number;
      risk_band_ratios: unknown;
    }>();
  if (!alloc) return { ok: false, error: "Nenhuma carteira encontrada." };

  const { data: itemRowsRaw } = await supabase
    .from("allocation_items")
    .select("id, channel_id, amount, gom_channels ( name )")
    .eq("allocation_id", alloc.id);
  const itemRows = (itemRowsRaw ?? []) as unknown as ItemRow[];

  // Métricas reais agregadas por canal (spend + roas médio).
  const { data: metricsRaw } = await supabase
    .from("channel_metrics")
    .select("channel_id, spend_actual, roas")
    .order("created_at", { ascending: false });
  const agg = new Map<string, { spend: number; roasSum: number; roasN: number }>();
  for (const m of (metricsRaw ?? []) as {
    channel_id: string;
    spend_actual: number | null;
    roas: number | null;
  }[]) {
    const cur = agg.get(m.channel_id) ?? { spend: 0, roasSum: 0, roasN: 0 };
    cur.spend += m.spend_actual ?? 0;
    if (m.roas !== null && Number.isFinite(m.roas)) {
      cur.roasSum += m.roas;
      cur.roasN += 1;
    }
    agg.set(m.channel_id, cur);
  }

  // Kill-criteria: experimento com prazo expirado e ativo (Dev Note 7.4).
  const { data: expRaw } = await supabase
    .from("experiments")
    .select("deadline, status, allocation_item_id")
    .eq("status", "ativo")
    .lt("deadline", new Date().toISOString().slice(0, 10));
  const killItems = new Set(
    ((expRaw ?? []) as { allocation_item_id: string }[]).map((e) => e.allocation_item_id)
  );

  const perfs: ChannelPerf[] = itemRows.map((it) => {
    const a = agg.get(it.channel_id);
    return {
      channelId: it.id, // identificamos por item (para aplicar a sugestão depois)
      name: it.gom_channels?.name ?? it.channel_id,
      projectedSpend: Number(it.amount ?? 0),
      realSpend: a ? a.spend : null,
      realRoa: a && a.roasN > 0 ? a.roasSum / a.roasN : null,
      projectedRoa: null, // sem projeção de ROAS por canal no MVP (Dev Note 7.3)
      killHit: killItems.has(it.id),
    };
  });

  const recommendation = buildRebalanceRecommendation(perfs);

  const { data: review, error } = await supabase
    .from("allocation_reviews")
    .insert({
      business_id: alloc.business_id,
      allocation_id: alloc.id,
      review_date: new Date().toISOString().slice(0, 10),
      overall_health: recommendation.overallHealth,
      rebalance_recommendation: recommendation as unknown as object,
      notes: recommendation.justification,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: error.message };

  return { ok: true, recommendation, reviewId: review.id };
}

export type LatestReview = { ok: true; review: ReviewRow | null } | { ok: false; error: string };

export async function getLatestReview(): Promise<LatestReview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allocation_reviews")
    .select("id, overall_health, rebalance_recommendation, notes, review_date, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ReviewRow>();
  if (error) return { ok: false, error: error.message };
  return { ok: true, review: data ?? null };
}

/** Aplica uma sugestão: gera nova versão da alocação ajustando o canal (AC5). */
export async function applySuggestion(
  allocationItemId: string,
  deltaPct: number
): Promise<{ ok: boolean; error?: string; newAllocationId?: string }> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("allocation_items")
    .select(
      "id, allocation_id, allocations ( id, business_id, recommendation_id, risk_band_ratios )"
    )
    .eq("id", allocationItemId)
    .maybeSingle<{
      id: string;
      allocations: {
        id: string;
        business_id: string;
        recommendation_id: string | null;
        risk_band_ratios: unknown;
      } | null;
    }>();
  if (!item?.allocations) return { ok: false, error: "Item/alocação não encontrados." };
  const parent = item.allocations;

  const { data: allItems } = await supabase
    .from("allocation_items")
    .select("id, channel_id, amount, percentage, risk_band, ceiling_pct, downside_estimate")
    .eq("allocation_id", parent.id);
  const rows = (allItems ?? []) as {
    id: string;
    channel_id: string;
    amount: number;
    percentage: number;
    risk_band: "core" | "growth" | "experiment";
    ceiling_pct: number | null;
    downside_estimate: number;
  }[];

  // Aplica o delta apenas ao canal-alvo; demais permanecem (AC5 — nova versão).
  const adjusted = rows.map((r) => {
    if (r.id === allocationItemId) {
      const next = Math.max(0, Number(r.amount) * (1 + deltaPct / 100));
      return { ...r, amount: next };
    }
    return r;
  });
  const totalBudget = adjusted.reduce((s, r) => s + r.amount, 0);

  const { data: newAlloc, error: allocErr } = await supabase
    .from("allocations")
    .insert({
      business_id: parent.business_id,
      recommendation_id: parent.recommendation_id,
      total_budget: totalBudget,
      status: "draft",
      risk_band_ratios: (parent.risk_band_ratios as object) ?? {
        core: 70,
        growth: 20,
        experiment: 10,
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (allocErr) return { ok: false, error: allocErr.message };

  const payload = adjusted.map((r) => ({
    allocation_id: newAlloc.id,
    channel_id: r.channel_id,
    amount: r.amount,
    percentage: totalBudget > 0 ? (r.amount / totalBudget) * 100 : 0,
    risk_band: r.risk_band,
    ceiling_pct: r.ceiling_pct,
    downside_estimate: r.downside_estimate,
  }));
  const { error: itemsErr } = await supabase.from("allocation_items").insert(payload);
  if (itemsErr) {
    await supabase.from("allocations").delete().eq("id", newAlloc.id);
    return { ok: false, error: itemsErr.message };
  }
  return { ok: true, newAllocationId: newAlloc.id };
}
