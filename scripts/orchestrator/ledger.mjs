/**
 * Ledger — estado de orquestração resumível, persistido em
 * `docs/stories/orchestrator-ledger.json`.
 *
 * O status base de cada story vem do próprio arquivo (`## Status`), lido pelo
 * backlog. O ledger guarda apenas METADADOS DE EXECUÇÃO (tentativas, resultados
 * de gate, notas, timestamps) — nunca duplica o status autoritativo. Assim o
 * orquestrador é idempotente e resumível entre sessões.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildBacklog, statusBucket } from "./backlog.mjs";

const LEDGER_PATH = join(process.cwd(), "docs", "stories", "orchestrator-ledger.json");
const LEDGER_VERSION = 1;

export function ledgerPath() {
  return LEDGER_PATH;
}

/** Carrega o ledger cru do disco (ou objeto vazio). */
function loadRaw() {
  if (!existsSync(LEDGER_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Reconstrói o estado consolidado: para cada story do backlog, status autoritativo
 * (do arquivo) + metadados de execução do ledger. Esta é a visão usada por toda
 * a CLI.
 */
export function loadState() {
  const backlog = buildBacklog();
  const raw = loadRaw();
  const meta = raw.stories || {};
  const stories = backlog.map((s) => {
    const bucket = statusBucket(s.status);
    const m = meta[s.id] || {};
    return {
      ...s,
      bucket,
      attempts: m.attempts || 0,
      lastGate: m.lastGate || null,
      notes: m.notes || [],
      updatedAt: m.updatedAt || null,
    };
  });
  return {
    version: LEDGER_VERSION,
    generatedAt: new Date().toISOString(),
    project: "EA360",
    source: "docs/stories/*.story.md",
    stories,
    runHistory: raw.runHistory || [],
  };
}

/** Contadores resumidos do estado. */
export function summarize(state) {
  const total = state.stories.length;
  const byBucket = { done: 0, implemented: 0, in_progress: 0, pending: 0 };
  for (const s of state.stories) byBucket[s.bucket] += 1;
  const remaining = byBucket.pending + byBucket.in_progress;
  const next = state.stories.find((s) => s.bucket === "pending" || s.bucket === "in_progress");
  return { total, byBucket, remaining, next, done: byBucket.done + byBucket.implemented };
}

/** Persiste apenas os metadados de execução (não o status, que é do arquivo). */
function persist(state) {
  const dir = join(process.cwd(), "docs", "stories");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const stories = {};
  for (const s of state.stories) {
    const hasMeta = s.attempts || s.lastGate || (s.notes && s.notes.length) || s.updatedAt;
    if (!hasMeta) continue;
    stories[s.id] = {
      attempts: s.attempts || 0,
      lastGate: s.lastGate || null,
      notes: s.notes || [],
      updatedAt: s.updatedAt || null,
    };
  }
  const out = { version: LEDGER_VERSION, stories, runHistory: state.runHistory || [] };
  writeFileSync(LEDGER_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
}

/** Marca início de trabalho numa story (incrementa tentativa). */
export function markAttempt(state, id) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) return false;
  s.attempts = (s.attempts || 0) + 1;
  s.updatedAt = new Date().toISOString();
  persist(state);
  return true;
}

/** Registra o resultado de um gate numa story. */
export function recordGate(state, id, gateResult) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) return false;
  s.lastGate = {
    at: new Date().toISOString(),
    passed: gateResult.passed,
    deferredCount: gateResult.deferredCount,
    results: gateResult.results.map((r) => ({
      tool: r.tool,
      cmd: r.cmd,
      ok: r.ok,
      deferred: r.deferred,
      code: r.code,
      durationMs: r.durationMs,
      tail: (r.output || "").slice(-600),
    })),
  };
  s.updatedAt = new Date().toISOString();
  persist(state);
  return true;
}

/** Adiciona uma nota livre à story. */
export function addNote(state, id, note) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) return false;
  s.notes = s.notes || [];
  s.notes.push({ at: new Date().toISOString(), note });
  s.updatedAt = new Date().toISOString();
  persist(state);
  return true;
}

/** Registra um evento de orquestração no histórico (auditoria). */
export function logRun(state, entry) {
  state.runHistory = state.runHistory || [];
  state.runHistory.push({ at: new Date().toISOString(), ...entry });
  persist(state);
}
