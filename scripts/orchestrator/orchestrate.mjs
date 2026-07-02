#!/usr/bin/env node
/**
 * EA360 Story Orchestrator — automação que orquestra o ciclo de desenvolvimento
 * (SDC) das stories 1.1 → 9.5 até a conclusão do MVP.
 *
 * Uso:
 *   node scripts/orchestrator/orchestrate.mjs <comando> [args]
 *
 * Comandos:
 *   plan                 Plano ordenado (1.1 → 9.5) com status atual.
 *   status               Resumo (done/total, próxima, %).
 *   next                 Próxima story acionável + prompt de implementação pronto.
 *   prompt <id>          Prompt de implementação completo para a story <id>.
 *   gate <id>            Executa os quality gates da story e registra no ledger.
 *   attempt <id>         Marca início de tentativa na story (ledger).
 *   complete <id> [...]  Fecha a story: status → Ready for Review, checkboxes,
 *                         change log, Dev Agent Record (flags opcionais).
 *   note <id> <texto>    Adiciona nota livre à story (ledger).
 *   ledger               Mostra o caminho do ledger + resumo.
 *   run-all              Drive sequencial: imprime a próxima, orienta o fluxo
 *                         (implementar → gate → complete) até 9.5.
 *
 * O orquestrador é o plano de controle: decide O QUÊ / passou no gate / estado.
 * A escrita de código é feita por um agente (CLI/AI) consumindo o prompt gerado.
 */
import {
  loadState,
  summarize,
  markAttempt,
  recordGate,
  addNote,
  logRun,
  ledgerPath,
} from "./ledger.mjs";
import { runGate } from "./gates.mjs";
import { setStatus, completeCheckboxes, fillDevRecord, addChangeLog } from "./story.mjs";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};
const c = (color, txt) => `${COLORS[color] || ""}${txt}${COLORS.reset}`;

const BUCKET_STYLE = {
  done: ["green", "✓"],
  implemented: ["cyan", "◎"],
  in_progress: ["yellow", "◐"],
  pending: ["gray", "○"],
};

function fmtBucket(s) {
  const [color, icon] = BUCKET_STYLE[s.bucket] || BUCKET_STYLE.pending;
  return `${c(color, icon)} ${s.id.padEnd(5)} ${c("dim", `[${s.epic.code}]`)} ${s.title}`;
}

