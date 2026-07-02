import Link from "next/link";
import type { GomChannel } from "@/app/gom/queries";

const SCORE_LABELS: { key: keyof GomChannel; label: string }[] = [
  { key: "cost_score", label: "Custo" },
  { key: "payback_score", label: "Payback" },
  { key: "control_score", label: "Controle" },
  { key: "risk_score", label: "Risco" },
  { key: "scale_score", label: "Escala" },
];

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`${value} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={
            i < value
              ? "h-1.5 w-3 rounded-sm bg-zinc-900 dark:bg-zinc-100"
              : "h-1.5 w-3 rounded-sm bg-zinc-200 dark:bg-zinc-700"
          }
        />
      ))}
    </div>
  );
}

export function ChannelCard({
  channel,
  highlighted = false,
}: {
  channel: GomChannel;
  highlighted?: boolean;
}) {
  return (
    <article
      id={`channel-anchor-${channel.id}`}
      className={
        "flex flex-col rounded-lg border bg-white p-4 transition-shadow hover:shadow-md dark:bg-zinc-950 " +
        (highlighted
          ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
          : "border-zinc-200 dark:border-zinc-800")
      }
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          <Link
            href={`/gom/${channel.id}`}
            className="transition-colors hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
          >
            {channel.name}
          </Link>
        </h3>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {channel.category_name}
        </span>
      </div>
      {channel.description && (
        <p className="mb-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
          {channel.description}
        </p>
      )}
      <dl className="mt-auto grid grid-cols-1 gap-1.5">
        {SCORE_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd>
              <ScoreBar value={channel[key] as number} />
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
