/**
 * Helpers puros (sem SDK/IO) para a geração e o parse do Perfil de Monetização
 * da Entrevista 360 (Story 3.5).
 *
 * Mantido isolado da Server Action e do SDK Anthropic para ser testável e
 * client-safe (apenas tipos e funções puras). NENHUM segredo é lido aqui.
 *
 * O perfil é o objeto consultável do AC3, persistido em
 * `monetization_profiles.profile_data` (JSONB). As stories de matchmaking
 * (E-MENU) consomem este schema.
 */

/** Item Q&A da entrevista usado como contexto para gerar o perfil (AC1). */
export type ProfileQAItem = {
  question: string;
  answer: string;
  layer?: string | null;
};

/**
 * Schema do Perfil de Monetização (AC3). É o contrato JSON consumido pelas
 * stories de matchmaking. Todos os campos são sempre preenchidos (com defaults
 * vazios no fallback do AC6) para que os consumidores não precisem tratar
 * `undefined`.
 */
export type MonetizationProfile = {
  /** Objetivos & metas do empreendedor (camada 1). */
  objectives: string[];
  /** Filosofia & valores: princípios e o que recusa por convicção (camada 2). */
  philosophy: string[];
  /** Momento atual do negócio: caixa, margem, audiência, risco (camada 3). */
  current_stage: string;
  /** Recursos disponíveis: tempo, time, energia, capital (camada 4). */
  resources: string[];
  /**
   * UUIDs de `gom_channels.id` a EXCLUIR das recomendações pelo filtro de
   * filosofia (Story 3.6). É o contrato consumido pelo matchmaking
   * (`fn_match_channels(..., excluded_channel_ids uuid[], ...)`, Story 4.2).
   * Default: [].
   */
  excluded_channels: string[];
  /**
   * Detalhe das exclusões para exibição e edição no perfil (Story 3.6, AC4/AC5):
   * cada item carrega o canal, o motivo e a origem (filtro automático vs. ajuste
   * manual do usuário). Sempre presente (default []). `excluded_channels` é
   * derivado deste detalhe quando o filtro roda, mas ambos são mantidos em sync.
   */
  excluded_channel_details: ExcludedChannelDetail[];
};

/** Origem de uma exclusão de canal (Story 3.6, AC2/AC5). */
export type ExclusionSource = "philosophy_filter" | "user_manual";

/** Detalhe de um canal excluído, com motivo e origem (Story 3.6, AC4/AC5). */
export type ExcludedChannelDetail = {
  /** UUID de `gom_channels.id`. */
  channel_id: string;
  /** Nome legível do canal (para exibição sem novo round-trip). */
  channel_name: string;
  /** Motivo da exclusão exibido ao usuário (AC4). */
  reason: string;
  /** Origem: filtro automático de filosofia ou ajuste manual do usuário. */
  source: ExclusionSource;
};

/** Resultado bruto (fallback AC6) — sem interpretação do LLM. */
export type RawProfileData = MonetizationProfile & {
  /** Respostas cruas indexadas pela pergunta (AC6: "dados brutos"). */
  raw_answers: Array<{ question: string; answer: string; layer: string | null }>;
};

/** Perfil vazio com defaults seguros — base para fallback e merges. */
export function emptyProfile(): MonetizationProfile {
  return {
    objectives: [],
    philosophy: [],
    current_stage: "",
    resources: [],
    excluded_channels: [],
    excluded_channel_details: [],
  };
}

/**
 * Instrução de sistema: pede ao LLM um JSON estruturado com EXATAMENTE os campos
 * do AC3, em português do Brasil, sem texto fora do objeto JSON.
 */
