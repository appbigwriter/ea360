"use server";

import { createClient } from "@/lib/supabase/server";
import { trackInterviewCompleted } from "@/lib/analytics";
import { getAnthropicApiKey } from "@/lib/env.server";
import {
  buildProfileSystemPrompt,
  buildProfileUserPrompt,
  buildFallbackProfile,
  parseMonetizationProfile,
  type MonetizationProfile,
  type ProfileQAItem,
  type ExcludedChannelDetail,
} from "@/lib/monetization/profile";
import { deriveExcludedChannels, type FilterableChannel } from "@/lib/monetization/philosophy";
import { applyExclusionsToProfile, loadFilterableChannels } from "./exclusions";

/**
 * Server Action de geração e persistência do Perfil de Monetização (Story 3.5).
 *
 * AC1: ao completar a entrevista, compila as Q&A e chama o LLM (Anthropic) para
 *      gerar um perfil estruturado (JSON).
 * AC2: o perfil é salvo em `monetization_profiles` com `interview_id` (FK) e
 *      `business_id`.
 * AC3: `profile_data` é o objeto consultável (objectives/philosophy/
 *      current_stage/resources/excluded_channels).
 * AC6: se o LLM falhar, persiste o perfil com os dados brutos das respostas e
 *      `is_llm_generated = false`.
 *
 * Toda I/O roda no servidor sob a RLS "do dono" (Story 3.1). Nenhum segredo é
 * exposto ao client/logs.
 */

/** Modelo usado para sintetizar o perfil — Haiku (custo menor, mesmo da 3.3). */
const PROFILE_MODEL = "claude-3-5-haiku-latest";

export type GenerateProfileResult =
  | { ok: true; profileId: string; isLlmGenerated: boolean }
  | { ok: false; error: string };

/**
 * Carrega o `business_id` da entrevista e as Q&A já respondidas, validando a
 * posse via RLS (a própria query só retorna linhas do dono).
 */
async function loadInterviewContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interviewId: string
): Promise<{ businessId: string; qa: ProfileQAItem[] } | null> {
  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("business_id")
    .eq("id", interviewId)
    .maybeSingle();

  if (interviewError || !interview?.business_id) {
    return null;
  }

  // Junta respostas com o texto da pergunta. interview_questions tem leitura
  // pública; interview_answers é isolado por dono (RLS). Buscamos as respostas
  // e, em seguida, os textos das perguntas correspondentes.
  const { data: answerRows } = await supabase
    .from("interview_answers")
    .select("question_id, answer_text, layer, created_at")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  const answers = (answerRows ?? []) as Array<{
    question_id: string | null;
    answer_text: string | null;
    layer: string | null;
  }>;

  const questionIds = answers.map((a) => a.question_id).filter((id): id is string => Boolean(id));

  const promptById = new Map<string, string>();
  if (questionIds.length > 0) {
    const { data: questionRows } = await supabase
      .from("interview_questions")
      .select("id, prompt")
      .in("id", questionIds);
    for (const q of (questionRows ?? []) as Array<{ id: string; prompt: string }>) {
      promptById.set(q.id, q.prompt);
    }
  }

  const qa: ProfileQAItem[] = answers
    .filter((a) => a.answer_text != null)
    .map((a) => ({
      question: (a.question_id && promptById.get(a.question_id)) || "Pergunta",
      answer: a.answer_text as string,
      layer: a.layer ?? null,
    }));

  return { businessId: interview.business_id as string, qa };
}

/** Tenta gerar o perfil via LLM (AC1). Retorna null em qualquer falha (AC6). */
async function generateViaLlm(qa: ProfileQAItem[]): Promise<MonetizationProfile | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: getAnthropicApiKey() });

    const message = await client.messages.create({
      model: PROFILE_MODEL,
      max_tokens: 1024,
      system: buildProfileSystemPrompt(),
      messages: [{ role: "user", content: buildProfileUserPrompt(qa) }],
    });

    const text = message.content
      .filter(
        (block): block is { type: "text"; text: string } & typeof block => block.type === "text"
      )
      .map((block) => block.text)
      .join("\n");

    return parseMonetizationProfile(text);
  } catch (err) {
    // AC6: falha do LLM não bloqueia — loga (sem segredos) e cai no fallback.
    console.error("[monetization] geração via LLM falhou:", err);
    return null;
  }
}

