/**
 * Engine de alocação 70/20/10 parametrizável (Story 5.2).
 *
 * Funções PURAS (sem SDK/IO/segredos) que distribuem um orçamento total entre as
 * três faixas de risco do portfólio de monetização e, dentro de cada faixa, entre
 * os canais recomendados:
 *   - núcleo  (core)        — padrão 70% — canais com risk_score 1–2.
 *   - crescimento (growth)  — padrão 20% — canais com risk_score 3.
 *   - experimento (exp.)    — padrão 10% — canais com risk_score 4–5.
 *
 * A regra 70/20/10 é parametrizável via `ratios` (AC2): valida-se que a soma das
 * três faixas seja exatamente 100% (tolerância ±0,01 p.p.).
 *
 * A classificação por faixa (AC3) usa o `risk_score` do GOM (Story 2.1):
 *   1–2 => core, 3 => growth, 4–5 => experiment.
 *
 * A verba de cada faixa é distribuída entre seus canais (AC4):
 *   - igualmente, quando os canais não têm `match_score` utilizável; ou
 *   - proporcionalmente ao `match_score`, quando há scores positivos.
 *
 * Implementada como utilitário TypeScript (mesma decisão da Story 4.3) — e NÃO
 * como SQL — para facilitar calibração e teste das regras sem migração de banco.
 * A Server Action wrapper (`actions.ts`) consome estas funções e persiste o
 * resultado em `allocations` + `allocation_items` (Story 5.1 / AC5).
 *
 * Invariante de consistência (AC6): a soma de `amount` dos itens é igual ao
 * orçamento total (tolerância ±R$0,01). Resíduos de arredondamento são absorvidos
 * pelo último item de cada faixa para garantir a igualdade exata por centavos.
 */

/** Faixas de risco do portfólio (espelha o enum `risk_band` da migração 0015). */
export type RiskBand = "core" | "growth" | "experiment";

/** Distribuição percentual entre as faixas (AC2). Valores em pontos percentuais. */
export type RiskBandRatios = {
  core: number;
  growth: number;
  experiment: number;
};

/** Ratios padrão 70/20/10 (AC2 / PRD R4). */
export const DEFAULT_RATIOS: RiskBandRatios = {
  core: 70,
  growth: 20,
  experiment: 10,
};

/** Tolerância monetária de ±R$0,01 para a checagem de consistência (AC6). */
export const AMOUNT_TOLERANCE = 0.01;

/** Tolerância da soma dos ratios (em pontos percentuais) — robusta a float. */
const RATIO_SUM_TOLERANCE = 0.01;

/**
 * Parâmetros do modelo de perda/downside por canal (Story 6.2 — AC1).
 *
 * A taxa de perda por canal é linear no `risk_score` (1..5):
 *   risk_loss_rate = (risk_score - 1) / 4 * DOWNSIDE_SLOPE + DOWNSIDE_FLOOR
 * com `DOWNSIDE_FLOOR = 0.2` (perda mínima 20% em risk 1) e `DOWNSIDE_SLOPE = 0.8`
 * (perda máxima 100% em risk 5). Documentado como constante nomeada (Dev Note 6.2).
 *
 * Tabela de referência (PRD R5 / F3.3 — "modelo de downside"):
 *   risk 1 => 20% | risk 2 => 40% | risk 3 => 60% | risk 4 => 80% | risk 5 => 100%.
 */
export const DOWNSIDE_FLOOR = 0.2;
export const DOWNSIDE_SLOPE = 0.8;

/** Limites do `risk_score` usados para normalizar a taxa de perda (Story 6.2). */
const DOWNSIDE_MIN_RISK = 1;
const DOWNSIDE_MAX_RISK = 5;

/**
 * Teto global padrão por canal sugerido pelo PRD/Dev Note 5.4 (40% do orçamento
 * total). Aplicado quando o usuário opta por um teto global e não define teto
 * individual para o canal.
 */
export const DEFAULT_GLOBAL_CEILING_PCT = 40;

/** Máximo de iterações da redistribuição de excedente (Dev Note 5.4) — anti-loop. */
const MAX_REDISTRIBUTION_ITERATIONS = 10;

/**
 * Máximo de iterações do guardrail de mínimo entre pilares (Story 5.5) — anti-loop.
 * Cada iteração move verba de pilares acima do mínimo para pilares abaixo; em poucas
 * passadas converge (3 pilares), mas o teto fica como salvaguarda determinística.
 */
const MAX_PILLAR_MIN_ITERATIONS = 10;

