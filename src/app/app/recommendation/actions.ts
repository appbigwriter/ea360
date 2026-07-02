"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicApiKey } from "@/lib/env.server";
import {
  buildRationaleSystemPrompt,
  buildRationaleUserPrompt,
  parseRationale,
  type RationaleProfileInput,
  type RationaleChannelInput,
} from "@/lib/recommendation/rationale-prompt";

/**
 * Camada de rationale via LLM (Story 4.4).
 *
 * Gera, para cada canal recomendado, os textos "porquê cabe" (`fit_reason`) e
 * "porquê evitar" (`avoid_reason`) e os persiste em `recommendation_items`.
 *
 * Os nomes canônicos do AC (`fit_reason`/`avoid_reason`) são colunas GERADAS na
 * migração 0013 (Story 4.1) — `generated always as (rationale_fit/rationale_avoid)
 * stored`. Colunas geradas NÃO podem ser escritas diretamente; por isso o UPDATE
 * abaixo grava nas colunas-base `rationale_fit`/`rationale_avoid`, e os campos do
 * AC refletem o valor automaticamente.
 *
 * Tolerante a falhas (AC5): qualquer erro do LLM/persistência é logado e os
 * campos ficam vazios — NUNCA bloqueia a recomendação. A escrita usa o admin
 * client (server-only) porque a geração roda fora do request do usuário (AC6,
 * execução assíncrona) — mesmo padrão da Story 3.3 (`interview/actions.ts`).
 *
 * NENHUM segredo é exposto ao client: o SDK é importado dinamicamente e a chave
 * vem de `env.server`.
 */

/** Modelo de baixo custo para a geração de rationale (Dev Note: Haiku). */
const RATIONALE_MODEL = "claude-3-5-haiku-latest";

export type GenerateRationaleResult =
  | { ok: true; fitReason: string; avoidReason: string }
  | { ok: false; error: string };

type RecommendationItemRow = {
  id: string;
  score: number | null;
  recommendation_id: string;
  channel_id: string;
};

type ChannelRow = {
  name: string;
  how_it_works: string | null;
  best_for: string | null;
  capital_intensity: number | null;
  liquidity: number | null;
  risk_score: number | null;
  control_score: number | null;
  scalability: number | null;
  category_id: string;
};

type ProfileRow = {
  goals: Record<string, unknown> | null;
  horizon: string | null;
  risk_tolerance: number | null;
  capital_available: number | null;
  effort_capacity: number | null;
  owned_audience: number | null;
  profile_data: Record<string, unknown> | null;
};

/**
 * Gera e persiste o rationale (fit/avoid) de um único item de recomendação.
 *
 * @param recommendationItemId id do `recommendation_items` alvo.
 */
