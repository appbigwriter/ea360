/**
 * Loop de reavaliação que realimenta a Entrevista (Story 7.5 — R6).
 *
 * Detecta gatilhos que sugerem refazer a Entrevista 360 (AC1). Função PURA para
 * teste/reuso; a Server Action monta as entradas a partir do DB.
 *
 * Gatilhos (operacionalização de "situação mudou significativamente"):
 *   - >90 dias desde a última entrevista;
 *   - mudança de orçamento total >30% (em módulo);
 *   - 3+ canais com performance muito abaixo do projetado (real < 50% da projeção).
 */
export const REEVALUATION_THRESHOLDS = {
  STALE_DAYS: 90,
  BUDGET_CHANGE_PCT: 30,
  UNDERPERF_COUNT: 3,
  UNDERPERF_RATIO: 0.5,
} as const;

export type ReevaluationInput = {
  daysSinceLastInterview: number | null;
  /** Variação percentual do orçamento total vs. carteira anterior (em módulo). */
  budgetChangePct: number | null;
  /** Canais com performance real < 50% da projeção. */
  channelsBelowHalfProjected: number;
};

export type ReevaluationResult = {
  triggered: boolean;
  reasons: string[];
};

export function checkReevaluationTriggers(input: ReevaluationInput): ReevaluationResult {
  const reasons: string[] = [];

  if (
    input.daysSinceLastInterview !== null &&
    input.daysSinceLastInterview > REEVALUATION_THRESHOLDS.STALE_DAYS
  ) {
    reasons.push(
      `Sua última entrevista foi há ${Math.round(input.daysSinceLastInterview)} dias (mais de 90).`
    );
  }

  if (
    input.budgetChangePct !== null &&
    Math.abs(input.budgetChangePct) > REEVALUATION_THRESHOLDS.BUDGET_CHANGE_PCT
  ) {
    const sinal = input.budgetChangePct > 0 ? "+" : "";
    reasons.push(
      `Seu orçamento mudou ${sinal}${Math.round(input.budgetChangePct)}% (mais de 30%).`
    );
  }

  if (input.channelsBelowHalfProjected >= REEVALUATION_THRESHOLDS.UNDERPERF_COUNT) {
    reasons.push(
      `${input.channelsBelowHalfProjected} canais com desempenho abaixo de 50% do projetado.`
    );
  }

  return { triggered: reasons.length > 0, reasons };
}