// ---------------------------------------------------------------- helpers ----
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}
function argList(name) {
  const v = arg(name);
  return v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function sectionBody(md, header) {
  const re = new RegExp(`^##\\s+${header}\\s*$`, "m");
  const start = md.search(re);
  if (start === -1) return "";
  const rest = md.slice(start);
  const next = rest.slice(1).search(/\n##\s/m);
  return next === -1
    ? rest.slice(rest.indexOf("\n") + 1)
    : rest.slice(rest.indexOf("\n") + 1, next + 1);
}

const CONVENTIONS = `# Convenções EA360 (obrigatórias)
- App Router Next.js. App autenticada em \`src/app/app/<feature>/\`; server actions em \`actions.ts\`, queries em \`queries.ts\`, tipos em \`types.ts\`.
- Lógica de domínio PURA em \`src/lib/<domain>/<name>.ts\` + teste colocado \`<name>.test.ts\` (Vitest). NUNCA coloque segredos/SDK em funções puras.
- Componentes em \`src/components/<feature>/\`. Use \`@/components/ui\` (shadcn) e \`cn()\` de \`@/lib/utils\`.
- Supabase: migrations em \`supabase/migrations/20260101000NNN_<name>_story<N>.sql\` (próximo número sequencial), ADITIVAS+IDEMPOTENTES, com bloco GATE de verificação ao fim. RLS por business em toda tabela. Use o client server (\`@/lib/supabase/server\`), nunca o admin, nas server actions.
- Article IV — No Invention: toda AC deve rastrear ao PRD (R1–R7 / F1–F4 / §8). Não invente recursos. Parâmetros de implementação ok.
- IDS: REUSE > ADAPT > CREATE. Reuse tabelas/campos existentes; adapte com mudanças aditivas; só crie quando necessário (justifique).
- Ambiente: Supabase CLI pode estar ausente → gates de DB ficam \`deferred\` (GATE de verificação embutido na migração valida no push).`;

// -------------------------------------------------------------- prompt gen ----
function buildPrompt(story) {
  const ac = sectionBody(story.raw, "Acceptance Criteria");
  const devNotes = sectionBody(story.raw, "Dev Notes");
  const tasks = sectionBody(story.raw, "Tasks / Subtasks");
  const gateLine = story.gateTools.length
    ? story.gateTools.map((t) => `\`${t}\``).join(", ")
    : "(sem gate declarado)";
  const deps = story.deps.length ? story.deps.join(", ") : "(nenhuma)";

  return [
    `# IMPLEMENTAR STORY ${story.id} — ${story.title}`,
    ``,
    `- **Épico:** ${story.epic.code} ${story.epic.name}`,
    `- **Executor:** ${story.executor}  •  **Quality Gate:** ${story.qualityGate}`,
    `- **Gates:** ${gateLine}`,
    `- **Dependências:** ${deps}`,
    `- **ACs (#${story.acCount}):**`,
    ac.trim(),
    ``,
    `## Dev Notes`,
    devNotes.trim(),
    ``,
    `## Tasks`,
    tasks.trim(),
    ``,
    CONVENTIONS,
    ``,
    `## Contrato de saída`,
    `1. Implemente TODAS as ACs (funcional + testes).`,
    `2. Rode os gates: ${story.gateTools.map((t) => t).join(" → ")}.`,
    `3. Atualize \`docs/stories/${story.id}.story.md\`: Status → "Ready for Review", marque as Tasks [x], preencha o Dev Agent Record (Agent Model, Debug Log, Completion Notes com [AUTO-DECISION] quando decidir algo fora do literal do AC, File List) e adicione linha no Change Log.`,
    `4. Não crie recursos fora destas ACs (Article IV).`,
  ].join("\n");
}

// ---------------------------------------------------------------- commands ---
function cmdPlan(state) {
  console.log(c("bold", `\nEA360 — Plano de implementação (1.1 → 9.5)\n`));
  let lastMajor = null;
  for (const s of state.stories) {
    if (s.major !== lastMajor) {
      lastMajor = s.major;
      console.log(c("magenta", `\n— ${s.epic.code} ${s.epic.name} —`));
    }
    console.log("  " + fmtBucket(s));
  }
  const sum = summarize(state);
  console.log(
    c("dim", `\n${sum.done}/${sum.total} stories prontas • ${sum.remaining} pendentes\n`)
  );
}

function cmdStatus(state) {
  const sum = summarize(state);
  const pct = Math.round((sum.done / sum.total) * 100);
  const bar = (n) => "█".repeat(n) + "░".repeat(40 - n);
  const filled = Math.round((sum.done / sum.total) * 40);
  console.log(c("bold", `\nEA360 — Status do MVP\n`));
  console.log(`  ${c("green", bar(filled))} ${pct}%`);
  console.log(
    c(
      "dim",
      `  ${sum.done}/${sum.total} prontas • ${sum.byBucket.pending} draft • ${sum.byBucket.in_progress} em progresso\n`
    )
  );
  if (sum.next) {
    console.log(`  Próxima: ${c("yellow", sum.next.id)} — ${sum.next.title}`);
    console.log(
      c(
        "dim",
        `  ${sum.next.executor} → gate ${sum.next.qualityGate} [${sum.next.gateTools.join(", ")}]`
      )
    );
    console.log(c("dim", `  Rode: \`npm run orchestrate -- next\` para o prompt.\n`));
  } else {
    console.log(c("green", `  MVP completo — todas as stories prontas.\n`));
  }
}

function cmdNext(state) {
  const sum = summarize(state);
  if (!sum.next) {
    console.log(c("green", "MVP completo. Nenhuma story pendente."));
    return;
  }
  cmdPrompt(state, sum.next.id);
}

function cmdPrompt(state, id) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) {
    console.error(c("red", `Story ${id} não encontrada.`));
    process.exit(1);
  }
  console.log(buildPrompt(s));
}

function cmdGate(state, id) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) {
    console.error(c("red", `Story ${id} não encontrada.`));
    process.exit(1);
  }
  console.log(c("bold", `\nRodando gates da story ${id} — ${s.title}\n`));
  const result = runGate(s);
  for (const r of result.results) {
    if (r.deferred) {
      console.log(
        `  ${c("yellow", "◌")} ${r.tool.padEnd(14)} ${c("dim", "(diferido)")} ${r.reason || ""}`
      );
    } else {
      const tag = r.ok ? c("green", "✓") : c("red", "✗");
      const dur = r.durationMs ? c("dim", `(${r.durationMs}ms)`) : "";
      console.log(`  ${tag} ${r.tool.padEnd(14)} ${c("dim", r.cmd)} ${dur}`);
      if (!r.ok && r.output) console.log(c("gray", indent(r.output.slice(-1200), "      ")));
    }
  }
  recordGate(state, id, result);
  logRun(state, { op: "gate", id, passed: result.passed });
  const verdict = result.passed ? c("green", "PASS") : c("red", "FAIL");
  console.log(`\n  Veredito: ${verdict}  ${c("dim", `(${result.deferredCount} diferido(s))`)}\n`);
  if (!result.passed) process.exit(2);
}

