/**
 * Gates — mapeia `quality_gate_tools` de cada story em comandos shell reais e os executa.
 *
 * Convenção EA360 (AGENTS.md Quality Gates): lint, typecheck, build, test, supabase.
 * O `typecheck` não tem script npm próprio → usamos `npx tsc --noEmit` (strict).
 * Comandos `supabase ...` e SQL solto (SELECT...) dependem de banco/CLI e são marcados
 * `deferred` quando o ambiente não os suporta (sem Supabase CLI / sem DB remoto).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mergedEnv, hasSupabaseCreds, projectRef } from "./env.mjs";

/** Traduz uma ferramenta de gate num comando executável (ou marcada como diferida). */
export function commandForTool(tool) {
  const t = (tool || "").trim();
  const lower = t.toLowerCase();

  if (lower === "lint") return { cmd: "npm run lint", executable: true };
  if (lower === "typecheck" || lower === "type-check")
    return { cmd: "npx tsc --noEmit", executable: true };
  if (lower === "build") return { cmd: "npm run build", executable: true };
  if (lower === "test") return { cmd: "npm run test", executable: true };
  if (lower.startsWith("supabase")) return { cmd: `npx ${t}`, executable: true, db: true };

  // SQL solto (ex.: "SELECT * FROM oracle_documents LIMIT 1") — roda ao vivo via
  // CLI no projeto linkado quando há token (db query --linked).
  if (/^(select|insert|with|update|delete)\b/i.test(t))
    return {
      cmd: `npx supabase db query --linked ${JSON.stringify(t)}`,
      executable: true,
      db: true,
    };

  return { cmd: t, executable: false, reason: "gate não-mapeado (revisão manual)" };
}

/**
 * Executa UM comando de gate. Retorna {ok, code, output, durationMs}.
 * Usa shell do SO; timeout de 5 min por comando.
 * - Gates comuns (lint/typecheck/build/test): ambiente do shell + CI limpo, SEM
 *   injeção do .env.local (igual a rodar à mão — evita que NODE_ENV/outras vars do
 *   .env.local quebrem o build/prerender).
 * - Gates de DB (supabase): injeta .env.local (token) via mergedEnv().
 */
function runCommand(cmd, opts = {}) {
  const start = Date.now();
  const baseEnv = opts.useDotenv ? mergedEnv() : { ...process.env, CI: "1", FORCE_COLOR: "0" };
  const res = spawnSync(cmd, [], {
    shell: true,
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
    env: baseEnv,
    cwd: process.cwd(),
  });
  const startMs = start;
  const stdout = opts.silent ? "" : (res.stdout || "").trimEnd();
  const stderr = opts.silent ? "" : (res.stderr || "").trimEnd();
  const output = [stdout, stderr].filter(Boolean).join("\n");
  return {
    ok: res.status === 0,
    code: res.status,
    output,
    durationMs: Date.now() - startMs,
  };
}

/** Indica se o projeto Supabase local já está linkado (`supabase/.temp` presente). */
function isSupabaseLinked() {
  return existsSync(join(process.cwd(), "supabase", ".temp"));
}

/**
 * Garante que o projeto esteja linkado antes de um gate de DB. Não-fatal: se faltar
 * credencial/ref, devolve {ok:false} e o gate cai para diferido pelo chamador.
 */
function ensureSupabaseLinked() {
  if (isSupabaseLinked()) return { ok: true, skipped: true };
  const ref = projectRef();
  if (!ref) return { ok: false, reason: "SUPABASE_PROJECT_REF ausente em .env.local" };
  if (!hasSupabaseCreds()) return { ok: false, reason: "SUPABASE_ACCESS_TOKEN ausente" };
  return runCommand(`npx supabase link --project-ref ${ref}`, { useDotenv: true });
}

/**
 * Roda todos os gates de uma story. Retorna { passed, deferredCount, results }.
 * Gates `deferred`/não-executáveis não falham o conjunto — ficam como revisão manual.
 */
export function runGate(story) {
  const results = [];
  let deferredCount = 0;

  for (const tool of story.gateTools) {
    const { cmd, executable, db, reason } = commandForTool(tool);

    if (!executable) {
      results.push({ tool, cmd, ok: null, deferred: true, reason, output: "" });
      deferredCount += 1;
      continue;
    }

    // Gates de DB (supabase ...): exigem token em .env.local e projeto linkado.
    if (db) {
      if (!hasSupabaseCreds()) {
        results.push({
          tool,
          cmd,
          ok: null,
          deferred: true,
          reason: "SUPABASE_ACCESS_TOKEN ausente em .env.local (adicione para rodar ao vivo)",
          output: "",
        });
        deferredCount += 1;
        continue;
      }
      const link = ensureSupabaseLinked();
      if (!link.ok) {
        results.push({ tool, cmd, ok: null, deferred: true, reason: link.reason, output: "" });
        deferredCount += 1;
        continue;
      }
    }

    const ran = runCommand(cmd, { useDotenv: db === true });
    results.push({
      tool,
      cmd,
      ok: ran.ok,
      deferred: false,
      code: ran.code,
      durationMs: ran.durationMs,
      output: ran.output,
    });
  }

  const hard = results.filter((r) => !r.deferred);
  const passed = hard.length > 0 && hard.every((r) => r.ok);
  return { passed, deferredCount, results };
}
