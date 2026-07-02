/**
 * Farol de risco da carteira (Story 6.4 — AC1 a AC5).
 *
 * Distinto do farol do MENU (Story 4.5, `components/menu/risk-farol.ts`), que mapeia
 * APENAS o `risk_score` do canal recomendado. Este farol é da CARTEIRA e combina três
 * sinais por canal (AC1): concentração do canal, `risk_score` e violações de guardrail.
 *
 * Regras (AC2–AC4), "pior nível prevalece" (red > yellow > green):
 *   - Verde  : sem violações, concentração < 40%, risk_score <= 2.                       (AC2)
 *   - Amarelo: violação de guardrail de aviso, OU concentração 40–60%, OU risk_score = 3. (AC3)
 *   - Vermelho: violação de guardrail CRÍTICA, OU concentração > 60%, OU risk_score >= 4. (AC4)
 *
 * Uma violação é CRÍTICA quando a brecha é grave (actual >= 1.5x o limite); caso
 * contrário é de AVISO. Operacionalização de "violação crítica vs. de aviso" (AC3/AC4)
 * — não inventa recurso, apenas classifica severidade da brecha (Article IV).
 *
 * Funções PURAS (sem IO/segredos) para teste e reuso fácil.
 */
import type { GuardrailViolation } from "@/lib/allocation/engine";

export type FlagLevel = "green" | "yellow" | "red";

/** Dados de um canal para cálculo do farol (AC1). */
export type ChannelFlagInput = {
  channelId: string;
  /** Concentração do canal em % do orçamento TOTAL (0..100). */
  concentrationPct: number;
  /** Nota de risco do GOM (1..5). */
  riskScore: number;
  /** Violações de guardrail que afetam este canal (entityKey === channelId). */
  violations: GuardrailViolation[];
};

/** Resultado do farol de um canal (AC6 — persistível em `risk_flags`). */
export type ChannelFlag = {
  channelId: string;
  level: FlagLevel;
  /** Razões legíveis (AC: "Concentração de 65% ... excede o limite de 60%"). */
  reasons: string[];
};

/** Limiar de brecha grave: violação com actual >= 1.5x o limite => crítica (red). */
const CRITICAL_BREACH_RATIO = 1.5;

const RANK: Record<FlagLevel, number> = { green: 1, yellow: 2, red: 3 };
const LEVEL_BY_RANK: Record<number, FlagLevel> = { 1: "green", 2: "yellow", 3: "red" };

/** Combina dois níveis pelo pior (AC: "vermelho > amarelo > verde"). */
export function worstLevel(a: FlagLevel, b: FlagLevel): FlagLevel {
  return RANK[a] >= RANK[b] ? a : b;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(0) : "?";
}

/** `true` quando a violação é uma brecha grave (crítica => vermelho, AC4). */
export function isCriticalViolation(v: GuardrailViolation): boolean {
  if (!Number.isFinite(v.limit) || v.limit <= 0) return false;
  return v.actual >= v.limit * CRITICAL_BREACH_RATIO;
}

/**
 * Calcula o farol de UM canal (AC1–AC4). "Pior nível prevalece": concentração,
 * risk_score e violações combinam pelo nível mais grave observado.
 */
export function calculateChannelFlag(input: ChannelFlagInput): ChannelFlag {
  const reasons: string[] = [];
  let rank = RANK.green;
  const conc = input.concentrationPct;
  const risk = input.riskScore;

  // Concentração do canal (AC2/AC3/AC4).
  if (Number.isFinite(conc) && conc > 60) {
    rank = Math.max(rank, RANK.red);
    reasons.push(`Concentração de ${fmt(conc)}% no canal excede o limite de 60%.`);
  } else if (Number.isFinite(conc) && conc >= 40) {
    rank = Math.max(rank, RANK.yellow);
    reasons.push(`Concentração de ${fmt(conc)}% no canal (faixa de atenção 40–60%).`);
  }

  // Risk_score do GOM (AC2/AC3/AC4).
  if (Number.isFinite(risk) && risk >= 4) {
    rank = Math.max(rank, RANK.red);
    reasons.push(`Risk score ${fmt(risk)} (risco alto).`);
  } else if (Number.isFinite(risk) && risk === 3) {
    rank = Math.max(rank, RANK.yellow);
    reasons.push(`Risk score 3 (risco moderado).`);
  }

  // Violações de guardrail do canal (AC3 aviso / AC4 crítica).
  for (const v of input.violations) {
    if (isCriticalViolation(v)) {
      rank = Math.max(rank, RANK.red);
    } else {
      rank = Math.max(rank, RANK.yellow);
    }
    reasons.push(v.message);
  }

  return { channelId: input.channelId, level: LEVEL_BY_RANK[rank], reasons };
}

/**
 * Farol da CARTEIRA (AC5): reflete o nível mais alto de qualquer canal; violações de
 * guardrail de escopo da carteira (downside total, concentração de pilar) também
 * elevam o nível (não ficam ocultas quando nenhum canal isolado está vermelho).
 */
export function portfolioFlag(
  channelFlags: ChannelFlag[],
  portfolioViolations: GuardrailViolation[] = []
): { level: FlagLevel; reasons: string[] } {
  let rank = RANK.green;
  const reasons: string[] = [];

  // AC5: nível mais alto entre os canais.
  for (const cf of channelFlags) {
    if (RANK[cf.level] > rank) rank = RANK[cf.level];
  }
  if (channelFlags.some((cf) => cf.level === "red")) {
    reasons.push("Pelo menos um canal da carteira está em risco alto (vermelho).");
  } else if (channelFlags.some((cf) => cf.level === "yellow")) {
    reasons.push("Pelo menos um canal da carteira está em atenção (amarelo).");
  }

  // Violações de carteira (downside total, pilar) — elevam o farol da carteira.
  for (const v of portfolioViolations) {
    rank = Math.max(rank, isCriticalViolation(v) ? RANK.red : RANK.yellow);
    reasons.push(v.message);
  }

  return { level: LEVEL_BY_RANK[rank], reasons };
}

/** Estilo visual (Tailwind) por nível — consumido pelo componente `RiskFlag`. */
export const FLAG_STYLE: Record<FlagLevel, { dot: string; text: string; label: string }> = {
  green: { dot: "bg-green-600", text: "text-green-600", label: "Risco baixo" },
  yellow: { dot: "bg-yellow-500", text: "text-yellow-600", label: "Atenção" },
  red: { dot: "bg-red-600", text: "text-red-600", label: "Risco alto" },
};
