/**
 * Filtro de Filosofia (Story 3.6) — helpers puros, sem SDK/IO.
 *
 * A camada 2 da Entrevista 360 ("Filosofia & Valores") captura princípios e o
 * que o empreendedor recusa por convicção. Este módulo traduz essas respostas
 * (texto livre + a pergunta `filosofia_excludentes` do seed) em uma lista de
 * canais do GOM a EXCLUIR das recomendações do matchmaking (AC2).
 *
 * Mantido isolado da Server Action para ser testável e client-safe: aqui só há
 * tipos e funções puras determinísticas. NENHUM segredo é lido. A resolução de
 * slug → UUID de `gom_channels.id` acontece na action (que tem acesso ao DB).
 *
 * Estratégia (No Invention — Article IV): regras determinísticas por palavra-
 * chave sobre os SLUGS canônicos já existentes no seed do GOM
 * (`20260101000007_gom_seed_story22.sql`). Não inventa canais nem categorias;
 * apenas mapeia convicções declaradas → canais já catalogados.
 */

/** Canal mínimo necessário para o filtro (slug + id resolvido pela action). */
export type FilterableChannel = {
  /** UUID de `gom_channels.id`. */
  id: string;
  /** Slug canônico do seed (ex.: 'paid_social', 'cupom_deal'). */
  slug: string;
  /** Nome legível para exibição do motivo (AC4). */
  name: string;
  /** Slug do pilar (ads/afiliacoes/parcerias) — usado por regras amplas. */
  pillarSlug?: string | null;
};

/**
 * Uma regra de exclusão: se algum dos `triggers` aparecer (normalizado) nas
 * respostas de filosofia, todos os canais cujo slug está em `channelSlugs` (ou
 * que casem com `pillarSlugs`) são marcados para exclusão com o `reason`.
 */
export type PhilosophyRule = {
  /** Identificador estável da regra (para auditoria/testes). */
  id: string;
  /** Termos que disparam a regra (comparados de forma normalizada). */
  triggers: string[];
  /** Slugs de canais concretos a excluir. */
  channelSlugs?: string[];
  /** Slugs de pilares a excluir por inteiro (regras amplas). */
  pillarSlugs?: string[];
  /** Motivo legível exibido ao usuário (AC4). */
  reason: string;
};

/** Resultado do filtro: um canal excluído com seu motivo (AC2/AC4). */
export type ExcludedChannel = {
  channelId: string;
  channelSlug: string;
  channelName: string;
  reason: string;
};

/**
 * Catálogo de regras do filtro de filosofia. Deriva diretamente das convicções
 * comuns sugeridas no próprio seed (`filosofia_excludentes`: "depender de Big
 * Tech, usar cupom, etc.") e das `risk_note`/natureza dos canais do GOM.
 */