/** Canal candidato à alocação (subset de `gom_channels` + match do menu). */
export type AllocationChannelInput = {
  /** id do canal (`gom_channels.id`) — repassado ao `allocation_item`. */
  channelId: string;
  /** Nota de risco 1..5 do GOM (Story 2.1) — define a faixa (AC3). */
  riskScore: number;
  /**
   * Score de match do menu (Story 4.2), opcional. Quando presente e positivo em
   * ao menos um canal da faixa, a distribuição é proporcional (AC4).
   */
  matchScore?: number | null;
  /**
   * Teto por canal (guardrail — Story 5.4), em pontos percentuais do orçamento
   * TOTAL (0..100). Quando presente, o `amount` do canal nunca excede
   * `totalBudget * ceilingPct / 100` (5.4 AC3). `ceilingPct === 0` exclui o canal
   * da alocação (5.4 AC6). `undefined`/`null` => sem teto.
   */
  ceilingPct?: number | null;
  /**
   * Pilar de monetização do canal (Story 5.5) — chave estável vinda de
   * `gom_pillars.slug` (ex: `ads`, `afiliacoes`, `parcerias`). Usada pelo guardrail
   * de mínimo entre pilares para agrupar os canais. `undefined`/`null` => o canal
   * não participa de nenhum mínimo de pilar.
   */
  pillarKey?: string | null;
};

/**
 * Mínimo de investimento por pilar (guardrail — Story 5.5), em pontos percentuais
 * do orçamento TOTAL (0..100). Chave = `pillarKey` (slug do pilar). Mínimos ausentes
 * ou <= 0 não impõem restrição (AC5 — padrão = 0% / desativado).
 */
export type PillarMinimums = Record<string, number>;

/** Item de alocação calculado, pronto para persistir em `allocation_items` (AC5). */
export type AllocationItem = {
  channelId: string;
  amount: number;
  /** Percentual do item sobre o orçamento TOTAL (não sobre a faixa) — 0..100. */
  percentage: number;
  riskBand: RiskBand;
  /**
   * Teto efetivo aplicado ao canal (Story 5.4), em R$. `null` quando o canal não
   * tem teto configurado. Permite à UI marcar o canal e exibir o limite (AC5).
   */
  ceilingAmount?: number | null;
  /**
   * `true` quando o canal atingiu (ou ficou colado em) seu teto (Story 5.4 AC5) —
   * usado para o badge "Teto atingido" na UI.
   */
  ceilingReached?: boolean;
  /**
   * Pilar de monetização do canal (Story 5.5), propagado da entrada (`pillarKey`).
   * `null` quando o canal não tem pilar associado. Permite à UI agrupar por pilar
   * e exibir o status do guardrail de mínimo.
   */
  pillarKey?: string | null;
  /**
   * Perda máxima estimada do canal em R$ (Story 6.2 — AC1). Calculada a partir do
   * `amount` final e do `risk_score` via `calcDownside`. Sempre presente nos itens
   * retornados pela engine; persistida em `allocation_items.downside_estimate` (AC4).
   */
  downsideEstimate?: number;
};

/**
 * Aviso do guardrail de mínimo entre pilares (Story 5.5 AC4): pilar que NÃO atingiu
 * o mínimo configurado mesmo após a realocação (orçamento insuficiente ou sem canais
 * com folga para receber a verba).
 */
export type PillarMinimumWarning = {
  pillarKey: string;
  /** Mínimo exigido em R$ (`totalBudget * minPct / 100`). */
  requiredAmount: number;
  /** Verba efetivamente alocada ao pilar após a realocação, em R$. */
  allocatedAmount: number;
  /** Mínimo exigido em pontos percentuais do orçamento total. */
  minPct: number;
};

/** Resultado completo da alocação (consumido pela Server Action). */
export type AllocationResult = {
  totalBudget: number;
  ratios: RiskBandRatios;
  items: AllocationItem[];
  /**
   * Pilares cujo mínimo não pôde ser satisfeito (Story 5.5 AC4). Vazio quando todos
   * os mínimos foram atendidos ou nenhum mínimo foi configurado.
   */
  pillarWarnings?: PillarMinimumWarning[];
};

/** Erro de validação descritivo da engine (AC2, AC7). */
export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllocationError";
  }
}

/** Arredonda para 2 casas (centavos); valores não-finitos viram 0. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Classifica um canal em sua faixa de risco a partir do `risk_score` (AC3):
 *   score <= 2 => core; score === 3 => growth; score >= 4 => experiment.
 * Scores não-finitos caem em `core` (faixa mais conservadora — defensivo).
 */
export function classifyRiskBand(riskScore: number): RiskBand {
  if (!Number.isFinite(riskScore)) return "core";
  if (riskScore <= 2) return "core";
  if (riskScore < 4) return "growth";
  return "experiment";
}