export function buildProfileSystemPrompt(): string {
  return [
    'Você é um analista de negócios que sintetiza a "Entrevista 360" de um',
    "empreendedor em um Perfil de Monetização estruturado.",
    "",
    "A entrevista cobre quatro camadas:",
    "1. Objetivos & Metas — o que o empreendedor quer alcançar.",
    "2. Filosofia & Valores — princípios e o que recusa por convicção.",
    "3. Momento — caixa, margem, audiência e risco atuais.",
    "4. Recursos — tempo, time, energia e capital disponíveis.",
    "",
    "Gere um objeto JSON com EXATAMENTE estes campos:",
    '- "objectives": array de strings (objetivos/metas extraídos da camada 1).',
    '- "philosophy": array de strings (princípios/valores e o que recusa, camada 2).',
    '- "current_stage": string única descrevendo o momento do negócio (camada 3).',
    '- "resources": array de strings (recursos disponíveis, camada 4).',
    '- "excluded_channels": array de strings (canais/abordagens que o empreendedor',
    "  recusa por princípio; use [] se nada ficar explícito).",
    "",
    "Use português do Brasil. Seja conciso e fiel às respostas — não invente.",
    "Responda APENAS com o objeto JSON, sem nenhum texto antes ou depois.",
  ].join("\n");
}

/** Mensagem de usuário com todas as Q&A da entrevista como contexto (AC1). */
export function buildProfileUserPrompt(qa: ProfileQAItem[]): string {
  const body =
    qa.length > 0
      ? qa
          .map((item, i) => {
            const layer = item.layer ? ` [camada: ${item.layer}]` : "";
            return `${i + 1}.${layer} P: ${item.question}\n   R: ${
              item.answer || "(sem resposta)"
            }`;
          })
          .join("\n")
      : "(nenhuma resposta registrada)";

  return [
    "Respostas da Entrevista 360 do empreendedor:",
    "",
    body,
    "",
    "Gere o Perfil de Monetização no formato JSON solicitado.",
  ].join("\n");
}

/** Coage um valor desconhecido em array de strings não-vazias. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Coage um valor desconhecido em string (trim). */
function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Parse tolerante da saída do LLM em um `MonetizationProfile` (AC1/AC3).
 * Aceita um objeto JSON puro ou embutido em texto. Em formato inesperado,
 * retorna `null` — o chamador então cai no fallback do AC6 (sem lançar).
 */
export function parseMonetizationProfile(
  raw: string | null | undefined
): MonetizationProfile | null {
  if (!raw || typeof raw !== "string") return null;

  const candidate = extractJsonObject(raw);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  // `excluded_channels` (UUIDs) e `excluded_channel_details` são preenchidos pelo
  // filtro de filosofia determinístico (Story 3.6) sobre o catálogo real do GOM,
  // NÃO pela saída do LLM (que não conhece os UUIDs). Começam vazios aqui; o LLM
  // pode mencionar o que recusa em `philosophy`, que alimenta o filtro depois.
  return {
    objectives: toStringArray(obj.objectives),
    philosophy: toStringArray(obj.philosophy),
    current_stage: toString(obj.current_stage),
    resources: toStringArray(obj.resources),
    excluded_channels: [],
    excluded_channel_details: [],
  };
}

/**
 * Constrói o perfil de fallback (AC6) a partir das respostas cruas, sem LLM.
 * Distribui as respostas pelas camadas conhecidas e preserva o bruto em
 * `raw_answers` para auditoria/reprocessamento futuro.
 */
export function buildFallbackProfile(qa: ProfileQAItem[]): RawProfileData {
  const base = emptyProfile();
  const raw_answers = qa.map((item) => ({
    question: item.question,
    answer: item.answer,
    layer: item.layer ?? null,
  }));

  for (const item of qa) {
    const answer = item.answer?.trim();
    if (!answer) continue;
    switch (item.layer) {
      case "objetivos":
        base.objectives.push(answer);
        break;
      case "filosofia":
        base.philosophy.push(answer);
        break;
      case "momento":
        base.current_stage = base.current_stage ? `${base.current_stage}\n${answer}` : answer;
        break;
      case "recursos":
        base.resources.push(answer);
        break;
      default:
        // Sem camada conhecida: registra como objetivo genérico.
        base.objectives.push(answer);
    }
  }

  // excluded_channels/details ficam vazios aqui — o filtro de filosofia (Story
  // 3.6) os preenche na action, mesmo no fallback (a partir de base.philosophy).
  return { ...base, raw_answers };
}

/** Isola o primeiro objeto JSON `{...}` presente no texto. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}
