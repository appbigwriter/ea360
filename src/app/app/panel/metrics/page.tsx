import Link from "next/link";
import { getActiveAllocationChannels, getChannelMetrics } from "./actions";
import { MetricsForm } from "@/components/panel/MetricsForm";

export const metadata = {
  title: "Métricas por canal | EA360",
  description: "Registre as métricas reais (ROAS, CPA, payback, contribuição) por canal e período.",
};

export const dynamic = "force-dynamic";

/**
 * Página de ingest manual de métricas (Story 7.2 — AC1, AC5). Carrega os canais da
 * alocação ativa (para o select) e o histórico de métricas (lista ordenada por
 * criação desc). Ingest manual — conectores automáticos são roadmap (AC6).
 */
export default async function PanelMetricsPage() {
  const [{ channels }, metrics] = await Promise.all([
    getActiveAllocationChannels(),
    getChannelMetrics(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          <Link href="/app/menu" className="hover:underline">
            Painel
          </Link>{" "}
          / Métricas
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Métricas por canal
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Registre o desempenho real de cada canal (ROAS, CPA, payback, contribuição) por período
          para comparar com o projetado.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Nova métrica</h2>
        <MetricsForm channels={channels} />
        {!metrics.ok ? (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{metrics.error}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Histórico</h2>
        {metrics.ok && metrics.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Período</th>
                  <th className="px-3 py-2">Gasto</th>
                  <th className="px-3 py-2">ROAS</th>
                  <th className="px-3 py-2">CPA</th>
                  <th className="px-3 py-2">Payback</th>
                  <th className="px-3 py-2">Contrib.</th>
                </tr>
              </thead>
              <tbody>
                {metrics.rows.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {r.channelName}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                      {r.periodStart} → {r.periodEnd}
                    </td>
                    <td className="px-3 py-2">{fmtBRL(r.spendActual)}</td>
                    <td className="px-3 py-2">{fmtNum(r.roas)}</td>
                    <td className="px-3 py-2">{fmtBRL(r.cpa)}</td>
                    <td className="px-3 py-2">{fmtNum(r.paybackActual)}</td>
                    <td className="px-3 py-2">{fmtBRL(r.contribution)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nenhuma métrica registrada ainda.
          </p>
        )}
      </section>
    </main>
  );
}

function fmtBRL(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}
