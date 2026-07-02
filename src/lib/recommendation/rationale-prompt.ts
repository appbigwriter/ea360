/**
 * Helpers puros (sem SDK/IO/segredos) para a geração da camada de rationale via
 * LLM — "porquê cabe" (fit) e "porquê evitar" (avoid) — de cada canal
 * recomendado (Story 4.4).
 *
 * Mantidos isolados da Server Action e do SDK Anthropic para serem testáveis e
 * client-safe na parte de tipos. NENHUM segredo é lido aqui (mesmo padrão de
 * `src/lib/interview/prompt.ts`, Story 3.3).
 *
 * O prompt enviado ao LLM inclui (AC3): perfil do empreendedor, atributos do
 * canal e o score de match. A resposta é restrita a um objeto JSON com dois
 * campos textuais limitados a 150 palavras cada (AC4).
 */

/** Limite máximo de palavras por campo de rationale (AC4). */
export const MAX_RATIONALE_WORDS = 150;

/** Perfil do empreendedor relevante para o prompt (AC3, subset consultável). */
export type RationaleProfileInput = {
  /** Metas declaradas (crescimento, margem, marca, previsibilidade). */
  goals?: Record<string, unknown> | null;
  /** Tolerância a risco 1..5. */
  riskTolerance?: number | null;
  /** Capital disponível 1..5. */
  capitalAvailable?: number | null;
  /** Capacidade de esforço/execução 1..5. */
  effortCapacity?: number | null;
  /** Audiência própria 1..5. */
  ownedAudience?: number | null;
  /** Horizonte de payback desejado (curto/medio/longo). */
  horizon?: string | null;
  /** Dados extras do perfil (jsonb `profile_data`, Story 3.5). */
  profileData?: Record<string, unknown> | null;
};

/** Atributos do canal relevantes para o prompt (AC3). */
export type RationaleChannelInput = {
  name: string;
  pillarName?: string | null;
  categoryName?: string | null;
  /** 5 = exige mais caixa. */
  costScore?: number | null;
  /** 5 = retorno mais rápido. */
  paybackScore?: number | null;
  /** 5 = mais arriscado. */
  riskScore?: number | null;
  /** 5 = mais controle. */
  controlScore?: number | null;
  /** 5 = escala mais longe. */
  scaleScore?: number | null;
  howItWorks?: string | null;
  bestFor?: string | null;
};

/** Rationale gerado e validado a partir da saída do LLM (AC1). */
export type GeneratedRationale = {
  fitReason: string;
  avoidReason: string;
};

/**
 * Conta palavras de um texto (tokens separados por espaço em branco).
 * Usado para impor o limite de 150 palavras (AC4) de forma determinística,
 * independente do que o LLM responder.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Trunca um texto para no máximo `maxWords` palavras (AC4). Acrescenta reticências
 * quando trunca, para sinalizar corte sem inventar conteúdo.
 */
export function truncateToWords(text: string, maxWords: number = MAX_RATIONALE_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "…";
}

/** Descreve um score 1..5 em linguagem natural para enriquecer o prompt. */
function describeScore(
  label: string,
  score: number | null | undefined,
  lowMeaning: string,
  highMeaning: string
): string | null {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return null;
  }
  const qualifier =
    score >= 4 ? `alto (${highMeaning})` : score <= 2 ? `baixo (${lowMeaning})` : "médio";
  return `${label}: ${score}/5 — ${qualifier}`;
}

/**
 * Instrução de sistema (AC3/AC4): define o papel, restringe a saída a JSON e
 * impõe o limite de 150 palavras por campo. Sem segredos.
 */
export function buildRationaleSystemPrompt(): string {
  return [
    "Você é um estrategista de monetização do EA360. Para um canal recomendado a",
    "um empreendedor, você escreve duas justificativas curtas e objetivas, em",
    "português do Brasil:",
    '- "fit_reason": por que este canal CABE no perfil e momento do empreendedor.',
    '- "avoid_reason": em que situações ou por quais riscos ele deve ser EVITADO',
    "  ou usado com cautela (mesmo sendo recomendado).",
    "",
    `Cada texto deve ter NO MÁXIMO ${MAX_RATIONALE_WORDS} palavras, ser específico ao`,
    "perfil e aos atributos do canal, e não inventar números que não foram dados.",
    "Não use markdown nem listas. Responda APENAS com um objeto JSON válido no",
    'formato: {"fit_reason": "...", "avoid_reason": "..."}.',
    "Não inclua nenhum texto fora do objeto JSON.",
  ].join("\n");
}

