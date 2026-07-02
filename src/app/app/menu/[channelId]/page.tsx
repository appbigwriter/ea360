import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchMenuChannel } from "../queries";
import { riskFarol } from "@/components/menu/risk-farol";
import { formatBRL, formatReturnRange, formatPayback } from "@/components/menu/format";

// Rota autenticada (AC4): a proteção é feita no middleware (/app/*).
// Dinâmica porque lê dados por usuário via RLS.
export const dynamic = "force-dynamic";

// `channelId` aqui é o id do recommendation_item (ver ChannelCard / queries).
type PageParams = { channelId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const channel = await fetchMenuChannel(channelId);

  if (!channel) {
    return {
      title: "Canal não encontrado | Menu — EA360",
      description: "A recomendação solicitada não foi encontrada.",
    };
  }

  return {
    title: `${channel.name} — Meu Menu | EA360`,
    description:
      channel.fitReason?.slice(0, 160) ?? `Detalhes da recomendação do canal ${channel.name}.`,
  };
}

export default async function MenuChannelDetailPage({ params }: { params: Promise<PageParams> }) {
  const { channelId } = await params;
  const channel = await fetchMenuChannel(channelId);

  if (!channel) {
    notFound();
  }

  const farol = riskFarol(channel.riskScore);

  const metrics: { label: string; value: string }[] = [
    { label: "Score de match", value: String(Math.round(channel.matchScore)) },
    { label: "Gasto estimado", value: formatBRL(channel.estimatedSpend) },
    {
      label: "Retorno estimado",
      value: formatReturnRange(channel.returnRangeMin, channel.returnRangeMax),
    },
    { label: "Payback", value: formatPayback(channel.paybackMonths) },
    { label: "Nota de risco", value: `${channel.riskScore} / 5` },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/app/menu"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <span aria-hidden="true">&larr;</span> Voltar ao menu
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {channel.pillarName && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {channel.pillarName}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5"
            role="img"
            aria-label={`${farol.label} (nota ${channel.riskScore})`}
          >
            <span className={`h-3 w-3 rounded-full ${farol.dotClass}`} />
            <span className={`text-xs font-medium ${farol.textClass}`}>{farol.label}</span>
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {channel.name}
        </h1>
      </header>

      <section className="mt-8" aria-labelledby="metrics-heading">
        <h2
          id="metrics-heading"
          className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Métricas
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">{m.label}</dt>
              <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{m.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {channel.fitReason && (
        <section className="mt-8" aria-labelledby="fit-heading">
          <h2
            id="fit-heading"
            className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Por que cabe no seu momento
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">{channel.fitReason}</p>
        </section>
      )}

      {channel.avoidReason && (
        <section className="mt-8" aria-labelledby="avoid-heading">
          <h2
            id="avoid-heading"
            className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Pontos de atenção
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">{channel.avoidReason}</p>
        </section>
      )}
    </main>
  );
}
