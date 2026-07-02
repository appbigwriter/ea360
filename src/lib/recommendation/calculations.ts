/**
 * Cálculos financeiros de recomendação de canais (Story 4.3).
 *
 * Funções PURAS (sem SDK/IO/segredos) que derivam as métricas financeiras de
 * cada canal recomendado a partir do orçamento declarado no perfil de
 * monetização e dos scores do canal no GOM (Story 2.1):
 *   - `estimated_spend`   — gasto estimado para ativar o canal.
 *   - `return_range_min`  — piso da faixa de retorno estimada.
 *   - `return_range_max`  — teto da faixa de retorno estimada.
 *   - `payback_months`    — tempo estimado de retorno, em meses.
 *   - `risk_score`        — nota de risco (repassada direto do GOM).
 *
 * Implementadas como utilitário TypeScript (AC6) — e NÃO como SQL puro — para
 * facilitar calibração futura das fórmulas sem migração de banco. A geração de
 * recomendação (Story 4.4) chama estas funções e persiste o resultado em
 * `recommendation_items` (Story 4.1).
 *
 * FÓRMULAS MVP (simples e ajustáveis — PRD R3; ver Dev Notes da Story 4.3):
 *   estimated_spend = budget * (cost_score / 5)
 *   payback_months  = (6 - payback_score) * 3      // score 5 => 3 meses (rápido)
 *   return_range    = [estimated_spend * 0.5, estimated_spend * 3]
 *   risk_score      = risk_score do canal (1..5)   // repasse direto
 *
 * Todos os valores numéricos são arredondados para no máximo 2 casas (AC7).
 */

/** Limites canônicos dos scores 1..5 do GOM (Story 2.1). */
const SCORE_MIN = 1;
const SCORE_MAX = 5;

/** Multiplicadores MVP da faixa de retorno sobre o gasto estimado. */
const RETURN_MULTIPLIER_MIN = 0.5;
const RETURN_MULTIPLIER_MAX = 3;

/** Inputs do canal (subset relevante de `gom_channels`, todos 1..5). */
export type ChannelScoreInput = {
  /** 5 = exige mais caixa (`gom_channels.cost_score`). */
  cost_score: number;
  /** 5 = retorno mais rápido (`gom_channels.payback_score`). */
  payback_score: number;
  /** 5 = mais arriscado (`gom_channels.risk_score`). */
  risk_score: number;
};

/** Métricas financeiras calculadas para um item de recomendação (AC1). */
export type ChannelFinancials = {
  estimated_spend: number;
  return_range_min: number;
  return_range_max: number;
  payback_months: number;
  risk_score: number;
};

/**
 * Arredonda para no máximo 2 casas decimais (AC7).
 * Valores não-finitos (NaN/Infinity) caem para 0 para nunca persistir lixo.
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Garante orçamento numérico não-negativo (entrada do usuário é tolerada). */
function sanitizeBudget(budget: number): number {
  if (!Number.isFinite(budget) || budget < 0) return 0;
  return budget;
}

/** Clampa um score no intervalo 1..5 do GOM (defensivo). */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return SCORE_MIN;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/**
 * Gasto estimado proporcional ao `cost_score` do canal e ao orçamento do perfil
 * (AC2). Canal de custo máximo (5) consome o orçamento inteiro; custo 1 consome
 * 20%. Ex.: budget=10000, cost_score=5 => 10000.
 */
export function calcEstimatedSpend(budget: number, costScore: number): number {
  const safeBudget = sanitizeBudget(budget);
  const safeCost = clampScore(costScore);
  return round2(safeBudget * (safeCost / SCORE_MAX));
}

/**
 * Tempo estimado de retorno em meses, derivado do `payback_score` (AC4).
 * Score 5 (retorno rápido) => 3 meses; score 1 (longo prazo) => 15 meses.
 */
export function calcPaybackMonths(paybackScore: number): number {
  const safeScore = clampScore(paybackScore);
  return round2((6 - safeScore) * 3);
}

/**
 * Faixa de retorno estimada [min, max] sobre o gasto estimado (AC3).
 * MVP: piso = 0.5x do gasto, teto = 3x. Baseada no gasto (que já incorpora o
 * orçamento do perfil e o custo do canal). O `paybackScore` é aceito para
 * permitir calibração futura por velocidade de retorno sem mudar a assinatura.
 */
export function calcReturnRange(
  estimatedSpend: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _paybackScore?: number
): { min: number; max: number } {
  const safeSpend = Number.isFinite(estimatedSpend) && estimatedSpend > 0 ? estimatedSpend : 0;
  return {
    min: round2(safeSpend * RETURN_MULTIPLIER_MIN),
    max: round2(safeSpend * RETURN_MULTIPLIER_MAX),
  };
}

/**
 * Nota de risco do item de recomendação (AC5): repasse direto do `risk_score`
 * do canal no GOM, clampado em 1..5 e arredondado.
 */
export function calcRiskScore(channelRiskScore: number): number {
  return round2(clampScore(channelRiskScore));
}

/**
 * Calcula todas as métricas financeiras de um canal recomendado (AC1).
 * Orquestra as funções acima a partir do orçamento do perfil e dos scores do
 * canal. Retorno pronto para persistir em `recommendation_items`.
 */
export function calcChannelFinancials(
  budget: number,
  channel: ChannelScoreInput
): ChannelFinancials {
  const estimated_spend = calcEstimatedSpend(budget, channel.cost_score);
  const { min, max } = calcReturnRange(estimated_spend, channel.payback_score);
  return {
    estimated_spend,
    return_range_min: min,
    return_range_max: max,
    payback_months: calcPaybackMonths(channel.payback_score),
    risk_score: calcRiskScore(channel.risk_score),
  };
}