/**
 * Taxa de perda (downside) de um canal a partir do `risk_score` (Story 6.2 — AC1).
 *
 * Linear em `risk_score` (1..5), normalizada e saturada na faixa [floor, floor+slope]:
 *   risk_loss_rate = (clamp(risk_score, 1, 5) - 1) / 4 * DOWNSIDE_SLOPE + DOWNSIDE_FLOOR
 *
 * Resultado: risk 1 => 0,2 (20%) ... risk 5 => 1,0 (100%). Scores fora de 1..5 são
 * saturados nos extremos; scores não-finitos caem no piso (mais conservador no sentido
 * de não inventar perda — defensivo). Retorna a TAXA (0..1), não o valor em R$.
 */
export function downsideRate(riskScore: number): number {
  if (!Number.isFinite(riskScore)) return DOWNSIDE_FLOOR;
  const clamped = Math.min(DOWNSIDE_MAX_RISK, Math.max(DOWNSIDE_MIN_RISK, riskScore));
  const normalized = (clamped - DOWNSIDE_MIN_RISK) / (DOWNSIDE_MAX_RISK - DOWNSIDE_MIN_RISK);
  return normalized * DOWNSIDE_SLOPE + DOWNSIDE_FLOOR;
}

/**
 * Perda máxima estimada de um canal em R$ (Story 6.2 — AC1):
 *   downside = amount * downsideRate(riskScore)
 * Arredondado a centavos. `amount` não-finito ou negativo => 0 (defensivo).
 */
export function calcDownside(amount: number, riskScore: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return round2(amount * downsideRate(riskScore));
}

/**
 * Soma o downside de todos os itens da carteira (Story 6.2 — AC2). Usa o campo já
 * calculado `downsideEstimate` quando presente; caso contrário, retorna 0 para o item
 * (defensivo — itens sem downside não contribuem). Resultado arredondado a centavos.
 */
export function portfolioDownside(items: AllocationItem[]): number {
  return round2(items.reduce((acc, i) => acc + (i.downsideEstimate ?? 0), 0));
}

/**
 * Configuração de guardrails de risco personalizáveis (Story 6.3 — AC1).
 *
 * Todos os campos são OPCIONAIS (guardrail só é verificado quando configurado —
 * `undefined`/`null`/valor inválido => regra inativa, sem inventar limites). Os
 * percentuais são pontos percentuais do orçamento TOTAL (0..100).
 *
 *   - maxPillarConcentrationPct: concentração MÁXIMA por pilar (% do total).
 *   - maxChannelConcentrationPct: concentração MÁXIMA por canal (% do total).
 *   - minPillarPct: investimento MÍNIMO por pilar (% do total).
 *   - maxDownsideAmount: downside (perda máx.) total da carteira em R$ (absoluto).
 *   - maxDownsidePct: downside total da carteira como % do orçamento total.
 *
 * Padrões sugeridos (Dev Note 6.3): pilar 60%, canal 40%, downside 50% do budget.
 */
export type GuardrailConfig = {
  maxPillarConcentrationPct?: number | null;
  maxChannelConcentrationPct?: number | null;
  minPillarPct?: number | null;
  maxDownsideAmount?: number | null;
  maxDownsidePct?: number | null;
};

/** Tipo de regra de guardrail violada (Story 6.3 — AC3). */
export type GuardrailViolationType =
  | "pillar_concentration"
  | "channel_concentration"
  | "pillar_minimum"
  | "downside_total";

/**
 * Violação de guardrail detectada (Story 6.3 — AC3). Estrutura serializável,
 * pronta para exibição na UI (AC4) e persistência. `limit`/`actual` em R$ ou %
 * conforme o tipo da regra; `unit` distingue.
 */
export type GuardrailViolation = {
  type: GuardrailViolationType;
  /** Entidade afetada: slug do pilar, id do canal, ou 'portfolio'. */
  entityKey: string;
  /** Rótulo amigável da entidade (nome do pilar/canal) — preenchido pela UI. */
  entityLabel?: string;
  /** Valor-limite configurado (% ou R$ conforme `unit`). */
  limit: number;
  /** Valor efetivo observado na carteira (% ou R$ conforme `unit`). */
  actual: number;
  /** Unidade de `limit`/`actual`: 'pct' (pontos percentuais) ou 'brl' (R$). */
  unit: "pct" | "brl";
  /** Mensagem descritiva pronta para exibição (AC4). */
  message: string;
};

/** Sugestões de guardrail padrão (Dev Note 6.3). Apenas defaults da UI. */
export const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxPillarConcentrationPct: 60,
  maxChannelConcentrationPct: 40,
  maxDownsidePct: 50,
};

