import type { MenuChannel } from "@/app/app/menu/queries";

/**
 * Critérios de ordenação do menu (Story 4.5, AC3).
 *
 * O usuário pode ordenar os cards por: score de match (padrão), custo estimado,
 * retorno estimado e payback. A ordenação acontece no CLIENT sobre o dataset já
 * carregado (pequeno — top N canais), sem novo round-trip ao servidor.
 */

export type SortCriterion = "match" | "cost" | "return" | "payback";

export const SORT_OPTIONS: { value: SortCriterion; label: string }[] = [
  { value: "match", label: "Match" },
  { value: "cost", label: "Custo estimado" },
  { value: "return", label: "Retorno estimado" },
  { value: "payback", label: "Payback" },
];

export const DEFAULT_SORT: SortCriterion = "match";

/**
 * Retorna uma NOVA lista ordenada pelo critério escolhido (não muta a original).
 *
 * Direções (mais relevante primeiro):
 *   - match:   maior `matchScore` primeiro (melhor adequação).
 *   - cost:    menor `estimatedSpend` primeiro (mais barato).
 *   - return:  maior `returnRangeMax` primeiro (maior potencial de retorno).
 *   - payback: menor `paybackMonths` primeiro (retorno mais rápido).
 *
 * Empates são resolvidos pelo `rankPosition` original para estabilidade.
 */
export function sortChannels(channels: MenuChannel[], criterion: SortCriterion): MenuChannel[] {
  const sorted = [...channels];
  const byRank = (a: MenuChannel, b: MenuChannel) => a.rankPosition - b.rankPosition;

  switch (criterion) {
    case "cost":
      return sorted.sort((a, b) => a.estimatedSpend - b.estimatedSpend || byRank(a, b));
    case "return":
      return sorted.sort((a, b) => b.returnRangeMax - a.returnRangeMax || byRank(a, b));
    case "payback":
      return sorted.sort((a, b) => a.paybackMonths - b.paybackMonths || byRank(a, b));
    case "match":
    default:
      return sorted.sort((a, b) => b.matchScore - a.matchScore || byRank(a, b));
  }
}
