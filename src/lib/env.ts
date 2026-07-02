/**
 * Validação e exportação centralizada das variáveis de ambiente públicas
 * obrigatórias do Supabase (AC5 — Story 1.2).
 *
 * As variáveis `NEXT_PUBLIC_*` são inlined pelo Next.js no bundle, portanto
 * são seguras para uso no browser. NUNCA importe `SUPABASE_SERVICE_ROLE_KEY`
 * a partir deste módulo — ela deve permanecer apenas no servidor.
 *
 * Se uma variável obrigatória estiver ausente, a aplicação falha na
 * inicialização com uma mensagem clara, em vez de quebrar silenciosamente
 * mais tarde com erros de autenticação difíceis de diagnosticar.
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Variável de ambiente obrigatória ausente: ${name}. ` +
        `Defina-a no seu arquivo .env (consulte .env.example) antes de iniciar a aplicação.`
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
} as const;
