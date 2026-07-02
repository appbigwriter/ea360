/**
 * Forja de copy — templates WhatsApp Business aprováveis (Story 8.2 — R7 / F4.1).
 *
 * Helpers PUROS (sem SDK/segredos): prompt p/ LLM, parse tolerante, fallback
 * determinístico e regras da Meta (categorias, limites de caracteres). A Server
 * Action chama o LLM (tolerante a falha — AC6 do PRD) e cai no fallback se ausente.
 */
import type { FunnelStructure } from "@/lib/executor/funnel";

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

export type WhatsAppTemplate = {
  name: string;
  category: TemplateCategory;
  language: string;
  stage?: string;
  bodyText: string;
  headerText?: string;
  footerText?: string;
  buttons?: { type: string; text: string }[];
};

/** Limites de caracteres da Meta (Dev Note 8.2). */
export const META_LIMITS = { body: 1024, header: 60, footer: 60, button: 25 } as const;

/** Categoria por etapa do funil (AC6 — sistema decide, não o usuário). */
export function categoryForStage(stageKey: string): TemplateCategory {
  if (stageKey === "ctwa_ad" || stageKey === "nurture_sequence") return "MARKETING";
  if (stageKey === "auth" || stageKey === "authentication") return "AUTHENTICATION";
  return "UTILITY"; // welcome / free_window / bot_flow são utilitários
}

/** Constrói o prompt do sistema com as diretrizes da Meta (AC3). */
export function buildTemplatesSystemPrompt(): string {
  return [
    "Você gera templates de mensagem WhatsApp Business aprováveis pela Meta.",
    "Diretrizes OBRIGATÓRIAS:",
    "- Sem clickbait, sem promessas de ganho garantido, sem sensacionalismo.",
    "- O bot deve ser identificado na primeira mensagem de cada template.",
    "- Se um escape humano for fornecido, adicione uma opção clara para o usuário falar com um humano (via palavra-chave ou botão).",
    "- Use apenas variáveis {{1}}, {{2}} etc. para personalização.",
    "Categorias da Meta: UTILITY (notificações utilitárias), MARKETING (promoções), AUTHENTICATION (OTP).",
    `Limites: body até ${META_LIMITS.body} chars, header ${META_LIMITS.header}, footer ${META_LIMITS.footer}, button ${META_LIMITS.button}.`,
    "Responda APENAS com um array JSON de objetos: {name, category, language, stage, bodyText, headerText, footerText}.",
    "Não inclua texto fora do JSON.",
  ].join("\n");
}

export function buildTemplatesUserPrompt(funnel: FunnelStructure): string {
  const stages = funnel.stages.map((s) => `- ${s.key}: ${s.description}`).join("\n");
  return [
    `Objetivo da campanha: ${funnel.objective}`,
    `Identificação do bot: ${funnel.botDisclosure}`,
    funnel.humanEscapeConfig
      ? `Escape humano: O usuário pode digitar "${funnel.humanEscapeConfig.keyword}" para falar com humano.`
      : "",
    "Etapas do funil:",
    stages,
    "",
    "Gere ao menos 3 templates (welcome, follow-up, nurture), um por etapa relevante, com a categoria correta determinada pelo contexto. Garanta que o bot seja identificado de forma sutil mas transparente.",
  ].join("\n");
}

/** Faz o parse tolerante da saída do LLM (array JSON embutido ou puro). */
export function parseTemplates(raw: string | null | undefined): WhatsAppTemplate[] {
  if (!raw || typeof raw !== "string") return [];
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => normalizeTemplate(t))
    .filter((t): t is WhatsAppTemplate => t !== null);
}

function normalizeTemplate(t: Record<string, unknown>): WhatsAppTemplate | null {
  const bodyText =
    typeof t.bodyText === "string"
      ? t.bodyText
      : typeof t.body_text === "string"
        ? (t.body_text as string)
        : "";
  if (!bodyText) return null;
  const cat = String(t.category ?? "UTILITY").toUpperCase();
  const category: TemplateCategory =
    cat === "MARKETING" || cat === "AUTHENTICATION" ? cat : "UTILITY";
  return validateTemplate({
    name: String(t.name ?? "template"),
    category,
    language: String(t.language ?? "pt_BR"),
    stage: typeof t.stage === "string" ? t.stage : undefined,
    bodyText,
    headerText:
      typeof t.headerText === "string"
        ? t.headerText
        : typeof t.header_text === "string"
          ? (t.header_text as string)
          : undefined,
    footerText:
      typeof t.footerText === "string"
        ? t.footerText
        : typeof t.footer_text === "string"
          ? (t.footer_text as string)
          : undefined,
  });
}

/** Aplica os limites da Meta (AC3) — trunca campos ao máximo permitido. */
export function validateTemplate(t: WhatsAppTemplate): WhatsAppTemplate {
  const clip = (s: string | undefined, n: number) => (s ? s.slice(0, n) : undefined);
  return {
    ...t,
    bodyText: clip(t.bodyText, META_LIMITS.body) ?? "",
    headerText: clip(t.headerText, META_LIMITS.header),
    footerText: clip(t.footerText, META_LIMITS.footer),
    buttons: t.buttons?.map((b) => ({ ...b, text: b.text.slice(0, META_LIMITS.button) })),
  };
}

/**
 * Fallback determinístico (AC6 — tolerante a falha do LLM). Gera templates conformes
 * a partir do funil, sem chamar a API. Usado quando a chave/LLM está indisponível.
 */
export function buildFallbackTemplates(funnel: FunnelStructure): WhatsAppTemplate[] {
  const bot = funnel.botDisclosure;
  const escape = funnel.humanEscapeConfig
    ? `\n\nPara falar com humano, digite ${funnel.humanEscapeConfig.keyword}.`
    : "";

  return [
    validateTemplate({
      name: "welcome",
      category: categoryForStage("free_window"),
      language: "pt_BR",
      stage: "free_window",
      bodyText: `Olá! ${bot} Sou da equipe responsável por "${funnel.objective}". Como posso te ajudar agora?${escape}`,
    }),
    validateTemplate({
      name: "follow_up",
      category: categoryForStage("bot_flow"),
      language: "pt_BR",
      stage: "bot_flow",
      bodyText: `Ainda tem interesse? Posso te enviar mais detalhes. (${bot})${escape}`,
    }),
    validateTemplate({
      name: "nurture",
      category: categoryForStage("nurture_sequence"),
      language: "pt_BR",
      stage: "nurture_sequence",
      bodyText: `Preparamos uma novidade para você sobre "${funnel.objective}". Quer receber? (${bot})${escape}`,
    }),
  ];
}
