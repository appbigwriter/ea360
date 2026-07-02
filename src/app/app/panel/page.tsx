import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { evaluateReevaluation } from "@/app/app/panel/reevaluation-actions";
import {
  RealVsProjectedChart,
  type ChannelComparison,
} from "@/components/panel/RealVsProjectedChart";
import { DateRangeFilter } from "@/components/panel/DateRangeFilter";
import { ReevaluationBanner } from "@/components/panel/ReevaluationBanner";

export const metadata = {
  title: "Painel 360 | EA360",
  description: "Compare o desempenho real vs. projetado de cada canal da sua carteira.",
};

export const dynamic = "force-dynamic";

/**
 * Painel 360 — real vs. projetado por canal (Story 7.3 — AC1, AC2, AC5, AC6).
 *
 * Para cada canal da alocação ativa: projetado = `allocation_items.amount` (verba
 * alocada); real = soma de `channel_metrics.spend_actual` no período filtrado. A
 * colorização da barra "real" reflete a performance (AC6). Canais sem métricas →
 * "Sem dados" + CTA (AC5). Filtro de período via query params `from`/`to` (AC4).
 */
export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const supabase = await createClient();

  // Story 7.5 — gatilhos de reavaliação (banner no painel).
  const reevaluation = await evaluateReevaluation();

  // Alocação ativa + itens (projeção = amount alocado).
  const { data: alloc } = await supabase
    .from("allocations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  type ItemRow = {
    id: string;
    channel_id: string;
    amount: number;
    gom_channels: { name: string | null } | null;
  };

  let items: ItemRow[] = [];
  if (alloc) {
    const { data } = await supabase
      .from("allocation_items")
      .select("id, channel_id, amount, gom_channels ( name )")
      .eq("allocation_id", alloc.id);
    items = (data ?? []) as unknown as ItemRow[];
  }

  // Métricas reais agregadas por canal no período (AC4).
  let metricsQuery = supabase.from("channel_metrics").select("channel_id, spend_actual");
  if (from) metricsQuery = metricsQuery.gte("period_start", from);
  if (to) metricsQuery = metricsQuery.lte("period_end", to);
  const { data: metricsRows } = await metricsQuery;
  const realByChannel = new Map<string, number>();
  for (const m of (metricsRows ?? []) as { channel_id: string; spend_actual: number | null }[]) {
    realByChannel.set(m.channel_id, (realByChannel.get(m.channel_id) ?? 0) + (m.spend_actual ?? 0));
  }

  const comparisons: ChannelComparison[] = items.map((it) => ({
    name: it.gom_channels?.name ?? it.channel_id,
    projected: Number(it.amount ?? 0),
    real: realByChannel.has(it.channel_id) ? realByChannel.get(it.channel_id)! : null,
  }));

  const hasAnyReal = comparisons.some((c) => c.real !== null);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Painel 360
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Real vs. projetado por canal. Barras verdes = no/a acima da projeção; vermelhas = mais
            de 20% abaixo.
          </p>
        </div>
        <DateRangeFilter />
      </header>

      {reevaluation.ok && reevaluation.triggered ? (
        <ReevaluationBanner triggered={reevaluation.triggered} reasons={reevaluation.reasons} />
      ) : null}

      {comparisons.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gere uma carteira primeiro para visualizar o painel.
        </p>
      ) : hasAnyReal ? (
        <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Gasto real vs. projetado (R$)
          </h2>
          <RealVsProjectedChart data={comparisons} />
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Sem dados</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Nenhuma métrica registrada ainda para este período.
          </p>
          <Link
            href="/app/panel/metrics"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Registrar métricas
          </Link>
        </section>
      )}
    </main>
  );
}
