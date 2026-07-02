"use server";

import { createClient } from "@/lib/supabase/server";
import {
  generateFunnelStructure,
  FunnelError,
  type FunnelConfig,
  type FunnelStructure,
} from "@/lib/executor/funnel";

/**
 * Arquiteto de funil (Story 8.1 — AC4, AC5). `saveFunnel` gera a estrutura (lib pura)
 * e persiste em `funnels`. `getLatestFunnel` devolve o último para a UI. RLS por business.
 */
export type SaveFunnelResult =
  | { ok: true; funnelId: string; structure: FunnelStructure }
  | { ok: false; error: string };

export async function saveFunnel(config: FunnelConfig): Promise<SaveFunnelResult> {
  let structure: FunnelStructure;
  try {
    structure = generateFunnelStructure(config);
  } catch (err) {
    if (err instanceof FunnelError) return { ok: false, error: err.message };
    throw err;
  }

  const supabase = await createClient();
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
    .from("funnels")
    .insert({
      business_id: businessId,
      objective: config.objective,
      product: config.product,
      audience: config.audience,
      cta: config.cta,
      bot_disclosure: config.botDisclosure,
      human_escape_config: config.humanEscapeConfig as unknown as object,
      structure: structure as unknown as object,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) return { ok: false, error: error.message };
  return { ok: true, funnelId: data.id, structure };
}

export async function getLatestFunnel(): Promise<{
  ok: boolean;
  structure: FunnelStructure | null;
  funnelId?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funnels")
    .select("id, structure")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; structure: FunnelStructure | null }>();
  if (error) return { ok: false, structure: null, error: error.message };
  return { ok: true, structure: data?.structure ?? null, funnelId: data?.id };
}
