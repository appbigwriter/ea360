/**
 * Faról de risco do menu (Story 4.5, AC2).
 *
 * Mapeia o `risk_score` (1..5) de um canal recomendado em uma das três cores do
 * faról, conforme a regra do AC2:
 *   - 1..2 => verde  (baixo risco)
 *   - 3    => amarelo (risco moderado)
 *   - 4..5 => vermelho (alto risco)
 *
 * Função PURA (sem IO/segredos) para ser facilmente testável e reusada na lista
 * e na página de detalhe.
 */

export type FarolLevel = "green" | "yellow" | "red";

export type FarolInfo = {
  level: FarolLevel;
  label: string;
  /** Cor do "ponto" do faról (Tailwind bg-*). */
  dotClass: string;
  /** Cor do texto associado (Tailwind text-*, Dev Note). */
  textClass: string;
};

const FAROIS: Record<FarolLevel, FarolInfo> = {
  green: {
    level: "green",
    label: "Risco baixo",
    dotClass: "bg-green-600",
    textClass: "text-green-600",
  },
  yellow: {
    level: "yellow",
    label: "Risco moderado",
    dotClass: "bg-yellow-500",
    textClass: "text-yellow-500",
  },
  red: {
    level: "red",
    label: "Risco alto",
    dotClass: "bg-red-600",
    textClass: "text-red-600",
  },
};

/** Resolve o faról a partir do `risk_score` (1..5), clampando defensivamente. */
export function riskFarol(riskScore: number): FarolInfo {
  const score = Number.isFinite(riskScore) ? riskScore : 3;
  if (score <= 2) return FAROIS.green;
  if (score === 3) return FAROIS.yellow;
  return FAROIS.red;
}
