/**
 * Variáveis de ambiente SERVER-ONLY (Story 3.3, AC6).
 *
 * Este módulo é importado APENAS por Server Actions / Route Handlers. NUNCA o
 * importe de um Client Component — as chaves abaixo dão acesso privilegiado e
 * jamais devem chegar ao bundle do cliente. Por isso NÃO usam prefixo
 * `NEXT_PUBLIC_` e a leitura é preguiçosa (lazy), evitando que um import
 * acidental quebre o build do cliente.
 */

function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[env] Variável de ambiente de servidor obrigatória ausente: ${name}. ` +
        `Defina-a no seu arquivo .env (consulte .env.example).`
    );
  }
  return value;
}

/** Chave da API Anthropic — usada só no servidor (AC6). */
export function getAnthropicApiKey(): string {
  return requireServerEnv("ANTHROPIC_API_KEY");
}

/** Service role key do Supabase — bypassa RLS; SERVER ONLY. */
export function getSupabaseServiceRoleKey(): string {
  return requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");
}
