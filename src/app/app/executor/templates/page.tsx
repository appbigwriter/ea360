import Link from "next/link";
import { getTemplates } from "./actions";
import { getCompliance } from "./antiban-action";
import { TemplatesGenerator } from "@/components/executor/TemplatesGenerator";
import { AntibanReport } from "@/components/executor/AntibanReport";

export const metadata = {
  title: "Forja de copy | EA360",
  description: "Gere templates de mensagem WhatsApp Business aprováveis pela Meta.",
};

export const dynamic = "force-dynamic";

/** Página da Forja de copy (Story 8.2 — AC5). Lista templates + botão gerar. */
export default async function TemplatesPage() {
  const [templates, compliance] = await Promise.all([getTemplates(), getCompliance()]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          <Link href="/app/executor/funnel" className="hover:underline">
            Executor
          </Link>{" "}
          / Templates
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Forja de copy
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Templates WhatsApp Business conformes às diretrizes da Meta. A categoria é definida
          automaticamente pelo contexto.
        </p>
      </header>

      <TemplatesGenerator initial={templates.ok ? templates.templates : []} />
      {!templates.ok ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{templates.error}</p>
      ) : null}

      <AntibanReport initial={compliance.ok ? compliance.checks : []} />
    </main>
  );
}