function indent(str, pad) {
  return String(str)
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

function cmdAttempt(state, id) {
  if (!markAttempt(state, id)) {
    console.error(c("red", `Story ${id} não encontrada.`));
    process.exit(1);
  }
  logRun(state, { op: "attempt", id });
  console.log(c("cyan", `Tentativa registrada para ${id}.`));
}

function cmdComplete(state, id) {
  const s = state.stories.find((x) => x.id === id);
  if (!s) {
    console.error(c("red", `Story ${id} não encontrada.`));
    process.exit(1);
  }
  const model = arg("model") || "orchestrator-dev";
  const created = argList("created");
  const modified = argList("modified");
  const notes = argList("note");

  setStatus(id, "Ready for Review");
  completeCheckboxes(id);
  fillDevRecord(id, {
    agentModel: model,
    debugLog: ["Gates executados via `npm run orchestrate -- gate " + id + "`."],
    notes: notes.length ? notes : ["Implementação conduzida pelo orquestrador EA360."],
    files: { created, modified },
  });
  addChangeLog(
    id,
    "1.1",
    "Implementação concluída; Draft → Ready for Review (orquestrador).",
    "orchestrator"
  );
  addNote(state, id, "Story fechada pelo orquestrador (status → Ready for Review).");
  logRun(state, { op: "complete", id });
  console.log(c("green", `✓ Story ${id} fechada → Ready for Review.`));
}

function cmdNote(state, id, text) {
  if (!addNote(state, id, text || "(sem texto)")) {
    console.error(c("red", `Story ${id} não encontrada.`));
    process.exit(1);
  }
  console.log(c("cyan", `Nota adicionada a ${id}.`));
}

function cmdLedger(state) {
  const sum = summarize(state);
  console.log(c("bold", `\nLedger — ${ledgerPath()}`));
  console.log(c("dim", `  ${sum.done}/${sum.total} prontas • ${sum.remaining} pendentes`));
  const withMeta = state.stories.filter((s) => s.lastGate || (s.notes && s.notes.length));
  if (withMeta.length) {
    console.log(c("dim", `  Metadados de execução em ${withMeta.length} stories.`));
  }
  console.log("");
}

function cmdRunAll(state) {
  const sum = summarize(state);
  if (!sum.next) {
    console.log(c("green", "MVP completo. Nenhuma story pendente."));
    return;
  }
  console.log(c("bold", `\nEA360 — Drive sequencial até 9.5\n`));
  console.log(c("dim", "Fluxo por story: PROMPT → (agente implementa) → gate → complete.\n"));
  let i = 1;
  for (const s of state.stories) {
    if (s.bucket === "done" || s.bucket === "implemented") continue;
    console.log(c("yellow", `\n═══ [${i}] STORY ${s.id} — ${s.title} ═══`));
    console.log(c("dim", `Gate: ${s.gateTools.join(", ")} • Executor: ${s.executor}`));
    console.log(c("dim", `\nPrompt completo: \`npm run orchestrate -- prompt ${s.id}\``));
    console.log(
      c(
        "cyan",
        `Passos:\n  npm run orchestrate -- attempt ${s.id}\n  # implemente a story\n  npm run orchestrate -- gate ${s.id}\n  npm run orchestrate -- complete ${s.id} --model <m> --created <files>`
      )
    );
    i++;
  }
  console.log(c("green", `\nTotal pendente: ${sum.remaining} stories (até 9.5).\n`));
}

// ------------------------------------------------------------------- main ----
function main() {
  const [, , cmd, ...rest] = process.argv;
  const state = loadState();
  switch (cmd) {
    case undefined:
    case "plan":
      return cmdPlan(state);
    case "status":
      return cmdStatus(state);
    case "next":
      return cmdNext(state);
    case "prompt":
      return cmdPrompt(state, rest[0]);
    case "gate":
      return cmdGate(state, rest[0]);
    case "attempt":
      return cmdAttempt(state, rest[0]);
    case "complete":
      return cmdComplete(state, rest[0]);
    case "note":
      return cmdNote(state, rest[0], rest.slice(1).join(" "));
    case "ledger":
      return cmdLedger(state);
    case "run-all":
      return cmdRunAll(state);
    default:
      console.error(c("red", `Comando desconhecido: ${cmd}`));
      console.error(
        "Comandos: plan | status | next | prompt <id> | gate <id> | attempt <id> | complete <id> | note <id> <text> | ledger | run-all"
      );
      process.exit(1);
  }
}

main();
