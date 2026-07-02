"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  emptyProfile,
  type MonetizationProfile,
  type ExcludedChannelDetail,
} from "@/lib/monetization/profile";
import { type ExcludedChannel, type FilterableChannel } from "@/lib/monetization/philosophy";

/**
 * Server Actions e helpers do Filtro de Filosofia (Story 3.6).
 *
 * Responsável por (a) carregar o catálogo de canais para o filtro, (b) mesclar
 * exclusões automáticas + manuais no `profile_data` (AC2/AC5) e (c) expor as
 * ações de adicionar/remover exclusão usadas pela página de perfil (AC5).
 *
 * Toda I/O roda no servidor sob a RLS "do dono". Nenhum segredo é exposto.
 */

type ProfileWithExclusions =
  | MonetizationProfile
  | (MonetizationProfile & { raw_answers?: unknown });

/**
 * Carrega os canais do GOM no formato mínimo do filtro (id/slug/name/pillar).
 * Leitura pública (RLS do GOM é público), reutilizando o mesmo join de
 * `src/app/gom/queries.ts`.
 */
export async function loadFilterableChannels(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FilterableChannel[]> {
  const { data, error } = await supabase
    .from("gom_channels")
    .select(
      `
        id, slug, name,
        gom_categories!inner (
          gom_pillars!inner ( slug )
        )
      `
    )
    .order("name", { ascending: true });

  if (error || !data) return [];

  type Row = {
    id: string;
    slug: string;
    name: string;
    gom_categories: { gom_pillars: { slug: string } | null } | null;
  };

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    pillarSlug: row.gom_categories?.gom_pillars?.slug ?? null,
  }));
}

/**
 * Mescla as exclusões automáticas do filtro de filosofia com os ajustes manuais
 * preservados (AC2/AC5) e grava o resultado em `profileData` (mutação in-place):
 * - `excluded_channel_details`: união (manual vence em caso de mesmo canal).
 * - `excluded_channels`: UUIDs derivados dos detalhes (contrato do matchmaking).
 */
export async function applyExclusionsToProfile(
  profileData: ProfileWithExclusions,
  autoExclusions: ExcludedChannel[],
  manualExclusions: ExcludedChannelDetail[]
): Promise<void> {
  const byId = new Map<string, ExcludedChannelDetail>();

  for (const e of autoExclusions) {
    byId.set(e.channelId, {
      channel_id: e.channelId,
      channel_name: e.channelName,
      reason: e.reason,
      source: "philosophy_filter",
    });
  }
  // Manual vence: sobrescreve a origem automática para o mesmo canal.
  for (const m of manualExclusions) {
    byId.set(m.channel_id, { ...m, source: "user_manual" });
  }

  const details = [...byId.values()];
  profileData.excluded_channel_details = details;
  profileData.excluded_channels = details.map((d) => d.channel_id);
}

/** Resultado padrão das ações de edição de exclusão (AC5). */
export type MutateExclusionResult =
  | { ok: true; excludedChannels: string[] }
  | { ok: false; error: string };

/** Carrega o perfil mais recente do dono (id + profile_data) para edição. */
async function loadOwnProfile(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ id: string; profile: MonetizationProfile } | null> {
  const { data, error } = await supabase
    .from("monetization_profiles")
    .select("id, profile_data")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const raw = data.profile_data;
  const base = emptyProfile();
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    base.excluded_channels = Array.isArray(obj.excluded_channels)
      ? (obj.excluded_channels.filter((x) => typeof x === "string") as string[])
      : [];
    base.excluded_channel_details = Array.isArray(obj.excluded_channel_details)
      ? (obj.excluded_channel_details.filter(
          (d) => typeof d === "object" && d !== null
        ) as ExcludedChannelDetail[])
      : [];
    base.objectives = pickStrings(obj.objectives);
    base.philosophy = pickStrings(obj.philosophy);
    base.current_stage = typeof obj.current_stage === "string" ? obj.current_stage : "";
    base.resources = pickStrings(obj.resources);
  }

  return { id: data.id as string, profile: base };
}

function pickStrings(v: unknown): string[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "string") as string[]) : [];
}

/** Persiste a lista de detalhes mesclada e re-renderiza a página (AC5). */
async function persistExclusions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  base: MonetizationProfile,
  details: ExcludedChannelDetail[]
): Promise<MutateExclusionResult> {
  const excluded = details.map((d) => d.channel_id);
  const nextProfile: MonetizationProfile = {
    ...base,
    excluded_channel_details: details,
    excluded_channels: excluded,
  };

  const { error } = await supabase
    .from("monetization_profiles")
    .update({ profile_data: nextProfile })
    .eq("id", profileId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/profile");
  return { ok: true, excludedChannels: excluded };
}

/**
 * AC5: remove um canal da lista de exclusão (passa a aparecer no matchmaking).
 */
export async function removeExcludedChannel(channelId: string): Promise<MutateExclusionResult> {
  if (!channelId) return { ok: false, error: "Canal inválido." };
  const supabase = await createClient();

  const owned = await loadOwnProfile(supabase);
  if (!owned) return { ok: false, error: "Perfil não encontrado." };

  const details = owned.profile.excluded_channel_details.filter((d) => d.channel_id !== channelId);
  return persistExclusions(supabase, owned.id, owned.profile, details);
}

/**
 * AC5: adiciona um canal à lista de exclusão como ajuste manual do usuário.
 */
export async function addExcludedChannel(channelId: string): Promise<MutateExclusionResult> {
  if (!channelId) return { ok: false, error: "Canal inválido." };
  const supabase = await createClient();

  // Valida que o canal existe e busca o nome para exibição (AC4).
  const { data: channel, error: chError } = await supabase
    .from("gom_channels")
    .select("id, name")
    .eq("id", channelId)
    .maybeSingle();

  if (chError || !channel) return { ok: false, error: "Canal inexistente." };

  const owned = await loadOwnProfile(supabase);
  if (!owned) return { ok: false, error: "Perfil não encontrado." };

  if (owned.profile.excluded_channel_details.some((d) => d.channel_id === channelId)) {
    // Já excluído — idempotente.
    return {
      ok: true,
      excludedChannels: owned.profile.excluded_channels,
    };
  }

  const details: ExcludedChannelDetail[] = [
    ...owned.profile.excluded_channel_details,
    {
      channel_id: channel.id as string,
      channel_name: channel.name as string,
      reason: "Adicionado manualmente por você.",
      source: "user_manual",
    },
  ];
  return persistExclusions(supabase, owned.id, owned.profile, details);
}
