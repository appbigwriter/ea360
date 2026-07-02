import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { getSupabaseServiceRoleKey } from "@/lib/env.server";

/**
 * Cliente Supabase com service role (SERVER ONLY) — Story 3.3.
 *
 * Usado exclusivamente por Server Actions para inserir perguntas ramificadas
 * geradas pelo LLM em `interview_questions`, cuja única policy de RLS é de
 * leitura pública (sem policy de INSERT). A escrita controlada pelo servidor
 * (após validar que a entrevista pertence ao usuário) é a única forma segura
 * de persistir perguntas geradas.
 *
 * NUNCA importe este módulo de um Client Component: a service role key bypassa
 * RLS e jamais deve chegar ao cliente. A URL é pública (anon-safe); apenas a
 * chave vem de `env.server`.
 */
export function createAdminClient() {
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
