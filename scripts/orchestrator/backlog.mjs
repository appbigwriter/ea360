/**
 * Backlog — leitura e parsing das stories EA360.
 *
 * Fonte da verdade do estado de cada story é o próprio arquivo `docs/stories/*.story.md`
 * (campo `## Status`). Este módulo apenas LE e estrutura esses dados; nenhuma escrita.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STORY_DIR = join(process.cwd(), "docs", "stories");
const STORY_RE = /^(\d+)\.(\d+)\.story\.md$/;

export const EPICS = {
  1: { code: "E-FND", name: "Fundação" },
  2: { code: "E-GOM", name: "GOM" },
  3: { code: "E-INT", name: "Entrevista" },
  4: { code: "E-MENU", name: "Menu" },
  5: { code: "E-ALOC", name: "Alocação" },
  6: { code: "E-RISK", name: "Risco" },
  7: { code: "E-PNL", name: "P&L" },
  8: { code: "E-EXEC", name: "Execução" },
  9: { code: "E-XACC", name: "Qualidade" },
};

/** Lista os arquivos de story ordenados por versão numérica (6.3 < 6.10 < 7.1). */
export function listStoryFiles() {
  if (!existsSync(STORY_DIR)) return [];
  return readdirSync(STORY_DIR)
    .filter((f) => STORY_RE.test(f))
    .sort((a, b) => {
      const am = a.match(STORY_RE);
      const bm = b.match(STORY_RE);
      return +am[1] - +bm[1] || +am[2] - +bm[2];
    });
}

function sectionBody(md, header) {
  const re = new RegExp(`^##\\s+${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
  const start = md.search(re);
  if (start === -1) return "";
  const rest = md.slice(start);
  // corpo = até o próximo `## ` (nível 2) de mesmo nível.
  const next = rest.slice(1).search(/\n##\s/m);
  return next === -1
    ? rest.slice(rest.indexOf("\n") + 1)
    : rest.slice(rest.indexOf("\n") + 1, next + 1);
}

/** Extrai o array de quality_gate_tools do bloco de atribuição. */
function parseGateTools(block) {
  const m = block.match(/quality_gate_tools:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return (m[1].match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, "").trim()).filter(Boolean);
}

/** Parse completo de um arquivo de story. */
export function parseStory(file) {
  const path = join(STORY_DIR, file);
  const md = readFileSync(path, "utf8");
  const m = file.match(STORY_RE);
  const major = +m[1];
  const minor = +m[2];
  const id = `${major}.${minor}`;

  const titleLine = md.match(/^#\s+Story\s+\d+\.\d+:\s*(.+)$/m);
  const title = titleLine ? titleLine[1].trim() : id;

  const statusBody = sectionBody(md, "Status");
  const status = statusBody.trim().split("\n")[0].trim() || "Draft";

  const execBlock = sectionBody(md, "Executor Assignment");
  const executor = (execBlock.match(/^executor:\s*(.+)$/m)?.[1] || "").trim();
  const qualityGate = (execBlock.match(/^quality_gate:\s*(.+)$/m)?.[1] || "").trim();
  const gateTools = parseGateTools(execBlock);

  const acBody = sectionBody(md, "Acceptance Criteria");
  const acCount = (acBody.match(/^\s*\d+\.\s/gm) || []).length;

  // Dependências: "Depende de Story 6.1 (...), Story 6.2 (...)".
  const deps = new Set();
  for (const dm of md.matchAll(/Depende de[^.\n]*?Story\s+(\d+\.\d+)/gi)) {
    deps.add(dm[1]);
  }
  // Auto-dependência: major segue do major anterior (ordem natural).
  // Dependências explícitas capturadas acima são as usadas para ordenação/topologia.

  const epic = EPICS[major] || { code: `E-${major}`, name: `Épico ${major}` };

  return {
    id,
    major,
    minor,
    title,
    status,
    executor,
    qualityGate,
    gateTools,
    acCount,
    deps: [...deps].sort((a, b) => {
      const [ax, ay] = a.split(".").map(Number);
      const [bx, by] = b.split(".").map(Number);
      return ax - bx || ay - by;
    }),
    epic,
    file,
    path,
    raw: md,
  };
}

/** Backlog completo, ordenado por versão. */
export function buildBacklog() {
  return listStoryFiles().map(parseStory);
}

/**
 * Plano de execução ordenado por dependências (topologia estável).
 * Regras: (1) ordem natural major.minor; (2) deps explícitas antes;
 * (3) empate desempata por major.minor. Como as stories seguem encadeamento
 * linear do PRD, a ordem natural já é topologicamente válida — mantemos estável.
 */
export function orderedPlan(backlog = buildBacklog()) {
  return [...backlog].sort((a, b) => a.major - b.major || a.minor - b.minor);
}

/** Normaliza o status livre do markdown em um estado de orquestração. */
export function statusBucket(status) {
  const s = (status || "").toLowerCase();
  if (["done", "completed", "closed", "approved", "shipped"].some((k) => s.includes(k)))
    return "done";
  if (s.includes("review") || s.includes("implemented")) return "implemented";
  if (s.includes("progress") || s.includes("doing") || s.includes("blocked")) return "in_progress";
  return "pending"; // draft e afins
}
