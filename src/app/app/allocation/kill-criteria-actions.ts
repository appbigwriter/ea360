"use server";

import { createClient } from "@/lib/supabase/server";
import {
  assertExperimentsHaveKillCriteria,
  validateKillCriteria,
  toExperimentRow,
  KillCriteriaError,
  type KillCriteriaInput,
  type KillCriteriaEntry,
} from "@/lib/allocation/kill-criteria";

/**
 * Server Actions de kill-criteria por experimento (Story 5.6 — AC1, AC3, AC4).
 *
 * Toda alocação com canais na faixa "experiment" (Story 5.2) exige kill-criteria
 * preenchido por canal experimental antes da confirmação (PRD R4 / F3.2). A validação
 * pura vive em `@/lib/allocation/kill-criteria`; aqui ficam a leitura dos itens de
 * experimento e a persistência em `experiments` (Story 5.1 / AC4).
 *
 * RLS ("experiments do dono" / "allocation_items do dono", migração 0015) isola por
 * business — usamos o client server (anon + sessão), NUNCA o admin. Nenhum segredo é
 * exposto ao client.
 *
 * IDS: REUSE do padrão de Server Action de `allocation/actions.ts` (createClient
 * server + RLS) e dos validadores puros do lib. CREATE justificado: gating de
 * submissão por kill-criteria (capacidade nova).
 */

export type KillCriteriaActionResult =
  | { ok: true; savedCount: number }
  | { ok: false; error: string; missingItemIds?: string[] };

/** Resumo de um canal de experimento que exige kill-criteria (consumido pela UI). */
export type ExperimentChannelInfo = {
  allocationItemId: string;
  channelId: string;
  amount: number;
};

/**
 * Lista os `allocation_items` de uma alocação cuja `risk_band = 'experiment'` (AC5).
 * A UI usa essa lista para renderizar um `KillCriteriaForm` por canal experimental.
 * Canais "core"/"growth" não entram (AC6). RLS restringe ao business do usuário.
 */
export async function listExperimentChannels(
  allocationId: string
): Promise<ExperimentChannelInfo[]> {
  if (!allocationId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allocation_items")
    .select("id, channel_id, amount")
    .eq("allocation_id", allocationId)
    .eq("risk_band", "experiment");

  if (error || !data) return [];

  return data.map((r) => ({
    allocationItemId: r.id as string,
    channelId: r.channel_id as string,
    amount: Number(r.amount ?? 0),
  }));
}

/**
 * Persiste o kill-criteria de UM canal de experimento (AC4 / Task 3).
 * `saveKillCriteria(allocationItemId, data)` → INSERT em `experiments`.
 *
 * Valida o conteúdo antes de gravar (AC3). RLS garante isolamento por business.
 */
export async function saveKillCriteria(
  allocationItemId: string,
  data: KillCriteriaInput
): Promise<KillCriteriaActionResult> {
  if (!allocationItemId) {
    return { ok: false, error: "allocationItemId ausente." };
  }

  try {
    validateKillCriteria(data);
  } catch (err) {
    if (err instanceof KillCriteriaError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("experiments")
    .insert(toExperimentRow({ allocationItemId, ...data }));

  if (error) {
    console.error("[kill-criteria] saveKillCriteria falhou:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, savedCount: 1 };
}

/**
 * Confirma a alocação persistindo o kill-criteria de TODOS os canais de experimento
 * (AC1, AC3, AC4). Bloqueia (nada gravado) se algum canal de experimento estiver sem
 * kill-criteria válido.
 *
 * Fluxo:
 *   1. Lê os `allocation_items` de experimento da alocação (RLS isola por dono).
 *   2. Exige kill-criteria válido para CADA um (`assertExperimentsHaveKillCriteria`).
 *   3. Insere os registros em `experiments` num único batch.
 *
 * Canais "core"/"growth" não entram no passo 1 — não exigem kill-criteria (AC6).
 */
export async function saveAllKillCriteria(
  allocationId: string,
  entries: KillCriteriaEntry[]
): Promise<KillCriteriaActionResult> {
  if (!allocationId) {
    return { ok: false, error: "allocationId ausente." };
  }

  const supabase = await createClient();

  // 1. Itens de experimento da alocação (RLS já restringe ao business do usuário).
  const { data: itemRows, error: itemsError } = await supabase
    .from("allocation_items")
    .select("id, risk_band")
    .eq("allocation_id", allocationId)
    .eq("risk_band", "experiment");

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  const experimentItemIds = (itemRows ?? []).map((r) => r.id as string);

  // AC6: sem canais de experimento => nada a exigir nem gravar.
  if (experimentItemIds.length === 0) {
    return { ok: true, savedCount: 0 };
  }

  // 2. Exige kill-criteria para CADA canal de experimento (AC1, AC3).
  let valid: KillCriteriaEntry[];
  try {
    valid = assertExperimentsHaveKillCriteria(experimentItemIds, entries);
  } catch (err) {
    if (err instanceof KillCriteriaError) {
      return { ok: false, error: err.message, missingItemIds: err.missingItemIds };
    }
    throw err;
  }

  // 3. Insere todos os experimentos num único batch (AC4).
  const { error: insertError } = await supabase
    .from("experiments")
    .insert(valid.map(toExperimentRow));

  if (insertError) {
    console.error("[kill-criteria] saveAllKillCriteria falhou:", insertError.message);
    return { ok: false, error: insertError.message };
  }

  return { ok: true, savedCount: valid.length };
}
