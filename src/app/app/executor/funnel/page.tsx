import Link from "next/link";
import { getLatestFunnel } from "./actions";
import { FunnelBuilder } from "@/components/executor/FunnelBuilder";

export const metadata = {
  title: "Arquiteto de funil | EA360",
  description: "Gere o blueprint do funil CTWA: anúncio, janela grátis, bot e nurture.",
};

export const dynamic = "force-dynamic";

/** Página do Arquiteto de funil (Story 8.1 — AC1, AC3). */
export default async function FunnelPage() {
  const latest = await getLatestFunnel();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          <Link href="/app/panel" className="hover:underline">
            Executor
          </Link>{" "}
          / Funil
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Arquiteto de funil
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Configure a campanha CTWA e gere a estrutura do funil. O bot é sempre identificado
          (bot_disclosure obrigatório).
        </p>
      </header>
      <FunnelBuilder
        initial={latest.ok ? latest.structure : null}
        initialFunnelId={latest.ok ? latest.funnelId : undefined}
      />
    </main>
  );
}
