"use server";

import { createClient } from "@/lib/supabase/server";
import { checkReevaluationTriggers, type ReevaluationResult } from "@/lib/panel/reevaluation";

/**
 * Loop de reavaliação (Story 7.5 — AC1, AC4). `evaluateReevaluation` monta as
 * entradas (última entrevista, variação de orçamento, canais abaixo da projeção) e
 * aplica a lógica pura `checkReevaluationTriggers`. `startNewInterview` cria uma
 * nova entrevista `in_progress` (AC4). RLS por business (client server).
 */

export async function evaluateReevaluation(): Promise<
  ({ ok: true } & ReevaluationResult) | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Última entrevista => dias desde.
  const { data: lastInterview } = await supabase
    .from("interviews")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  const daysSince =
    lastInterview?.created_at != null
      ? (Date.now() - new Date(lastInterview.created_at).getTime()) / 86_400_000
      : null;

  // Variação de orçamento entre as duas carteiras mais recentes.
  const { data: allocs } = await supabase
    .from("allocations")
    .select("total_budget")
    .order("created_at", { ascending: false })
    .limit(2);
  const budgets = ((allocs ?? []) as { total_budget: number }[]).map((a) =>
    Number(a.total_budget ?? 0)
  );
  const budgetChangePct =
    budgets.length >= 2 && budgets[1] !== 0 ? ((budgets[0] - budgets[1]) / budgets[1]) * 100 : null;

  // Canais com desempenho real < 50% da projeção (proxy: gasto real < 0.5x alocado).
  const { data: items } = await supabase
    .from("allocation_items")
    .select("channel_id, amount")
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: metrics } = await supabase
    .from("channel_metrics")
    .select("channel_id, spend_actual");
  const realByChannel = new Map<string, number>();
  for (const m of (metrics ?? []) as { channel_id: string; spend_actual: number | null }[]) {
    realByChannel.set(m.channel_id, (realByChannel.get(m.channel_id) ?? 0) + (m.spend_actual ?? 0));
  }
  let below = 0;
  for (const it of (items ?? []) as { channel_id: string; amount: number }[]) {
    const real = realByChannel.get(it.channel_id);
    if (real !== undefined && Number(it.amount) > 0 && real < 0.5 * Number(it.amount)) below += 1;
  }

  const result = checkReevaluationTriggers({
    daysSinceLastInterview: daysSince,
    budgetChangePct,
    channelsBelowHalfProjected: below,
  });
  return { ok: true, ...result };
}

export async function startNewInterview(): Promise<
  { ok: true; interviewId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  // business_id do usuário via última entrevista ou alocação.
  const { data: biz } = await supabase
    .from("interviews")
    .select("business_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ business_id: string }>();
  let businessId = biz?.business_id ?? null;
  if (!businessId) {
    const { data: ab } = await supabase
      .from("allocations")
      .select("business_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ business_id: string }>();
    businessId = ab?.business_id ?? null;
  }
  if (!businessId) return { ok: false, error: "Business não encontrado." };

  const { data, error } = await supabase
    .from("interviews")
    .insert({ business_id: businessId, status: "in_progress" })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: error.message };
  return { ok: true, interviewId: data.id };
}