/** Limpa um percentual de guardrail: retorna `null` quando fora de 0..100. */
function sanitizePct(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

/** Limpa um valor monetário de guardrail: retorna `null` quando < 0 / inválido. */
function sanitizeAmount(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Verifica todos os guardrails ATIVOS da configuração contra uma carteira
 * (Story 6.3 — AC3) e devolve a lista de violações (AC4). NÃO bloqueia: é o
 * chamador quem decide o que fazer com as violações (aviso, não erro).
 *
 * Guardrails inativos (campo ausente/`null`/inválido) são ignorados — No
 * Invention (Article IV): só se verifica o que o usuário configurou.
 *
 * @param items    itens da carteira (com `amount`, `pillarKey`, `downsideEstimate`).
 * @param config   configuração de guardrails do usuário.
 * @param totalBudget orçamento total (para converter % em R$). Quando 0/ausente,
 *                 é recalculado como a soma dos `amount` dos itens.
 * @param labels   mapa opcional para rótulos amigáveis (pillarKey/channelId -> nome).
 */
export function checkGuardrails(
  items: AllocationItem[],
  config: GuardrailConfig,
  totalBudget?: number,
  labels: Record<string, string> = {}
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  const total =
    Number.isFinite(totalBudget) && (totalBudget as number) > 0
      ? (totalBudget as number)
      : round2(items.reduce((acc, i) => acc + (i.amount ?? 0), 0));
  if (total <= 0) return violations;

  const pct = (amount: number) => round2((amount / total) * 100);

  // Agrega por pilar e por canal.
  const amountByPillar = new Map<string, number>();
  for (const item of items) {
    if (!item.pillarKey) continue;
    amountByPillar.set(
      item.pillarKey,
      round2((amountByPillar.get(item.pillarKey) ?? 0) + item.amount)
    );
  }

  // AC1/AC3: concentração MÁXIMA por pilar.
  const maxPillar = sanitizePct(config.maxPillarConcentrationPct);
  if (maxPillar !== null) {
    for (const [key, amount] of amountByPillar) {
      const actual = pct(amount);
      if (actual > maxPillar + 1e-9) {
        const label = labels[key] ?? key;
        violations.push({
          type: "pillar_concentration",
          entityKey: key,
          entityLabel: label,
          limit: maxPillar,
          actual,
          unit: "pct",
          message: `O pilar "${label}" concentra ${actual.toFixed(
            1
          )}% do orçamento, acima do máximo de ${maxPillar}%.`,
        });
      }
    }
  }

  // AC1/AC3: mínimo por pilar (subutilização).
  const minPillar = sanitizePct(config.minPillarPct);
  if (minPillar !== null && minPillar > 0) {
    for (const [key, amount] of amountByPillar) {
      const actual = pct(amount);
      if (actual < minPillar - 1e-9) {
        const label = labels[key] ?? key;
        violations.push({
          type: "pillar_minimum",
          entityKey: key,
          entityLabel: label,
          limit: minPillar,
          actual,
          unit: "pct",
          message: `O pilar "${label}" recebe ${actual.toFixed(
            1
          )}% do orçamento, abaixo do mínimo de ${minPillar}%.`,
        });
      }
    }
  }

  // AC1/AC3: concentração MÁXIMA por canal.
  const maxChannel = sanitizePct(config.maxChannelConcentrationPct);
  if (maxChannel !== null) {
    for (const item of items) {
      const actual = pct(item.amount);
      if (actual > maxChannel + 1e-9) {
        const label = labels[item.channelId] ?? item.channelId;
        violations.push({
          type: "channel_concentration",
          entityKey: item.channelId,
          entityLabel: label,
          limit: maxChannel,
          actual,
          unit: "pct",
          message: `O canal "${label}" concentra ${actual.toFixed(
            1
          )}% do orçamento, acima do máximo de ${maxChannel}%.`,
        });
      }
    }
  }

  // AC1/AC3: downside total da carteira (R$ e/ou % do orçamento).
  const totalDownside = portfolioDownside(items);
  const maxDownAmount = sanitizeAmount(config.maxDownsideAmount);
  if (maxDownAmount !== null && totalDownside > maxDownAmount + AMOUNT_TOLERANCE) {
    violations.push({
      type: "downside_total",
      entityKey: "portfolio",
      entityLabel: "Carteira",
      limit: round2(maxDownAmount),
      actual: totalDownside,
      unit: "brl",
      message: `O downside total da carteira (R$${totalDownside.toFixed(
        2
      )}) excede o limite de R$${round2(maxDownAmount).toFixed(2)}.`,
    });
  }
  const maxDownPct = sanitizePct(config.maxDownsidePct);
  if (maxDownPct !== null) {
    const downsidePct = pct(totalDownside);
    if (downsidePct > maxDownPct + 1e-9) {
      violations.push({
        type: "downside_total",
        entityKey: "portfolio",
        entityLabel: "Carteira",
        limit: maxDownPct,
        actual: downsidePct,
        unit: "pct",
        message: `O downside total da carteira (${downsidePct.toFixed(
          1
        )}% do orçamento) excede o limite de ${maxDownPct}%.`,
      });
    }
  }

  return violations;
}

/**
 * Sanitiza uma `GuardrailConfig` vinda do client/persistência: descarta campos
 * fora de faixa (No Invention — Article IV) e retorna apenas as regras ativas.
 * Retorna `null` quando nenhuma regra é válida (config efetivamente vazia).
 */
export function sanitizeGuardrailConfig(
  config: GuardrailConfig | null | undefined
): GuardrailConfig | null {
  if (!config) return null;
  const out: GuardrailConfig = {};
  const mp = sanitizePct(config.maxPillarConcentrationPct);
  const mc = sanitizePct(config.maxChannelConcentrationPct);
  const mn = sanitizePct(config.minPillarPct);
  const da = sanitizeAmount(config.maxDownsideAmount);
  const dp = sanitizePct(config.maxDownsidePct);
  if (mp !== null) out.maxPillarConcentrationPct = mp;
  if (mc !== null) out.maxChannelConcentrationPct = mc;
  if (mn !== null && mn > 0) out.minPillarPct = mn;
  if (da !== null) out.maxDownsideAmount = da;
  if (dp !== null) out.maxDownsidePct = dp;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Valida que os ratios das três faixas somam 100% (AC2). Lança `AllocationError`
 * descritivo caso contrário. Ratios negativos ou não-finitos são rejeitados.
 */
export function validateRatios(ratios: RiskBandRatios): void {
  const bands: RiskBand[] = ["core", "growth", "experiment"];
  for (const band of bands) {
    const v = ratios[band];
    if (!Number.isFinite(v) || v < 0) {
      throw new AllocationError(
        `Ratio inválido para a faixa "${band}": ${String(v)}. Use percentuais >= 0.`
      );
    }
  }
  const sum = ratios.core + ratios.growth + ratios.experiment;
  if (Math.abs(sum - 100) > RATIO_SUM_TOLERANCE) {
    throw new AllocationError(
      `A soma dos ratios deve ser 100% (núcleo + crescimento + experimento). Recebido: ${round2(
        sum
      )}%.`
    );
  }
}

/**
 * Teto efetivo (em R$) de um canal, dado o orçamento total (Story 5.4 AC3).
 * Retorna `null` quando o canal não tem teto configurado (sem limite).
 * `ceilingPct` é validado a 0..100; valores fora da faixa são ignorados (sem teto)
 * para não inventar limites — exceto 0, que é um teto legítimo de exclusão (AC6).
 */
function ceilingAmountFor(channel: AllocationChannelInput, totalBudget: number): number | null {
  const pct = channel.ceilingPct;
  if (pct === undefined || pct === null) return null;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return round2(totalBudget * (pct / 100));
}

/** Distribui um valor proporcionalmente a pesos, com resíduo no último item. */
function weightedSplit(
  channelIds: string[],
  weights: number[],
  amount: number
): Map<string, number> {
  const out = new Map<string, number>();
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let allocated = 0;
  channelIds.forEach((id, i) => {
    const isLast = i === channelIds.length - 1;
    const w = weightSum > 0 ? weights[i] / weightSum : 1 / channelIds.length;
    const raw = isLast ? round2(amount - allocated) : round2(amount * w);
    allocated = round2(allocated + raw);
    out.set(id, raw);
  });
  return out;
}

/**
 * Distribui o valor de UMA faixa entre seus canais (AC4) e devolve os itens com
 * `amount` em centavos consistentes: a soma dos `amount` da faixa é exatamente
 * igual a `bandAmount` (resíduo de arredondamento absorvido no último item).
 *
 * - Proporcional ao `match_score` quando há ao menos um score positivo.
 * - Igualitária caso contrário.
 *
 * Guardrail de teto (Story 5.4): canais com `ceilingPct === 0` são previamente
 * EXCLUÍDOS (AC6). Para os demais, após a distribuição base, qualquer `amount`
 * acima do teto (`totalBudget * ceilingPct / 100`, AC3) é cortado no teto e o
 * EXCEDENTE é redistribuído proporcionalmente entre os canais da MESMA faixa que
 * ainda têm folga (AC4). O processo é iterativo (até `MAX_REDISTRIBUTION_ITERATIONS`,
 * Dev Note 5.4) para convergir; se nenhum canal tem folga, o excedente fica retido
 * (a soma da faixa pode ficar abaixo de `bandAmount`, e a consistência total é
 * reavaliada pelo chamador — ver `allocateBudgetPure`).
 */
function distributeBand(
  channels: AllocationChannelInput[],
  band: RiskBand,
  bandAmount: number,
  totalBudget: number
): AllocationItem[] {
  // AC6: teto 0% exclui o canal da alocação.
  const active = channels.filter((c) => c.ceilingPct !== 0);
  if (active.length === 0) return [];

  const ceilingByChannel = new Map<string, number | null>();
  for (const c of active) {
    ceilingByChannel.set(c.channelId, ceilingAmountFor(c, totalBudget));
  }

  // Distribuição base (proporcional ao match_score, ou igualitária).
  const positiveScores = active.map((c) =>
    Number.isFinite(c.matchScore ?? NaN) && (c.matchScore as number) > 0
      ? (c.matchScore as number)
      : 0
  );
  const scoreSum = positiveScores.reduce((a, b) => a + b, 0);
  const baseWeights = scoreSum > 0 ? positiveScores : active.map(() => 1);

  const ids = active.map((c) => c.channelId);
  const amounts = weightedSplit(ids, baseWeights, bandAmount);

  // Redistribuição iterativa do excedente acima do teto (AC4).
  for (let iter = 0; iter < MAX_REDISTRIBUTION_ITERATIONS; iter++) {
    let excess = 0;
    for (const id of ids) {
      const ceiling = ceilingByChannel.get(id) ?? null;
      const current = amounts.get(id) ?? 0;
      if (ceiling !== null && current > ceiling) {
        excess = round2(excess + (current - ceiling));
        amounts.set(id, ceiling);
      }
    }

    if (excess <= AMOUNT_TOLERANCE) break;

    // Canais com folga (sem teto, ou abaixo do teto) recebem o excedente.
    const receivers = ids.filter((id) => {
      const ceiling = ceilingByChannel.get(id) ?? null;
      const current = amounts.get(id) ?? 0;
      return ceiling === null || current < ceiling - AMOUNT_TOLERANCE;
    });
    if (receivers.length === 0) break; // ninguém pode receber — excedente retido.

    // Peso da redistribuição = match_score (ou igual) entre os receivers.
    const idxById = new Map(ids.map((id, i) => [id, i]));
    const receiverWeights = receivers.map((id) =>
      scoreSum > 0 ? positiveScores[idxById.get(id)!] : 1
    );
    const share = weightedSplit(receivers, receiverWeights, excess);
    for (const id of receivers) {
      amounts.set(id, round2((amounts.get(id) ?? 0) + (share.get(id) ?? 0)));
    }
  }

  return active.map((channel) => {
    const amount = amounts.get(channel.channelId) ?? 0;
    const ceiling = ceilingByChannel.get(channel.channelId) ?? null;
    const percentage = totalBudget > 0 ? round2((amount / totalBudget) * 100) : 0;
    return {
      channelId: channel.channelId,
      amount,
      percentage,
      riskBand: band,
      ceilingAmount: ceiling,
      ceilingReached: ceiling !== null && amount >= ceiling - AMOUNT_TOLERANCE,
      pillarKey: channel.pillarKey ?? null,
      // Story 6.2 (AC1): perda máxima estimada a partir do amount e do risk_score.
      // Recalculada em allocateBudgetPure após o guardrail de mínimo entre pilares,
      // que pode mover verba entre canais (Story 5.5).
      downsideEstimate: calcDownside(amount, channel.riskScore),
    };
  });
}

/**
 * Calcula a distribuição 70/20/10 (parametrizável) de `totalBudget` entre os
 * canais informados (AC1–AC4, AC6).
 *
 * Erros descritivos (AC7): lança `AllocationError` quando os ratios não somam
 * 100% ou quando uma faixa COM ratio > 0 não possui nenhum canal classificado.
 *
 * @param totalBudget orçamento total a distribuir (>= 0).
 * @param channels    canais candidatos (com `riskScore` e `matchScore` opcional).
 * @param ratios      distribuição por faixa; default 70/20/10.
 */
export function allocateBudgetPure(
  totalBudget: number,
  channels: AllocationChannelInput[],
  ratios: RiskBandRatios = DEFAULT_RATIOS,
  pillarMinimums: PillarMinimums = {}
): AllocationResult {
  if (!Number.isFinite(totalBudget) || totalBudget < 0) {
    throw new AllocationError(
      `Orçamento total inválido: ${String(totalBudget)}. Use um valor >= 0.`
    );
  }

  validateRatios(ratios);

  // Agrupa os canais por faixa de risco (AC3).
  const byBand: Record<RiskBand, AllocationChannelInput[]> = {
    core: [],
    growth: [],
    experiment: [],
  };
  for (const channel of channels) {
    byBand[classifyRiskBand(channel.riskScore)].push(channel);
  }

  const bands: RiskBand[] = ["core", "growth", "experiment"];
  const items: AllocationItem[] = [];

  for (const band of bands) {
    const ratio = ratios[band];
    if (ratio <= 0) continue; // faixa zerada por parametrização: ignorada.

    // Canais efetivos da faixa após excluir teto 0% (Story 5.4 AC6).
    const activeInBand = byBand[band].filter((c) => c.ceilingPct !== 0);

    // AC7: faixa com verba mas sem canais (ou todos excluídos por teto 0%) => erro.
    if (activeInBand.length === 0) {
      throw new AllocationError(
        `Não há canais suficientes na faixa "${band}" (ratio ${round2(
          ratio
        )}%). Reveja a recomendação, ajuste os ratios ou os tetos por canal.`
      );
    }

    const bandAmount = round2(totalBudget * (ratio / 100));
    items.push(...distributeBand(byBand[band], band, bandAmount, totalBudget));
  }

  // Guardrail de mínimo entre pilares (Story 5.5 — AC2, AC3, AC4).
  const ceilingByChannel = new Map<string, number | null>();
  for (const c of channels) {
    ceilingByChannel.set(c.channelId, ceilingAmountFor(c, round2(totalBudget)));
  }
  const pillarWarnings = enforcePillarMinimums(
    items,
    round2(totalBudget),
    pillarMinimums,
    ceilingByChannel
  );

  // Story 6.2 (AC1): recalcula o downside a partir dos `amount` FINAIS (o guardrail
  // de mínimo entre pilares pode ter movido verba entre canais). risk_score vem da
  // entrada; canais sem entrada correspondente mantêm o downside já calculado.
  const riskByChannel = new Map<string, number>();
  for (const c of channels) riskByChannel.set(c.channelId, c.riskScore);
  for (const item of items) {
    const risk = riskByChannel.get(item.channelId);
    if (risk !== undefined) {
      item.downsideEstimate = calcDownside(item.amount, risk);
    }
  }

  return { totalBudget: round2(totalBudget), ratios, items, pillarWarnings };
}

/**
 * Aplica o guardrail de MÍNIMO ENTRE PILARES (Story 5.5) sobre os itens já
 * distribuídos por faixa/teto. Muta `items` in-place e devolve os avisos (AC4).
 *
 * Algoritmo (AC2, AC3):
 *   1. Soma a verba por pilar (`pillarKey`) e identifica pilares ABAIXO do mínimo
 *      (`totalBudget * minPct / 100`).
 *   2. Para cada pilar deficitário, move verba dos pilares que estão ACIMA do seu
 *      próprio mínimo (doadores), reduzindo seus canais com folga e creditando os
 *      canais do pilar deficitário que ainda têm folga até o teto (Story 5.4 AC3).
 *   3. Repete até convergir (`MAX_PILLAR_MIN_ITERATIONS`).
 *
 * Inviabilidade (AC4): se, após as iterações, algum pilar continua abaixo do mínimo
 * (orçamento insuficiente, ou sem canais com folga para receber), gera um
 * `PillarMinimumWarning` em vez de violar tetos — o teto (5.4) e o mínimo (5.5)
 * são guardrails de prioridade equivalente; quando conflitam, o teto prevalece e o
 * usuário é avisado.
 *
 * Mínimos <= 0 ou de pilares sem canais são ignorados (AC5 — desativado/opcional).
 */
function enforcePillarMinimums(
  items: AllocationItem[],
  totalBudget: number,
  pillarMinimums: PillarMinimums,
  ceilingByChannel: Map<string, number | null>
): PillarMinimumWarning[] {
  // Pilares presentes nos itens (apenas com canais alocados participam).
  const pillarKeys = new Set<string>();
  for (const item of items) {
    if (item.pillarKey) pillarKeys.add(item.pillarKey);
  }

  // Mínimos efetivos (em R$) por pilar — só os ativos (> 0) e com canais.
  const requiredByPillar = new Map<string, number>();
  for (const key of pillarKeys) {
    const pct = pillarMinimums[key];
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
      requiredByPillar.set(key, round2(totalBudget * (pct / 100)));
    }
  }
  if (requiredByPillar.size === 0) return [];

  const amountByPillar = () => {
    const m = new Map<string, number>();
    for (const item of items) {
      if (!item.pillarKey) continue;
      m.set(item.pillarKey, round2((m.get(item.pillarKey) ?? 0) + item.amount));
    }
    return m;
  };

  /** Folga (R$) que um item pode receber antes de bater no seu teto (5.4). */
  const headroom = (item: AllocationItem): number => {
    const ceiling = ceilingByChannel.get(item.channelId) ?? null;
    if (ceiling === null) return Number.POSITIVE_INFINITY;
    return round2(Math.max(0, ceiling - item.amount));
  };

  for (let iter = 0; iter < MAX_PILLAR_MIN_ITERATIONS; iter++) {
    const current = amountByPillar();

    // Pilar mais deficitário primeiro (maior gap), para estabilidade.
    let target: { key: string; gap: number } | null = null;
    for (const [key, required] of requiredByPillar) {
      const gap = round2(required - (current.get(key) ?? 0));
      if (gap > AMOUNT_TOLERANCE && (!target || gap > target.gap)) {
        target = { key, gap };
      }
    }
    if (!target) break; // todos os mínimos atendidos.

    // Doadores: itens de OUTROS pilares cuja retirada não derruba o doador abaixo
    // do próprio mínimo. Calcula a folga doável agregada por pilar doador.
    let moved = 0;
    const receivers = items
      .filter((i) => i.pillarKey === target!.key && headroom(i) > AMOUNT_TOLERANCE)
      .sort((a, b) => headroom(b) - headroom(a));

    if (receivers.length === 0) break; // ninguém pode receber — inviável (AC4).

    for (const donorPillar of pillarKeys) {
      if (donorPillar === target.key) break;
      if (target.gap - moved <= AMOUNT_TOLERANCE) break;

      const donorRequired = requiredByPillar.get(donorPillar) ?? 0;
      const donorAmount = current.get(donorPillar) ?? 0;
      // Excedente que o doador pode ceder sem violar o próprio mínimo.
      let donorSurplus = round2(Math.max(0, donorAmount - donorRequired));
      if (donorSurplus <= AMOUNT_TOLERANCE) continue;

      const donorItems = items
        .filter((i) => i.pillarKey === donorPillar && i.amount > AMOUNT_TOLERANCE)
        .sort((a, b) => b.amount - a.amount);

      for (const donor of donorItems) {
        if (target.gap - moved <= AMOUNT_TOLERANCE) break;
        if (donorSurplus <= AMOUNT_TOLERANCE) break;

        // Quanto este item pode ceder, limitado pelo excedente do pilar doador.
        let take = Math.min(donor.amount, donorSurplus, target.gap - moved);
        take = round2(take);
        if (take <= AMOUNT_TOLERANCE) continue;

        // Credita os receivers respeitando a folga até o teto (5.4 AC3).
        for (const receiver of receivers) {
          if (take <= AMOUNT_TOLERANCE) break;
          const room = headroom(receiver);
          const credit = round2(Math.min(take, room));
          if (credit <= AMOUNT_TOLERANCE) continue;
          receiver.amount = round2(receiver.amount + credit);
          donor.amount = round2(donor.amount - credit);
          donorSurplus = round2(donorSurplus - credit);
          moved = round2(moved + credit);
          take = round2(take - credit);
        }
      }
    }

    if (moved <= AMOUNT_TOLERANCE) break; // nenhum doador disponível — inviável (AC4).
  }

  // Recalcula percentuais, ceilingReached e coleta avisos de mínimo não atingido.
  for (const item of items) {
    item.percentage = totalBudget > 0 ? round2((item.amount / totalBudget) * 100) : 0;
    const ceiling = ceilingByChannel.get(item.channelId) ?? null;
    item.ceilingReached = ceiling !== null && item.amount >= ceiling - AMOUNT_TOLERANCE;
  }

  const finalByPillar = amountByPillar();
  const warnings: PillarMinimumWarning[] = [];
  for (const [key, required] of requiredByPillar) {
    const allocated = finalByPillar.get(key) ?? 0;
    if (required - allocated > AMOUNT_TOLERANCE) {
      const minPct = pillarMinimums[key];
      warnings.push({
        pillarKey: key,
        requiredAmount: required,
        allocatedAmount: allocated,
        minPct,
      });
    }
  }
  return warnings;
}

/**
 * Verifica a invariante de consistência (5.2 AC6): a soma dos `amount` dos itens é
 * igual ao orçamento total dentro da tolerância de ±R$0,01.
 *
 * Guardrail de teto (Story 5.4): quando algum canal está com `ceilingReached`, a
 * soma pode ficar ABAIXO do total — o excedente que não coube em nenhum canal com
 * folga fica legitimamente não alocado (o teto, AC3, prevalece sobre a igualdade).
 * Nesse caso, exige-se apenas que a soma NÃO ULTRAPASSE o total (over-allocation
 * continua sendo erro). Sem tetos atingidos, mantém-se a igualdade exata.
 */
export function assertBudgetConsistency(result: AllocationResult): void {
  const sum = result.items.reduce((acc, item) => round2(acc + item.amount), 0);
  const hasCappedChannel = result.items.some((item) => item.ceilingReached);

  if (sum - result.totalBudget > AMOUNT_TOLERANCE) {
    throw new AllocationError(
      `Inconsistência de alocação: soma dos itens (R$${round2(
        sum
      )}) excede o orçamento total (R$${round2(result.totalBudget)}).`
    );
  }

  if (!hasCappedChannel && Math.abs(sum - result.totalBudget) > AMOUNT_TOLERANCE) {
    throw new AllocationError(
      `Inconsistência de alocação: soma dos itens (R$${round2(
        sum
      )}) difere do orçamento total (R$${round2(result.totalBudget)}).`
    );
  }
}
