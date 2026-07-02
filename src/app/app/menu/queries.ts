import { createClient } from "@/lib/supabase/server";

/**
 * Leitura do menu personalizado de canais recomendados (Story 4.5).
 *
 * Carrega a recomendação ATIVA do business do usuário autenticado e os seus
 * itens já rankeados, com as métricas financeiras (Story 4.3), o rationale via
 * LLM (Story 4.4) e os atributos do canal (nome/pilar) do GOM (Story 2.1).
 *
 * RLS isola por dono: as policies "recommendations do dono" / "rec_items do
 * dono" (migração 0013, Story 4.1) garantem que só os dados do business do
 * usuário sejam retornados. Por isso a query usa o client server (anon + sessão)
 * e NÃO o admin client — nenhum segredo é exposto.
 */

/** Status que representam uma recomendação "ainda gerando" (AC5). */
export const PENDING_RECOMMENDATION_STATUSES = ["draft", "gerada"] as const;

/** Item de canal exibido no menu (AC1). */
export type MenuChannel = {
  /** id do `recommendation_items` (não do canal) — usado nas rotas internas. */
  id: string;
  channelId: string;
  name: string;
  pillarName: string | null;
  /** Slug estável do pilar (`ads`/`afiliacoes`/`parcerias`) — Story 5.5. */
  pillarSlug: string | null;
  matchScore: number;
  estimatedSpend: number;
  returnRangeMin: number;
  returnRangeMax: number;
  paybackMonths: number;
  riskScore: number;
  fitReason: string | null;
  avoidReason: string | null;
  rankPosition: number;
};

/** Resultado da leitura do menu (AC1, AC5, AC6). */
export type MenuResult = {
  /** `null` quando não há nenhuma recomendação para o business (AC6). */
  recommendationId: string | null;
  /** `true` quando a recomendação existe mas ainda está sendo gerada (AC5). */
  generating: boolean;
  channels: MenuChannel[];
};

type RecommendationRow = {
  id: string;
  status: string | null;
};

type ItemRow = {
  id: string;
  channel_id: string;
  match_score: number | null;
  estimated_spend: number | null;
  return_range_min: number | null;
  return_range_max: number | null;
  payback_months: number | null;
  risk_score: number | null;
  fit_reason: string | null;
  avoid_reason: string | null;
  rank_position: number | null;
  gom_channels: {
    name: string;
    gom_categories: {
      gom_pillars: { name: string | null; slug: string | null } | null;
    } | null;
  } | null;
};

const EMPTY_RESULT: MenuResult = {
  recommendationId: null,
  generating: false,
  channels: [],
};

/**
 * Carrega o menu do usuário autenticado: a recomendação mais recente (preferindo
 * a ativa) e seus itens. Tolerante — devolve um resultado vazio quando não há
 * recomendação, para que a página exiba o CTA de entrevista (AC6).
 */
export async function fetchMenu(): Promise<MenuResult> {
  const supabase = await createClient();

  // 1. Recomendação mais recente do business do usuário (RLS isola por dono).
  //    Preferimos a 'active'; se não houver, a mais recente serve para detectar
  //    o estado "gerando" (AC5) ou ausência total (AC6).
  const { data: recRow, error: recError } = await supabase
    .from("recommendations")
    .select("id, status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RecommendationRow>();

  if (recError || !recRow) {
    return EMPTY_RESULT;
  }

  const status = recRow.status ?? "";
  const generating = (PENDING_RECOMMENDATION_STATUSES as readonly string[]).includes(status);

  // 2. Itens rankeados + métricas + rationale + canal/pilar.
  const { data: itemRows, error: itemsError } = await supabase
    .from("recommendation_items")
    .select(
      `
        id, channel_id, match_score, estimated_spend,
        return_range_min, return_range_max, payback_months, risk_score,
        fit_reason, avoid_reason, rank_position,
        gom_channels!inner (
          name,
          gom_categories!inner (
            gom_pillars!inner ( name, slug )
          )
        )
      `
    )
    .eq("recommendation_id", recRow.id)
    .order("rank_position", { ascending: true });

  if (itemsError) {
    throw new Error(`[menu] Falha ao carregar itens: ${itemsError.message}`);
  }

  const rows = (itemRows ?? []) as unknown as ItemRow[];
  const channels = rows.filter((r) => r.gom_channels).map(mapItemRow);

  // Se a recomendação ainda está gerando e não há itens, sinaliza loading (AC5).
  if (channels.length === 0 && generating) {
    return { recommendationId: recRow.id, generating: true, channels: [] };
  }

  return {
    recommendationId: recRow.id,
    generating: false,
    channels,
  };
}

/** Carrega um único item do menu pelo seu id, para a página de detalhe (AC4). */
export async function fetchMenuChannel(itemId: string): Promise<MenuChannel | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recommendation_items")
    .select(
      `
        id, channel_id, match_score, estimated_spend,
        return_range_min, return_range_max, payback_months, risk_score,
        fit_reason, avoid_reason, rank_position,
        gom_channels!inner (
          name,
          gom_categories!inner (
            gom_pillars!inner ( name, slug )
          )
        )
      `
    )
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw new Error(`[menu] Falha ao carregar item ${itemId}: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as ItemRow;
  if (!row.gom_channels) return null;

  return mapItemRow(row);
}

function mapItemRow(row: ItemRow): MenuChannel {
  const channel = row.gom_channels!;
  const pillarName = channel.gom_categories?.gom_pillars?.name ?? null;
  const pillarSlug = channel.gom_categories?.gom_pillars?.slug ?? null;

  return {
    id: row.id,
    channelId: row.channel_id,
    name: channel.name,
    pillarName,
    pillarSlug,
    matchScore: row.match_score ?? 0,
    estimatedSpend: row.estimated_spend ?? 0,
    returnRangeMin: row.return_range_min ?? 0,
    returnRangeMax: row.return_range_max ?? 0,
    paybackMonths: row.payback_months ?? 0,
    riskScore: row.risk_score ?? 0,
    fitReason: row.fit_reason,
    avoidReason: row.avoid_reason,
    rankPosition: row.rank_position ?? 0,
  };
}
