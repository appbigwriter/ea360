import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchGomChannelById, fetchGomChannels } from "../queries";
import { ChannelAttributeScore } from "@/components/gom/ChannelAttributeScore";

// Página pública: dados do GOM são leitura pública via RLS (AC4).
export const dynamic = "force-dynamic";

type PageParams = { channelId: string };

const ATTRIBUTES: {
  key: "cost_score" | "payback_score" | "control_score" | "risk_score" | "scale_score";
  label: string;
}[] = [
  { key: "cost_score", label: "Custo" },
  { key: "payback_score", label: "Payback" },
  { key: "control_score", label: "Controle" },
  { key: "risk_score", label: "Risco" },
  { key: "scale_score", label: "Escala" },
];

/**
 * Pré-gera as rotas dos canais do seed (AC1, Subtask 1.2). Em caso de falha de
 * conexão durante o build, retorna vazio para que as rotas sejam geradas sob
 * demanda — a página continua sendo `force-dynamic`.
 */
export async function generateStaticParams(): Promise<PageParams[]> {
  try {
    const channels = await fetchGomChannels();
    return channels.map((channel) => ({ channelId: channel.id }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const channel = await fetchGomChannelById(channelId);

  if (!channel) {
    return {
      title: "Canal não encontrado | GOM — EA360",
      description: "O canal de monetização solicitado não foi encontrado.",
    };
  }

  const description =
    channel.description?.slice(0, 160) ??
    `Atributos e notas do canal de monetização ${channel.name} no Guia de Opções de Monetização do EA360.`;

  return {
    title: `${channel.name} — GOM | EA360`,
    description,
  };
}

export default async function ChannelDetailPage({ params }: { params: Promise<PageParams> }) {
  const { channelId } = await params;
  const channel = await fetchGomChannelById(channelId);

  if (!channel) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/gom"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <span aria-hidden="true">&larr;</span> Voltar ao catálogo
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {channel.pillar_name}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {channel.category_name}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {channel.name}
        </h1>
        {channel.description && (
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">{channel.description}</p>
        )}
      </header>

      <section className="mt-8" aria-labelledby="attributes-heading">
        <h2
          id="attributes-heading"
          className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Atributos de comportamento
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ATTRIBUTES.map(({ key, label }) => (
            <ChannelAttributeScore key={key} label={label} value={channel[key]} />
          ))}
        </div>
      </section>
    </main>
  );
}
