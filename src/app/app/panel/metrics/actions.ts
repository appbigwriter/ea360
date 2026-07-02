"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Ingest manual de métricas por canal (Story 7.2 — R6 / F3.4).
 *
 * `saveChannelMetrics` valida e persiste um registro em `channel_metrics` (ROAS,
 * CPA, payback, contribuição, spend) para um período. `getChannelMetrics` lista o
 * histórico. RLS por business (client server, nunca admin).
 */

export type ChannelMetricsInput = {
  allocationItemId: string;
  channelId: string;
  periodStart: string;
  periodEnd: string;
  spendActual: number;
  roas?: number | null;
  cpa?: number | null;
  paybackActual?: number | null;
  contribution?: number | null;
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Validação server-side (AC3). Lança mensagem legível em caso de inválido. */
function validate(input: ChannelMetricsInput): string | null {
  if (!input.allocationItemId) return "Selecione um canal.";
  if (!input.channelId) return "Canal ausente.";
  if (!input.periodStart || !input.periodEnd) return "Informe o período (início/fim).";
  if (new Date(input.periodEnd) < new Date(input.periodStart)) {
    return "A data final deve ser maior ou igual à inicial.";
  }
  if (!Number.isFinite(input.spendActual) || input.spendActual < 0) {
    return "O gasto real (spend) deve ser maior ou igual a zero.";
  }
  return null;
}

export async function saveChannelMetrics(input: ChannelMetricsInput): Promise<SaveResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();

  // Resolve o business_id a partir do item de alocação (item → allocation → business).
  const { data: item, error: itemError } = await supabase
    .from("allocation_items")
    .select("id, allocation_id, allocations ( business_id )")
    .eq("id", input.allocationItemId)
    .maybeSingle<{ id: string; allocations: { business_id: string } | null }>();
  if (itemError || !item) {
    return { ok: false, error: itemError?.message ?? "Item de alocação não encontrado." };
  }
  const businessId = item.allocations?.business_id;
  if (!businessId) return { ok: false, error: "Item sem business associado." };

  const { data, error } = await supabase
    .from("channel_metrics")
    .insert({
      business_id: businessId,
      allocation_item_id: input.allocationItemId,
      channel_id: input.channelId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      spend_actual: input.spendActual,
      roas: input.roas ?? null,
      cpa: input.cpa ?? null,
      payback_actual: input.paybackActual ?? null,
      contribution: input.contribution ?? null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}

/** Canal ativo da alocação mais recente (para o select do formulário). */
export type ActiveChannel = {
  allocationItemId: string;
  channelId: string;
  channelName: string;
};

export async function getActiveAllocationChannels(): Promise<{
  ok: boolean;
  channels: ActiveChannel[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: alloc } = await supabase
    .from("allocations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!alloc) return { ok: true, channels: [] };

  const { data, error } = await supabase
    .from("allocation_items")
    .select("id, channel_id, gom_channels ( name )")
    .eq("allocation_id", alloc.id);
  if (error) return { ok: false, channels: [], error: error.message };

  const rows = (data ?? []) as unknown as {
    id: string;
    channel_id: string;
    gom_channels: { name: string | null } | null;
  }[];
  return {
    ok: true,
    channels: rows.map((r) => ({
      allocationItemId: r.id,
      channelId: r.channel_id,
      channelName: r.gom_channels?.name ?? r.channel_id,
    })),
  };
}

/** Histórico de métricas do business (AC5 — ordenado por criação desc). */
export type MetricsRow = {
  id: string;
  channelName: string;
  periodStart: string;
  periodEnd: string;
  spendActual: number | null;
  roas: number | null;
  cpa: number | null;
  paybackActual: number | null;
  contribution: number | null;
  createdAt: string;
};

export async function getChannelMetrics(): Promise<{
  ok: boolean;
  rows: MetricsRow[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channel_metrics")
    .select(
      "id, period_start, period_end, spend_actual, roas, cpa, payback_actual, contribution, created_at, gom_channels ( name )"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, rows: [], error: error.message };

  const rows = (data ?? []) as unknown as {
    id: string;
    period_start: string;
    period_end: string;
    spend_actual: number | null;
    roas: number | null;
    cpa: number | null;
    payback_actual: number | null;
    contribution: number | null;
    created_at: string;
    gom_channels: { name: string | null } | null;
  }[];
  return {
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      channelName: r.gom_channels?.name ?? "—",
      periodStart: r.period_start,
      periodEnd: r.period_end,
      spendActual: r.spend_actual,
      roas: r.roas,
      cpa: r.cpa,
      paybackActual: r.payback_actual,
      contribution: r.contribution,
      createdAt: r.created_at,
    })),
  };
}
