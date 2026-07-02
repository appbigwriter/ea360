import { createClient } from "@/lib/supabase/server";
import {
  emptyProfile,
  type MonetizationProfile,
  type ExcludedChannelDetail,
  type ExclusionSource,
} from "@/lib/monetization/profile";

/**
 * Leitura do Perfil de Monetização para a página de visualização (Story 3.5,
 * AC5). RLS isola por dono (Story 3.1 / policy "monet_profiles do dono"), então
 * a query só retorna o perfil do negócio do usuário autenticado.
 */

export type MonetizationProfileView = {
  id: string;
  businessId: string;
  interviewId: string | null;
  /** Objeto consultável do AC3 (com defaults seguros). */
  profile: MonetizationProfile;
  isLlmGenerated: boolean;
  createdAt: string | null;
};

/** Normaliza o JSONB cru em um `MonetizationProfile` completo (defaults). */
function normalizeProfile(raw: unknown): MonetizationProfile {
  const base = emptyProfile();
  if (typeof raw !== "object" || raw === null) return base;
  const obj = raw as Record<string, unknown>;

  const asArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return {
    objectives: asArray(obj.objectives),
    philosophy: asArray(obj.philosophy),
    current_stage: typeof obj.current_stage === "string" ? obj.current_stage : "",
    resources: asArray(obj.resources),
    excluded_channels: asArray(obj.excluded_channels),
    excluded_channel_details: normalizeExclusionDetails(obj.excluded_channel_details),
  };
}

/** Normaliza os detalhes de exclusão (Story 3.6, AC4/AC5) com defaults seguros. */
function normalizeExclusionDetails(raw: unknown): ExcludedChannelDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null)
    .map((d) => {
      const source: ExclusionSource =
        d.source === "user_manual" ? "user_manual" : "philosophy_filter";
      return {
        channel_id: typeof d.channel_id === "string" ? d.channel_id : "",
        channel_name: typeof d.channel_name === "string" ? d.channel_name : "",
        reason: typeof d.reason === "string" && d.reason.length > 0 ? d.reason : "Canal excluído.",
        source,
      };
    })
    .filter((d) => d.channel_id.length > 0);
}

/**
 * Carrega o perfil de monetização mais recente do usuário autenticado.
 * Retorna `null` se ainda não houver perfil (ex.: entrevista não concluída).
 */
export async function fetchLatestMonetizationProfile(): Promise<MonetizationProfileView | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("monetization_profiles")
    .select("id, business_id, interview_id, profile_data, is_llm_generated, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id as string,
    businessId: data.business_id as string,
    interviewId: (data.interview_id as string | null) ?? null,
    profile: normalizeProfile(data.profile_data),
    isLlmGenerated: Boolean(data.is_llm_generated),
    createdAt: (data.created_at as string | null) ?? null,
  };
}

/**
 * Story 3.6, AC3 — contrato de integração com o matchmaking.
 *
 * Retorna os UUIDs de `gom_channels.id` excluídos pelo filtro de filosofia do
 * perfil informado, no formato `uuid[]` esperado por
 * `fn_match_channels(profile_id, excluded_channel_ids uuid[], limit_n)`
 * (Story 4.2). O matchmaking DEVE passar este array para garantir que canais
 * excluídos não apareçam nas recomendações (D-017–D-021).
 */
export async function fetchExcludedChannelIds(profileId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monetization_profiles")
    .select("profile_data")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) return [];
  return normalizeProfile(data.profile_data).excluded_channels;
}

/** Opção de canal para o seletor de adição manual de exclusão (Story 3.6, AC5). */
export type ChannelOption = { id: string; name: string };

/**
 * Lista todos os canais do GOM (id + nome) para popular o seletor de "adicionar
 * canal à lista de exclusão" no perfil (AC5). Leitura pública (RLS do GOM).
 */
export async function fetchAllChannelOptions(): Promise<ChannelOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gom_channels")
    .select("id, name")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return (data as Array<{ id: string; name: string }>).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}
