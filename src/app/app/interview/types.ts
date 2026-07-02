/**
 * Tipos e constantes client-safe da Entrevista 360 (Story 3.2).
 *
 * Mantido separado de `queries.ts` (que importa o cliente Supabase de servidor
 * via `next/headers`) para poder ser importado com segurança por Client
 * Components sem arrastar dependências de servidor para o bundle do cliente.
 */

/**
 * Camadas da Entrevista 360. O seed de `interview_questions` grava `layer` como
 * texto (`objetivos`/`filosofia`/`momento`/`recursos`), que mapeia 1:1 para as
 * quatro camadas do PRD R1 (AC2, AC5).
 */
export const INTERVIEW_LAYERS = [
  { key: "objetivos", number: 1, label: "Objetivos & Metas" },
  { key: "filosofia", number: 2, label: "Filosofia & Valores" },
  { key: "momento", number: 3, label: "Momento" },
  { key: "recursos", number: 4, label: "Recursos" },
] as const;

export type InterviewLayer = (typeof INTERVIEW_LAYERS)[number];

export type InterviewQuestion = {
  id: string;
  slug: string;
  /** Número da camada (1..4) derivado do texto de `layer`. */
  layer: number;
  /** Rótulo legível da camada (ex.: "Filosofia & Valores"). */
  layerLabel: string;
  /** Texto da pergunta (coluna gerada `question_text` ⇐ `prompt`). */
  questionText: string;
  /** Tipo de entrada (coluna gerada `question_type` ⇐ `input_type`). */
  questionType: string;
  order: number;
};

/** Resolve o número da camada (1..4) a partir do texto de `layer` do seed. */
export function layerNumber(layerText: string | null): number {
  const match = INTERVIEW_LAYERS.find((l) => l.key === layerText);
  return match ? match.number : 1;
}

/** Resolve o rótulo legível da camada a partir do texto de `layer` do seed. */
export function layerLabel(layerText: string | null): string {
  const match = INTERVIEW_LAYERS.find((l) => l.key === layerText);
  return match ? match.label : "Geral";
}
