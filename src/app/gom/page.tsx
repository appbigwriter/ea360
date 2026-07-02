import { Suspense } from "react";
import { fetchGomChannels } from "./queries";
import { GomBrowser } from "@/components/gom/GomBrowser";
import { ChannelListSkeleton } from "@/components/gom/ChannelListSkeleton";

export const metadata = {
  title: "GOM — Guia de Opções de Monetização | EA360",
  description:
    "Navegue, busque e filtre os canais de monetização do EA360 por pilar e atributo. Acesso público, sem login.",
};

// Página pública: dados do GOM são leitura pública via RLS (AC6).
export const dynamic = "force-dynamic";

async function GomContent() {
  const channels = await fetchGomChannels();
  return <GomBrowser channels={channels} />;
}

export default function GomPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Guia de Opções de Monetização
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Conheça os canais de receita do EA360, agrupados por pilar. Busque, filtre por pilar e
          ordene por atributo. Use{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800">
            Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800">
            K
          </kbd>{" "}
          para a busca rápida.
        </p>
      </header>

      <Suspense fallback={<ChannelListSkeleton />}>
        <GomContent />
      </Suspense>
    </main>
  );
}
