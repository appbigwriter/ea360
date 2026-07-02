/**
 * Blindagem anti-ban — pre-flight de conformidade (Story 8.3 — R7 / F4.1 / §10).
 *
 * Regras DETERMINÍSTICAS codificadas (principais proibições da Meta) — robustas sem
 * depender do Oráculo (Story 8.7) nem de LLM. Um hook LLM pode enriquecer as issues
 * no futuro, mas o `flag_level` é sempre determinístico e auditável. Função PURA.
 */
import type { WhatsAppTemplate } from "@/lib/executor/copy";

export type IssueSeverity = "blocking" | "warning";
export type ComplianceIssue = {
  severity: IssueSeverity;
  rule: string;
  message: string;
  suggestion: string;
};
export type AntibanResult = {
  status: "passed" | "flagged" | "failed";
  flagLevel: "green" | "yellow" | "red";
  issues: ComplianceIssue[];
};

/** Padrões bloqueantes (promessa de ganho garantido, engano) — flag VERMELHO. */
const BLOCKING_PATTERNS: { re: RegExp; rule: string }[] = [
  { re: /garantido/i, rule: "promessa_de_garantia" },
  { re: /ganhe\s+r?\$?\s*\d/i, rule: "promessa_de_ganho" },
  { re: /\d{2,}\s*%\s*(de\s+)?(sucesso|garantido|lucro)/i, rule: "promessa_percentual" },
  { re: /sem\s+risco/i, rule: "risco_zero" },
  { re: /ficar\s+rico/i, rule: "promessa_enriquecimento" },
];

/** Padrões de aviso (clickbait, urgência) — flag AMARELO. */
const WARNING_PATTERNS: { re: RegExp; rule: string }[] = [
  { re: /clique\s+aqui/i, rule: "clickbait" },
  { re: /urgente\b/i, rule: "urgencia" },
  { re: /últim[ao]s?\s+(chance|oportunidade|horas|vagas)/i, rule: "escassez_artificial" },
];

/**
 * Executa as regras anti-ban contra um template (AC2/AC4). `botDisclosure` deve
 * aparecer no corpo; se ausente, issue de aviso (bot não identificado — AC do PRD R7).
 */
export function runAntibanRules(
  template: Pick<WhatsAppTemplate, "bodyText" | "name" | "headerText">,
  botDisclosure?: string
): AntibanResult {
  const issues: ComplianceIssue[] = [];
  const text = `${template.bodyText} ${template.headerText ?? ""}`;

  for (const { re, rule } of BLOCKING_PATTERNS) {
    if (re.test(text)) {
      issues.push({
        severity: "blocking",
        rule,
        message: `Conteúdo proibido detectado ("${rule}"): viola a política da Meta contra promessas enganosas.`,
        suggestion: "Remova promessas de ganho garantido ou resultados assegurados.",
      });
    }
  }
  for (const { re, rule } of WARNING_PATTERNS) {
    if (re.test(text)) {
      issues.push({
        severity: "warning",
        rule,
        message: `Padrão de alerta ("${rule}"): pode ser sinalizado como clickbait/urgência.`,
        suggestion: "Reescreva sem apelos de urgência artificial.",
      });
    }
  }
  if (
    botDisclosure &&
    botDisclosure.trim() &&
    !template.bodyText.toLowerCase().includes(botDisclosure.toLowerCase())
  ) {
    issues.push({
      severity: "warning",
      rule: "bot_nao_identificado",
      message: "O template não inclui a identificação do bot (bot_disclosure).",
      suggestion: `Inclua no corpo: "${botDisclosure}".`,
    });
  }

  const hasBlocking = issues.some((i) => i.severity === "blocking");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const status: AntibanResult["status"] = hasBlocking
    ? "failed"
    : hasWarning
      ? "flagged"
      : "passed";
  const flagLevel: AntibanResult["flagLevel"] = hasBlocking
    ? "red"
    : hasWarning
      ? "yellow"
      : "green";
  return { status, flagLevel, issues };
}
