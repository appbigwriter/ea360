/**
 * Story IO — escrita cirúrgica nos arquivos de story:
 *   - atualizar `## Status`
 *   - preencher `## Dev Agent Record` (Agent Model, Debug Log, Completion Notes, File List)
 *   - registrar Change Log
 *
 * Opera apenas por substituição direta de blocos delimitados por cabeçalhos `## `,
 * preservando o resto do markdown.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STORY_DIR = join(process.cwd(), "docs", "stories");

export function storyPath(id) {
  return join(STORY_DIR, `${id}.story.md`);
}

/** Substitui o corpo do cabeçalho `## <header>` por `body`. */
function replaceSection(md, header, body) {
  const re = new RegExp(
    `(^##\\s+${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n)([\\s\\S]*?)(?=\\n##\\s|$)`,
    "m"
  );
  if (!re.test(md)) {
    // Seção inexistente — anexa no final.
    return `${md.replace(/\s*$/, "\n")}\n## ${header}\n${body}\n`;
  }
  return md.replace(re, (_, head) => `${head}${body}`);
}

/** Atualiza o campo `## Status` da story. */
export function setStatus(id, status) {
  const path = storyPath(id);
  const md = readFileSync(path, "utf8");
  const next = replaceSection(md, "Status", status.trim());
  writeFileSync(path, next, "utf8");
}

/** Marca as Tasks como concluídas (converte `- [ ]` em `- [x]`). */
export function completeCheckboxes(id) {
  const path = storyPath(id);
  const md = readFileSync(path, "utf8");
  const next = md.replace(/^(\s*)- \[ \]/gm, "$1- [x]");
  writeFileSync(path, next, "utf8");
}

/**
 * Preenche o `## Dev Agent Record` com o registro de implementação.
 * `record` = { agentModel, debugLog[], notes[], files: {created:[], modified:[]} }
 */
export function fillDevRecord(id, record) {
  const path = storyPath(id);
  const md = readFileSync(path, "utf8");

  const created = (record.files?.created || []).map((f) => `- \`${f}\``).join("\n");
  const modified = (record.files?.modified || []).map((f) => `- \`${f}\``).join("\n");
  const debug = (record.debugLog || ["_A preencher pela execução_"])
    .map((l) => `- ${l}`)
    .join("\n");
  const notes = (record.notes || []).map((n) => `- ${n}`).join("\n");

  const body = [
    "### Agent Model Used",
    record.agentModel || "_orchestrator_",
    "",
    "### Debug Log References",
    debug,
    "",
    "### Completion Notes List",
    notes,
    "",
    "### File List",
    created ? `**Criados:**\n${created}\n` : "",
    modified ? `\n**Modificados:**\n${modified}\n` : "",
  ]
    .filter((s) => s.trim() || s === "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const next = replaceSection(md, "Dev Agent Record", body + "\n");
  writeFileSync(path, next, "utf8");
}

/** Adiciona uma linha ao Change Log (tabela markdown). */
export function addChangeLog(id, version, description, author) {
  const path = storyPath(id);
  const md = readFileSync(path, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  const row = `| ${date} | ${version} | ${description} | ${author} |`;
  const re = /(\|\s*Author\s*\|\s*\n)([\s\S]*?)(?=\n##\s|$)/;
  if (re.test(md)) {
    writeFileSync(
      path,
      md.replace(re, (_, head, body) => `${head}${body.replace(/\s*$/, "\n")}${row}\n`),
      "utf8"
    );
  }
}
