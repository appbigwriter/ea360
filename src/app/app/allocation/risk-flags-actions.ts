"use server";

import { createClient } from "@/lib/supabase/server";
import {
  checkGuardrails,
  sanitizeGuardrailConfig,
  type AllocationItem,
  type GuardrailConfig,
  type GuardrailViolation,
} from "@/lib/allocation/engine";
import {
  calculateChannelFlag,
  portfolioFlag,
  type ChannelFlag,
  type FlagLevel,
} from "@/lib/risk/flags";

/**
 * Server Actions de faróis de risco da carteira (Story 6.4 — AC6, AC7).
 *
 * `computeAndSaveRiskFlags(allocationId)` recalcula os faróis de todos os canais da
 * alocação a partir de: concentração (`allocation_items.percentage`), `risk_score`
 * (GOM, via canal) e violações de guardrail (Story 6.3 — `checkGuardrails` contra o
 * `guardrail_config` salvo na alocação). Persiste em `risk_flags` (uma linha por
 * canal + uma linha de carteira) — AC6 — e deve ser chamado a cada recalculação (AC7).
 *
 * RLS por dono: usa o client server (anon + sessão), nunca o admin.
 */

type ItemRow = {
  channel_id: string;
  percentage: number | null;
  amount: number | null;
  downside_estimate: number | null;
  gom_channels: {
    risk_score: number | null;
    name: string | null;
    gom_categories: { gom_pillars: { slug: string | null; name: string | null } | null } | null;
  } | null;
};

export type SavedRiskFlag = {
  channelId: string | null;
  level: FlagLevel;
  reasons: string[];
};

export type RiskFlagsResult =
  | {
      ok: true;
      allocationId: string;
      portfolio: { level: FlagLevel; reasons: string[] };
      channelFlags: ChannelFlag[];
    }
  | { ok: false; error: string };

/**
 * Recalcula e persiste os faróis de risco da alocação (AC6, AC7). Devolve o resultado
 * para a UI renderizar imediatamente (sem nova leitura).
 */
export async function computeAndSaveRiskFlags(allocationId: string): Promise<RiskFlagsResult> {
  if (!allocationId) return { ok: false, error: "allocationId ausente." };
  const supabase = await createClient();

  // 1. Alocação (donos via RLS) + sua config de guardrails.
  const { data: alloc, error: allocError } = await supabase
    .from("allocations")
    .select("id, total_budget, guardrail_config")
    .eq("id", allocationId)
    .maybeSingle<{ id: string; total_budget: number; guardrail_config: GuardrailConfig | null }>();
  if (allocError || !alloc) {
    return { ok: false, error: allocError?.message ?? "Alocação não encontrada." };
  }

  // 2. Itens com risk_score/nome (GOM) e pilar.
  const { data: rows, error: itemsError } = await supabase
    .from("allocation_items")
    .select(
      "channel_id, percentage, amount, downside_estimate, gom_channels!inner ( risk_score, name, gom_categories!inner ( gom_pillars!inner ( slug, name ) ) )"
    )
    .eq("allocation_id", allocationId);
  if (itemsError) return { ok: false, error: itemsError.message };

  const itemRows = (rows ?? []) as unknown as ItemRow[];
  if (itemRows.length === 0) {
    return { ok: true, allocationId, portfolio: { level: "green", reasons: [] }, channelFlags: [] };
  }

  const labels: Record<string, string> = {};
  const items: AllocationItem[] = itemRows.map((r) => {
    const risk = r.gom_channels?.risk_score ?? 1;
    const slug = r.gom_channels?.gom_categories?.gom_pillars?.slug ?? null;
    const pname = r.gom_channels?.gom_categories?.gom_pillars?.name ?? null;
    if (r.gom_channels?.name) labels[r.channel_id] = r.gom_channels.name;
    if (slug && pname) labels[slug] = pname;
    return {
      channelId: r.channel_id,
      amount: Number(r.amount ?? 0),
      percentage: Number(r.percentage ?? 0),
      riskBand: "core",
      pillarKey: slug,
      downsideEstimate: Number(r.downside_estimate ?? 0),
    };
  });

  // 3. Violações de guardrail (Story 6.3) contra a config salva na alocação.
  const config = sanitizeGuardrailConfig(alloc.guardrail_config ?? null);
  const violations = config
    ? checkGuardrails(items, config, Number(alloc.total_budget ?? 0), labels)
    : [];

  // 4. Farol por canal (AC1) — concentração + risk_score + violações do canal.
  const channelFlags: ChannelFlag[] = items.map((item) => {
    const risk =
      itemRows.find((r) => r.channel_id === item.channelId)?.gom_channels?.risk_score ?? 1;
    const channelViolations = violations.filter((v) => v.entityKey === item.channelId);
    const flag = calculateChannelFlag({
      channelId: item.channelId,
      concentrationPct: item.percentage,
      riskScore: risk,
      violations: channelViolations,
    });
    return { ...flag, channelId: item.channelId };
  });

  // 5. Farol da carteira (AC5) — pior canal + violações de escopo da carteira.
  const portfolioViolations: GuardrailViolation[] = violations.filter(
    (v) =>
      v.entityKey === "portfolio" ||
      v.type === "pillar_concentration" ||
      v.type === "pillar_minimum"
  );
  const portfolio = portfolioFlag(channelFlags, portfolioViolations);

  // 6. Persiste em risk_flags (AC6): limpa flags antigas e insere as novas.
  await supabase.from("risk_flags").delete().eq("allocation_id", allocationId);

  const payload = [
    // Linha de carteira (channel_id null).
    {
      allocation_id: allocationId,
      channel_id: null,
      level: portfolio.level,
      kind: "portfolio",
      message: portfolio.reasons.join(" ") || null,
      payload: { reasons: portfolio.reasons } as object,
    },
    // Uma linha por canal.
    ...channelFlags.map((cf) => ({
      allocation_id: allocationId,
      channel_id: cf.channelId,
      level: cf.level,
      kind: "channel",
      message: cf.reasons.join(" ") || null,
      payload: { reasons: cf.reasons } as object,
    })),
  ];

  const { error: insertError } = await supabase.from("risk_flags").insert(payload);
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, allocationId, portfolio, channelFlags };
}

/**
 * Lê os faróis persistidos da alocação (Story 6.4 — AC7, exibição). `computeAndSave`
 * é a fonte da verdade; este getter apenas devolve o estado salvo para a UI.
 */
export async function getRiskFlags(
  allocationId: string
): Promise<{
  ok: boolean;
  portfolio: SavedRiskFlag | null;
  channels: SavedRiskFlag[];
  error?: string;
}> {
  if (!allocationId) return { ok: false, portfolio: null, channels: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("risk_flags")
    .select("channel_id, level, payload")
    .eq("allocation_id", allocationId);
  if (error) return { ok: false, portfolio: null, channels: [], error: error.message };

  const rows = (data ?? []) as {
    channel_id: string | null;
    level: FlagLevel;
    payload: { reasons?: string[] } | null;
  }[];
  const reasons = (r: (typeof rows)[number]) => r.payload?.reasons ?? [];
  const portfolio = rows.find((r) => r.channel_id === null) ?? null;
  const channels = rows
    .filter((r) => r.channel_id !== null)
    .map((r) => ({ channelId: r.channel_id, level: r.level, reasons: reasons(r) }));

  return {
    ok: true,
    portfolio: portfolio
      ? { channelId: null, level: portfolio.level, reasons: reasons(portfolio) }
      : null,
    channels,
  };
}
