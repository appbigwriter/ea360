/**
 * Env — carrega variáveis de `.env.local` / `.env` (NUNCA loga valores).
 *
 * Usado pelo runner de gates para injetar `SUPABASE_ACCESS_TOKEN` /
 * `SUPABASE_PROJECT_REF` nos filhos `npx supabase ...` sem expor segredos.
 * O token permanece apenas em `.env.local` (git-ignored) — nunca é escrito em
 * arquivos versionados nem impresso.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENV_FILES = [".env.local", ".env"];
let cached = null;

/** Lê e decodifica KEY=VALUE dos arquivos .env* presentes (cacheado). */
export function loadDotenv() {
  if (cached) return cached;
  const out = {};
  for (const f of ENV_FILES) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) out[key] = val;
    }
  }
  cached = out;
  return out;
}

/** Ambiente do processo + valores do .env + extras (passado a spawnSync). */
export function mergedEnv(extra = {}) {
  return { ...process.env, ...loadDotenv(), ...extra };
}

/** `true` quando há token de acesso Supabase em .env (gates de DB ligam). */
export function hasSupabaseCreds() {
  return Boolean(loadDotenv().SUPABASE_ACCESS_TOKEN);
}

/**
 * Project ref: lê de `SUPABASE_PROJECT_REF` (.env) ou deriva de
 * `NEXT_PUBLIC_SUPABASE_URL` (subdomínio `https://<ref>.supabase.co`). Nunca do chat.
 */
export function projectRef() {
  const e = loadDotenv();
  if (e.SUPABASE_PROJECT_REF) return e.SUPABASE_PROJECT_REF;
  const url = e.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)\b/i);
  return (m && m[1]) || null;
}
