import { createClient } from "@/lib/supabase/server";

/**
 * Tipos do GOM browser (Story 2.4).
 *
 * Os scores 1..5 vêm das colunas canônicas do AC3 da Story 2.1
 * (cost_score, payback_score, control_score, risk_score, scale_score).
 */
export type GomChannel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cost_score: number;
  payback_score: number;
  control_score: number;
  risk_score: number;
  scale_score: number;
  category_id: string;
  category_name: string;
  category_slug: string;
  pillar_id: string;
  pillar_name: string;
  pillar_slug: string;
};

export type GomPillar = {
  id: string;
  slug: string;
  name: string;
  channels: GomChannel[];
};

type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  how_it_works: string | null;
  cost_score: number | null;
  payback_score: number | null;
  control_score: number | null;
  risk_score: number | null;
  scale_score: number | null;
  gom_categories: {
    id: string;
    slug: string;
    name: string;
    gom_pillars: {
      id: string;
      slug: string;
      name: string;
      sort: number | null;
    } | null;
  } | null;
};

/**
 * Busca todos os canais do GOM com sua categoria e pilar, via anon key + RLS
 * público (AC1, AC6). Não exige autenticação.
 *
 * O dataset é pequeno (~50 canais), então buscamos tudo uma vez no servidor e
 * deixamos busca/filtro acontecerem no cliente sem novos round-trips (AC2).
 */
export async function fetchGomChannels(): Promise<GomChannel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gom_channels")
    .select(
      `
        id, slug, name, how_it_works,
        cost_score, payback_score, control_score, risk_score, scale_score,
        gom_categories!inner (
          id, slug, name,
          gom_pillars!inner ( id, slug, name, sort )
        )
      `
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`[gom] Falha ao carregar canais: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ChannelRow[];

  return rows
    .filter((row) => row.gom_categories && row.gom_categories.gom_pillars)
    .map(mapChannelRow);
}

function mapChannelRow(row: ChannelRow): GomChannel {
  const category = row.gom_categories!;
  const pillar = category.gom_pillars!;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.how_it_works,
    cost_score: row.cost_score ?? 0,
    payback_score: row.payback_score ?? 0,
    control_score: row.control_score ?? 0,
    risk_score: row.risk_score ?? 0,
    scale_score: row.scale_score ?? 0,
    category_id: category.id,
    category_name: category.name,
    category_slug: category.slug,
    pillar_id: pillar.id,
    pillar_name: pillar.name,
    pillar_slug: pillar.slug,
  };
}

/**
 * Busca um único canal do GOM pelo ID (Story 2.5, AC1/AC4), via anon key + RLS
 * público. Retorna `null` quando o ID não existe, para que a página possa
 * acionar `notFound()` (404).
 */
export async function fetchGomChannelById(channelId: string): Promise<GomChannel | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gom_channels")
    .select(
      `
        id, slug, name, how_it_works,
        cost_score, payback_score, control_score, risk_score, scale_score,
        gom_categories!inner (
          id, slug, name,
          gom_pillars!inner ( id, slug, name, sort )
        )
      `
    )
    .eq("id", channelId)
    .maybeSingle();

  if (error) {
    throw new Error(`[gom] Falha ao carregar canal ${channelId}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ChannelRow;

  if (!row.gom_categories || !row.gom_categories.gom_pillars) {
    return null;
  }

  return mapChannelRow(row);
}
