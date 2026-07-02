/**
 * Helpers puros (sem dependências de SDK/IO) para a geração de perguntas
 * ramificadas da Entrevista 360 via LLM (Story 3.3).
 *
 * Mantido isolado da Server Action e do SDK Anthropic para ser testável e
 * client-safe na parte de tipos. NENHUM segredo é lido aqui (AC6).
 */

export const FOLLOW_UP_LAYERS = [
  {
    key: "objetivos",
    label: "Objetivos & Metas",
    goal: "entender as metas e o que o empreendedor quer alcançar.",
  },
  {
    key: "filosofia",
    label: "Filosofia & Valores",
    goal: "entender princípios, valores e o que o empreendedor recusa por convicção.",
  },
  {
    key: "momento",
    label: "Momento",
    goal: "entender o momento atual do negócio: caixa, margem, audiência e risco.",
  },
  {
    key: "recursos",
    label: "Recursos",
    goal: "entender a capacidade de execução: tempo, time e energia disponíveis.",
  },
] as const;

/** Item de contexto Q&A acumulado da entrevista (AC3). */
export type QAContextItem = {
  question: string;
  answer: string;
  layer?: string | null;
};

/** Pergunta de follow-up gerada e validada a partir da saída do LLM (AC1). */
export type GeneratedFollowUp = {
  question: string;
};

/** Limites de geração (AC1: 0–3 perguntas). */
export const MAX_FOLLOW_UPS = 3;

/** Resolve o objetivo textual da camada para enriquecer o prompt (AC3). */
function describeLayer(layerKey: string | null): string {
  const match = FOLLOW_UP_LAYERS.find((l) => l.key === layerKey);
  if (match) return `${match.label} — ${match.goal}`;
  return "Geral — aprofundar o contexto do negócio.";
}

/**
 * Constrói a instrução de sistema explicando as quatro camadas da entrevista
 * e o objetivo de cada fase (AC3, Dev Note: "incluir as quatro camadas como
 * contexto para o LLM saber o objetivo de cada fase").
 */
export function buildSystemPrompt(): string {
  const layers = FOLLOW_UP_LAYERS.map((l, i) => `${i + 1}. ${l.label}: ${l.goal}`).join("\n");

  return [
    'Você é um entrevistador de negócios conduzindo a "Entrevista 360", que mapeia',
    "um negócio em quatro camadas:",
    layers,
    "",
    "Seu trabalho é gerar perguntas de aprofundamento (follow-up) curtas e",
    "específicas, baseadas na resposta mais recente e no contexto acumulado.",
    `Gere de 0 a ${MAX_FOLLOW_UPS} perguntas. Gere 0 se a resposta já estiver`,
    "clara e completa o suficiente — não force perguntas.",
    "As perguntas devem ser abertas, em português do Brasil, sem numeração.",
    'Responda APENAS com um array JSON de strings. Exemplo: ["Pergunta 1?", "Pergunta 2?"].',
    "Não inclua nenhum texto fora do array JSON.",
  ].join("\n");
}

/**
 * Constrói a mensagem de usuário com a camada atual, perguntas anteriores e
 * respostas como contexto (AC3).
 */
export function buildUserPrompt(input: {
  currentLayer: string | null;
  history: QAContextItem[];
  latestQuestion: string;
  latestAnswer: string;
}): string {
  const { currentLayer, history, latestQuestion, latestAnswer } = input;

  const historyText =
    history.length > 0
      ? history
          .map((h, i) => `${i + 1}. P: ${h.question}\n   R: ${h.answer || "(sem resposta)"}`)
          .join("\n")
      : "(nenhuma resposta anterior)";

  return [
    `Camada atual da entrevista: ${describeLayer(currentLayer)}`,
    "",
    "Perguntas e respostas anteriores:",
    historyText,
    "",
    "Resposta mais recente a aprofundar:",
    `P: ${latestQuestion}`,
    `R: ${latestAnswer || "(sem resposta)"}`,
    "",
    `Gere de 0 a ${MAX_FOLLOW_UPS} perguntas de follow-up no formato JSON solicitado.`,
  ].join("\n");
}

/**
 * Faz o parse tolerante da saída do LLM, extraindo até MAX_FOLLOW_UPS perguntas.
 * Aceita um array JSON puro ou um bloco JSON embutido em texto. Em qualquer
 * formato inesperado, retorna [] sem lançar (AC4 — tolerância a falhas).
 */
export function parseFollowUps(raw: string | null | undefined): GeneratedFollowUp[] {
  if (!raw || typeof raw !== "string") return [];

  const candidate = extractJsonArray(raw);
  if (!candidate) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .slice(0, MAX_FOLLOW_UPS)
    .map((question) => ({ question }));
}

/** Isola o primeiro array JSON `[...]` presente no texto. */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