/** Serializa o perfil de forma compacta e legível para o prompt (AC3). */
function describeProfile(profile: RationaleProfileInput): string {
  const lines: string[] = [];

  const goalKeys = profile.goals
    ? Object.entries(profile.goals)
        .filter(([, v]) => v)
        .map(([k]) => k)
    : [];
  if (goalKeys.length > 0) lines.push(`Metas priorizadas: ${goalKeys.join(", ")}.`);
  if (profile.horizon) lines.push(`Horizonte de retorno desejado: ${profile.horizon}.`);

  const scoreLines = [
    describeScore("Tolerância a risco", profile.riskTolerance, "avesso a risco", "tolera risco"),
    describeScore("Capital disponível", profile.capitalAvailable, "pouco caixa", "caixa folgado"),
    describeScore(
      "Capacidade de execução",
      profile.effortCapacity,
      "pouco tempo/time",
      "time disponível"
    ),
    describeScore(
      "Audiência própria",
      profile.ownedAudience,
      "sem audiência",
      "audiência consolidada"
    ),
  ].filter((l): l is string => l !== null);
  lines.push(...scoreLines);

  if (profile.profileData) {
    const budget = (profile.profileData as { resources?: { budget?: unknown } })?.resources?.budget;
    if (typeof budget === "number" && Number.isFinite(budget)) {
      lines.push(`Orçamento declarado: R$ ${budget}.`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "(perfil sem dados detalhados)";
}

/** Serializa os atributos do canal de forma legível para o prompt (AC3). */
function describeChannel(channel: RationaleChannelInput): string {
  const lines: string[] = [`Canal: ${channel.name}.`];
  if (channel.pillarName) lines.push(`Pilar: ${channel.pillarName}.`);
  if (channel.categoryName) lines.push(`Categoria: ${channel.categoryName}.`);
  if (channel.howItWorks) lines.push(`Como funciona: ${channel.howItWorks}.`);
  if (channel.bestFor) lines.push(`Indicado para: ${channel.bestFor}.`);

  const scoreLines = [
    describeScore("Custo/caixa exigido", channel.costScore, "barato", "caro"),
    describeScore("Velocidade de retorno", channel.paybackScore, "retorno lento", "retorno rápido"),
    describeScore("Risco", channel.riskScore, "seguro", "arriscado"),
    describeScore("Controle", channel.controlScore, "pouco controle", "muito controle"),
    describeScore("Escala", channel.scaleScore, "escala limitada", "escala alta"),
  ].filter((l): l is string => l !== null);
  lines.push(...scoreLines);

  return lines.join("\n");
}

/**
 * Constrói a mensagem de usuário com perfil, atributos do canal e score de match
 * (AC3). `matchScore` é o `match_score` produzido por `fn_match_channels`
 * (Story 4.2) e persistido em `recommendation_items` (Story 4.1).
 */
export function buildRationaleUserPrompt(input: {
  profile: RationaleProfileInput;
  channel: RationaleChannelInput;
  matchScore: number | null;
}): string {
  const matchLine =
    input.matchScore !== null && Number.isFinite(input.matchScore)
      ? `Score de match deste canal com o perfil: ${input.matchScore}.`
      : "Score de match deste canal com o perfil: não informado.";

  return [
    "PERFIL DO EMPREENDEDOR:",
    describeProfile(input.profile),
    "",
    "ATRIBUTOS DO CANAL:",
    describeChannel(input.channel),
    "",
    matchLine,
    "",
    `Escreva "fit_reason" e "avoid_reason" (máx. ${MAX_RATIONALE_WORDS} palavras cada)`,
    "no formato JSON solicitado.",
  ].join("\n");
}

/** Isola o primeiro objeto JSON `{...}` presente no texto. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

/**
 * Faz o parse tolerante da saída do LLM, extraindo `fit_reason` e `avoid_reason`
 * e aplicando o limite de 150 palavras (AC4). Em qualquer formato inesperado,
 * retorna `null` sem lançar — o chamador trata como falha não-bloqueante (AC5).
 */
export function parseRationale(raw: string | null | undefined): GeneratedRationale | null {
  if (!raw || typeof raw !== "string") return null;

  const candidate = extractJsonObject(raw);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const fitRaw = typeof obj.fit_reason === "string" ? obj.fit_reason.trim() : "";
  const avoidRaw = typeof obj.avoid_reason === "string" ? obj.avoid_reason.trim() : "";

  if (fitRaw.length === 0 && avoidRaw.length === 0) return null;

  return {
    fitReason: truncateToWords(fitRaw),
    avoidReason: truncateToWords(avoidRaw),
  };
}