export async function generateRationale(
  recommendationItemId: string
): Promise<GenerateRationaleResult> {
  if (!recommendationItemId) {
    return { ok: false, error: "recommendationItemId ausente." };
  }

  // Admin client: a geração roda fora do request do usuário (AC6). A leitura/
  // escrita é restrita por id; a posse já foi validada na criação dos itens.
  const admin = createAdminClient();

  try {
    // 1. Carrega o item (score de match + FKs) — AC3.
    const { data: item, error: itemError } = await admin
      .from("recommendation_items")
      .select("id, score, recommendation_id, channel_id")
      .eq("id", recommendationItemId)
      .maybeSingle<RecommendationItemRow>();

    if (itemError || !item) {
      return { ok: false, error: itemError?.message ?? "Item não encontrado." };
    }

    // 2. Atributos do canal + pilar/categoria (AC3).
    const { data: channel, error: channelError } = await admin
      .from("gom_channels")
      .select(
        "name, how_it_works, best_for, capital_intensity, liquidity, risk_score, control_score, scalability, category_id"
      )
      .eq("id", item.channel_id)
      .maybeSingle<ChannelRow>();

    if (channelError || !channel) {
      return { ok: false, error: channelError?.message ?? "Canal não encontrado." };
    }

    let pillarName: string | null = null;
    let categoryName: string | null = null;
    if (channel.category_id) {
      const { data: category } = await admin
        .from("gom_categories")
        .select("name, pillar_id")
        .eq("id", channel.category_id)
        .maybeSingle<{ name: string | null; pillar_id: string }>();
      categoryName = category?.name ?? null;
      if (category?.pillar_id) {
        const { data: pillar } = await admin
          .from("gom_pillars")
          .select("name")
          .eq("id", category.pillar_id)
          .maybeSingle<{ name: string | null }>();
        pillarName = pillar?.name ?? null;
      }
    }

    // 3. Perfil do empreendedor via a recomendação (AC3).
    let profileInput: RationaleProfileInput = {};
    const { data: rec } = await admin
      .from("recommendations")
      .select("profile_id")
      .eq("id", item.recommendation_id)
      .maybeSingle<{ profile_id: string | null }>();

    if (rec?.profile_id) {
      const { data: profile } = await admin
        .from("monetization_profiles")
        .select(
          "goals, horizon, risk_tolerance, capital_available, effort_capacity, owned_audience, profile_data"
        )
        .eq("id", rec.profile_id)
        .maybeSingle<ProfileRow>();

      if (profile) {
        profileInput = {
          goals: profile.goals,
          horizon: profile.horizon,
          riskTolerance: profile.risk_tolerance,
          capitalAvailable: profile.capital_available,
          effortCapacity: profile.effort_capacity,
          ownedAudience: profile.owned_audience,
          profileData: profile.profile_data,
        };
      }
    }

    const channelInput: RationaleChannelInput = {
      name: channel.name,
      pillarName,
      categoryName,
      costScore: channel.capital_intensity,
      paybackScore: channel.liquidity,
      riskScore: channel.risk_score,
      controlScore: channel.control_score,
      scaleScore: channel.scalability,
      howItWorks: channel.how_it_works,
      bestFor: channel.best_for,
    };

    // 4. Chamada ao LLM (AC1). Import dinâmico mantém o SDK fora do bundle do
    //    cliente (mesmo padrão da Story 3.3).
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: getAnthropicApiKey() });

    const message = await client.messages.create({
      model: RATIONALE_MODEL,
      max_tokens: 1024,
      system: buildRationaleSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildRationaleUserPrompt({
            profile: profileInput,
            channel: channelInput,
            matchScore: item.score,
          }),
        },
      ],
    });

    const text = message.content
      .filter(
        (block): block is { type: "text"; text: string } & typeof block => block.type === "text"
      )
      .map((block) => block.text)
      .join("\n");

    const rationale = parseRationale(text);
    if (!rationale) {
      // LLM respondeu em formato inesperado: não bloqueia, campos ficam vazios.
      console.error("[recommendation] rationale inválido para item", recommendationItemId);
      return { ok: false, error: "Resposta do LLM em formato inesperado." };
    }

    // 5. Persiste nas colunas-base (AC2). `fit_reason`/`avoid_reason` (geradas)
    //    refletem `rationale_fit`/`rationale_avoid` automaticamente.
    const { error: updateError } = await admin
      .from("recommendation_items")
      .update({
        rationale_fit: rationale.fitReason,
        rationale_avoid: rationale.avoidReason,
      })
      .eq("id", recommendationItemId);

    if (updateError) {
      console.error("[recommendation] Falha ao persistir rationale:", updateError);
      return { ok: false, error: updateError.message };
    }

    return {
      ok: true,
      fitReason: rationale.fitReason,
      avoidReason: rationale.avoidReason,
    };
  } catch (err) {
    // AC5: qualquer falha (LLM, rede, env) é logada e NÃO bloqueia a recomendação.
    console.error("[recommendation] generateRationale falhou:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro inesperado ao gerar rationale.",
    };
  }
}

/**
 * Dispara a geração de rationale para TODOS os itens de uma recomendação de forma
 * assíncrona e tolerante a rate limit (AC6).
 *
 * Usa `Promise.allSettled` (Dev Note) para gerar em paralelo sem que a falha de
 * um item derrube os demais. O chamador (orquestrador de geração — Story 4.x)
 * pode invocar SEM `await` para não bloquear a resposta do matchmaking inicial;
 * cada item que falhar simplesmente fica com os campos vazios (AC5).
 *
 * @returns contagem de itens com rationale gerado com sucesso.
 */
export async function generateRationaleForRecommendation(
  recommendationId: string
): Promise<{ ok: boolean; generated: number; total: number }> {
  if (!recommendationId) {
    return { ok: false, generated: 0, total: 0 };
  }

  const admin = createAdminClient();

  try {
    const { data: items, error } = await admin
      .from("recommendation_items")
      .select("id")
      .eq("recommendation_id", recommendationId);

    if (error || !items || items.length === 0) {
      return { ok: !error, generated: 0, total: 0 };
    }

    const results = await Promise.allSettled(
      items.map((row) => generateRationale(row.id as string))
    );

    const generated = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;

    return { ok: true, generated, total: items.length };
  } catch (err) {
    // Tolerância a falhas (AC5): nunca bloqueia a recomendação.
    console.error("[recommendation] generateRationaleForRecommendation falhou:", err);
    return { ok: false, generated: 0, total: 0 };
  }
}