/**
 * Reúne as respostas relevantes para o filtro de filosofia (Story 3.6):
 * o campo `philosophy` sintetizado + as respostas cruas da camada 2 da
 * entrevista (mais ricas que a síntese para casamento por palavra-chave).
 */
function collectPhilosophyAnswers(profileData: MonetizationProfile, qa: ProfileQAItem[]): string[] {
  const fromProfile = profileData.philosophy ?? [];
  const fromQa = qa
    .filter((item) => item.layer === "filosofia")
    .map((item) => item.answer)
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0);
  return [...fromProfile, ...fromQa];
}

/**
 * Extrai as exclusões de origem manual (AC5) de um `profile_data` cru existente,
 * para que a regeneração do filtro de filosofia não as descarte.
 */
function extractManualExclusions(raw: unknown): ExcludedChannelDetail[] {
  if (typeof raw !== "object" || raw === null) return [];
  const details = (raw as Record<string, unknown>).excluded_channel_details;
  if (!Array.isArray(details)) return [];
  return details
    .filter((d): d is Record<string, unknown> => typeof d === "object" && d !== null)
    .filter((d) => d.source === "user_manual")
    .map((d) => ({
      channel_id: String(d.channel_id ?? ""),
      channel_name: String(d.channel_name ?? ""),
      reason: String(d.reason ?? "Ajuste manual do usuário."),
      source: "user_manual" as const,
    }))
    .filter((d) => d.channel_id.length > 0);
}

/**
 * Gera (ou regenera) e persiste o Perfil de Monetização da entrevista.
 * Idempotente por entrevista: faz upsert por `interview_id`, evitando perfis
 * duplicados se a conclusão for disparada mais de uma vez.
 */
export async function generateMonetizationProfile(
  interviewId: string
): Promise<GenerateProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const context = await loadInterviewContext(supabase, interviewId);
  if (!context) {
    return { ok: false, error: "Entrevista inexistente ou sem permissão." };
  }

  // AC1: tentativa via LLM; AC6: fallback determinístico se falhar.
  const llmProfile = await generateViaLlm(context.qa);
  const isLlmGenerated = llmProfile !== null;
  const profileData: MonetizationProfile | ReturnType<typeof buildFallbackProfile> =
    llmProfile ?? buildFallbackProfile(context.qa);

  // AC2: localiza o perfil existente da mesma entrevista (idempotência) e
  // recupera quaisquer ajustes manuais de exclusão feitos antes (Story 3.6, AC5)
  // para preservá-los na regeneração.
  const { data: existing } = await supabase
    .from("monetization_profiles")
    .select("id, profile_data")
    .eq("interview_id", interviewId)
    .maybeSingle();

  // Story 3.6, AC2: filtro de filosofia — marca canais a excluir a partir das
  // respostas da camada 2 (philosophy) + a resposta crua de exclusão. Resolve
  // contra o catálogo real do GOM e popula excluded_channels (UUIDs) e detalhes.
  const channels: FilterableChannel[] = await loadFilterableChannels(supabase);
  const philosophyAnswers = collectPhilosophyAnswers(profileData, context.qa);
  const autoExclusions = deriveExcludedChannels(philosophyAnswers, channels);
  const prevManualExclusions = extractManualExclusions(existing?.profile_data);
  // Preserva ajustes manuais anteriores do usuário (AC5) ao regenerar.
  await applyExclusionsToProfile(profileData, autoExclusions, prevManualExclusions);

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("monetization_profiles")
      .update({
        business_id: context.businessId,
        profile_data: profileData,
        is_llm_generated: isLlmGenerated,
      })
      .eq("id", existing.id);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    // Analytics (Story 9.1)
    trackInterviewCompleted(context.businessId, user.id, interviewId).catch(() => {});

    return { ok: true, profileId: existing.id as string, isLlmGenerated };
  }

  const { data: created, error: insertError } = await supabase
    .from("monetization_profiles")
    .insert({
      business_id: context.businessId,
      interview_id: interviewId,
      profile_data: profileData,
      is_llm_generated: isLlmGenerated,
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    return {
      ok: false,
      error: insertError?.message ?? "Não foi possível salvar o perfil.",
    };
  }

  // Analytics (Story 9.1)
  trackInterviewCompleted(context.businessId, user.id, interviewId).catch(() => {});

  return { ok: true, profileId: created.id as string, isLlmGenerated };
}