export const PHILOSOPHY_RULES: PhilosophyRule[] = [
  {
    id: "no-big-tech",
    triggers: [
      "big tech",
      "bigtech",
      "depender de plataforma",
      "dependencia de plataforma",
      "dependência de plataforma",
      "evitar meta",
      "sem google",
      "sem meta",
      "sem facebook",
      "antitruste",
    ],
    channelSlugs: [
      "paid_social",
      "search_ads",
      "display_programatica",
      "video_ads",
      "app_install",
      "shopping_marketplace",
      "messaging_ads",
    ],
    reason: "Você indicou evitar dependência de Big Tech / grandes plataformas de mídia paga.",
  },
  {
    id: "no-coupon-discount",
    triggers: [
      "cupom",
      "cupons",
      "desconto",
      "descontos",
      "deal",
      "caça-oferta",
      "caca oferta",
      "guerra de preco",
      "guerra de preço",
    ],
    channelSlugs: ["cupom_deal"],
    reason: "Você indicou recusar estratégias baseadas em cupom/desconto agressivo.",
  },
  {
    id: "no-aggressive-push",
    triggers: [
      "push agressivo",
      "push marketing",
      "marketing agressivo",
      "spam",
      "interrupcao",
      "interrupção",
      "mensagem em massa",
      "disparo em massa",
    ],
    channelSlugs: ["messaging_ads", "afiliado_email", "native_ads"],
    reason: "Você indicou evitar abordagens de push/disparo agressivo e interrupção.",
  },
  {
    id: "no-mlm",
    triggers: ["mlm", "marketing multinivel", "marketing multinível", "pirâmide", "piramide"],
    channelSlugs: ["programa_afiliados_inhouse", "revendedores_comissao"],
    reason: "Você indicou recusar modelos de revenda em cadeia / MLM.",
  },
  {
    id: "no-affiliate",
    triggers: [
      "sem afiliado",
      "sem afiliados",
      "nao quero afiliados",
      "não quero afiliados",
      "evito afiliacao",
      "evito afiliação",
      "recuso afiliacao",
      "recuso afiliação",
    ],
    pillarSlugs: ["afiliacoes"],
    reason: "Você indicou não trabalhar com canais de afiliação.",
  },
  {
    id: "no-influencer",
    triggers: ["influencer", "influenciador", "creator pago", "sem influenciadores"],
    channelSlugs: ["influencer_pago", "programa_embaixadores"],
    reason: "Você indicou evitar marketing com influenciadores pagos.",
  },
];

/**
 * Normaliza texto para casamento robusto: minúsculas, sem acentos, espaços
 * colapsados. Determinístico e client-safe.
 */
export function normalizeText(input: string): string {
  return input.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Aplica as regras de filosofia às respostas (texto) e retorna os canais a
 * excluir, resolvidos contra o catálogo de canais informado (AC2).
 *
 * @param philosophyAnswers respostas de texto da camada 2 (e sugestões do LLM).
 * @param channels canais do GOM (com id/slug/name/pillarSlug) para resolver.
 * @returns lista deduplicada de canais excluídos com motivo (AC2/AC4).
 */
export function deriveExcludedChannels(
  philosophyAnswers: string[],
  channels: FilterableChannel[]
): ExcludedChannel[] {
  const haystack = normalizeText(philosophyAnswers.join(" \n "));
  if (haystack.length === 0 || channels.length === 0) return [];

  const bySlug = new Map<string, FilterableChannel>();
  const byPillar = new Map<string, FilterableChannel[]>();
  for (const ch of channels) {
    bySlug.set(ch.slug, ch);
    const p = ch.pillarSlug ?? null;
    if (p) {
      const list = byPillar.get(p) ?? [];
      list.push(ch);
      byPillar.set(p, list);
    }
  }

  // channelId → reason (primeira regra que o marcou vence; determinístico pela
  // ordem de PHILOSOPHY_RULES).
  const excluded = new Map<string, ExcludedChannel>();

  for (const rule of PHILOSOPHY_RULES) {
    const matched = rule.triggers.some((t) => haystack.includes(normalizeText(t)));
    if (!matched) continue;

    const targets: FilterableChannel[] = [];
    for (const slug of rule.channelSlugs ?? []) {
      const ch = bySlug.get(slug);
      if (ch) targets.push(ch);
    }
    for (const pillar of rule.pillarSlugs ?? []) {
      for (const ch of byPillar.get(pillar) ?? []) targets.push(ch);
    }

    for (const ch of targets) {
      if (excluded.has(ch.id)) continue;
      excluded.set(ch.id, {
        channelId: ch.id,
        channelSlug: ch.slug,
        channelName: ch.name,
        reason: rule.reason,
      });
    }
  }

  return [...excluded.values()];
}

/**
 * Extrai apenas os UUIDs de canal a partir de uma lista de exclusões — formato
 * consumido pelo matchmaking (`fn_match_channels(..., excluded_channel_ids
 * uuid[], ...)` da Story 4.2) e persistido em `profile_data.excluded_channels`.
 */
export function toExcludedChannelIds(excluded: ExcludedChannel[]): string[] {
  return [...new Set(excluded.map((e) => e.channelId))];
}
