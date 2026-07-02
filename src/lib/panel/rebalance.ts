/**
 * Recomendação de rebalanceamento da carteira (Story 7.4 — R6 / F3.4).
 *
 * Compara o desempenho real (`channel_metrics`) vs. projeção da alocação e classifica
 * cada canal em: aumentar (acima da projeção), reduzir (>20% abaixo) ou encerrar
 * (kill-criteria atingido). Função PURA (sem IO/segredos) para teste e reuso; a
 * Server Action lê o DB, monta as entradas e persiste em `allocation_reviews`.
 *
 * LLM é OPCIONAL (AC6 — "pode usar ... tolerante a falha"): a justificativa usa
 * template determinístico; um hook futuro pode enriquecê-la via LLM sem quebrar.
 */
export type ChannelPerf = {
  channelId: string;
  name: string;
  projectedSpend: number;
  realSpend: number | null;
  realRoa: number | null;
  projectedRoa: number | null;
  /** Kill-criteria atingido (prazo expirado + meta não batida) → sugerir encerrar. */
  killHit: boolean;
};

export type RebalanceAction = {
  channelId: string;
  name: string;
  type: "increase" | "reduce" | "kill";
  reason: string;
  /** Ajuste sugerido em pontos percentuais sobre a alocação atual (+20, -30, -100). */
  suggestedDeltaPct: number;
};

export type RebalanceRecommendation = {
  increases: RebalanceAction[];
  reductions: RebalanceAction[];
  kills: RebalanceAction[];
  overallHealth: "on_track" | "off_track" | "critical";
  justification: string;
};

/** Limiares (AC2): acima de +20% => aumentar; abaixo de -20% => reduzir. */
const INCREASE_THRESHOLD = 1.2;
const REDUCE_THRESHOLD = 0.8;

/** Razão de performance: ROAS real/projetado quando disponível; senão gasto real/proj. */
function perfRatio(p: ChannelPerf): number | null {
  if (p.projectedRoa && p.realRoa && p.projectedRoa > 0) {
    return p.realRoa / p.projectedRoa;
  }
  if (p.projectedSpend > 0 && p.realSpend !== null) {
    return p.realSpend / p.projectedSpend;
  }
  return null;
}

/**
 * Gera a recomendação de rebalanceamento (AC1, AC2). Prioridade: kill > reduce >
 * increase (o mais grave prevalece por canal). AC6: justificativa template.
 */
export function buildRebalanceRecommendation(perfs: ChannelPerf[]): RebalanceRecommendation {
  const increases: RebalanceAction[] = [];
  const reductions: RebalanceAction[] = [];
  const kills: RebalanceAction[] = [];

  for (const p of perfs) {
    if (p.killHit) {
      kills.push({
        channelId: p.channelId,
        name: p.name,
        type: "kill",
        suggestedDeltaPct: -100,
        reason: `Kill-criteria atingido em "${p.name}" — sugerimos encerrar o canal.`,
      });
      continue;
    }
    const ratio = perfRatio(p);
    if (ratio === null) continue;
    if (ratio >= INCREASE_THRESHOLD) {
      increases.push({
        channelId: p.channelId,
        name: p.name,
        type: "increase",
        suggestedDeltaPct: 20,
        reason: `"${p.name}" está ${Math.round((ratio - 1) * 100)}% acima da projeção — considere aumentar a alocação.`,
      });
    } else if (ratio < REDUCE_THRESHOLD) {
      reductions.push({
        channelId: p.channelId,
        name: p.name,
        type: "reduce",
        suggestedDeltaPct: -30,
        reason: `"${p.name}" está ${Math.round((1 - ratio) * 100)}% abaixo da projeção — considere reduzir a alocação.`,
      });
    }
  }

  const overallHealth: RebalanceRecommendation["overallHealth"] =
    kills.length > 0 ? "critical" : reductions.length > 0 ? "off_track" : "on_track";

  const parts: string[] = [];
  if (kills.length)
    parts.push(`${kills.length} canal(is) sugerido(s) para encerrar (kill-criteria).`);
  if (reductions.length)
    parts.push(`${reductions.length} canal(is) abaixo da projeção sugeridos para redução.`);
  if (increases.length)
    parts.push(`${increases.length} canal(is) acima da projeção sugeridos para aumento.`);
  const justification =
    parts.length > 0
      ? `Saúde da carteira: ${overallHealth}. ${parts.join(" ")}`
      : `Saúde da carteira: ${overallHealth}. Nenhum ajuste recomendado — desempenho alinhado à projeção.`;

  return { increases, reductions, kills, overallHealth, justification };
}
