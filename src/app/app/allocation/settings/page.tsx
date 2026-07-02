import Link from "next/link";
import { getGuardrailConfig } from "@/app/app/allocation/actions";
import { GuardrailSettings } from "@/components/allocation/GuardrailSettings";

export const metadata = {
  title: "Guardrails de risco | EA360",
  description:
    "Configure guardrails de risco personalizados (concentração por pilar/canal, downside, mínimo por pilar) para a sua carteira de monetização.",
};

// Rota autenticada (/app/*): proteção no middleware. Dinâmica porque lê a alocação
// mais recente do usuário via RLS para alimentar o configurador de guardrails.
export const dynamic = "force-dynamic";

/**
 * Página de configuração de guardrails (Story 6.3 — AC6).
 *
 * Carrega os guardrails salvos na carteira mais recente (ou defaults) e os entrega
 * ao `GuardrailSettings`, que persiste em `allocations.guardrail_config` (AC2). Os
 * guardrails são aplicados (e exibidos como aviso) ao gerar a carteira (AC3/AC4) e
 * podem ser confirmados via "Ciente dos riscos" (AC5).
 */
export default async function AllocationSettingsPage() {
  const initial = await getGuardrailConfig();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          <Link href="/app/allocation" className="hover:underline">
            Alocação
          </Link>{" "}
          / Guardrails
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Guardrails de risco
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Defina limites personalizados de concentração e perda. O sistema avisa quando qualquer
          regra é violada — você decide se prossegue, ciente dos riscos.
        </p>
      </header>

      {!initial.ok && initial.error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Não foi possível carregar seus guardrails: {initial.error}
        </p>
      ) : null}

      <GuardrailSettings initial={initial} />
    </main>
  );
}
