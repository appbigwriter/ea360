import Link from "next/link";
import { getLatestReview } from "./actions";
import { RebalanceReview } from "@/components/panel/RebalanceReview";
import type { RebalanceRecommendation } from "@/lib/panel/rebalance";

export const metadata = {
  title: "Rebalanceamento | EA360",
  description:
    "Recomendações automáticas de rebalanceamento da carteira com base no desempenho real.",
};

export const dynamic = "force-dynamic";

/**
 * Página de review/rebalanceamento (Story 7.4 — AC4). Exibe a recomendação mais
 * recente salva em `allocation_reviews` (se houver) e o componente cliente que gera
 * novas análises e aplica sugestões (AC5).
 */
export default async function PanelReviewPage() {
  const latest = await getLatestReview();
  const review = latest.ok ? latest.review : null;
  const recommendation = (review?.rebalance_recommendation ??
    null) as RebalanceRecommendation | null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          <Link href="/app/panel" className="hover:underline">
            Painel
          </Link>{" "}
          / Rebalanceamento
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Rebalanceamento
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Recomendações automáticas baseadas no desempenho real dos canais. Aplique sugestões para
          gerar uma nova versão da sua carteira.
        </p>
      </header>

      {!latest.ok ? <p className="text-sm text-red-600 dark:text-red-400">{latest.error}</p> : null}

      <RebalanceReview
        recommendation={recommendation}
        justification={review?.notes ?? null}
        health={review?.overall_health ?? null}
      />
    </main>
  );
}
