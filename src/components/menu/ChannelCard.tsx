import Link from "next/link";
import type { MenuChannel } from "@/app/app/menu/queries";
import { riskFarol } from "./risk-farol";
import { formatBRL, formatReturnRange, formatPayback } from "./format";

/**
 * Card de canal do menu (Story 4.5, AC1/AC2/AC4).
 *
 * Exibe nome, pilar, score de match, métricas financeiras (gasto estimado,
 * faixa de retorno, payback), o motivo de adequação (fit_reason) e um faról de
 * risco (verde/amarelo/vermelho) derivado do `risk_score` (AC2). Inclui o botão
 * "Ver detalhes" que leva à rota de detalhe do item (AC4).
 */
export function MenuChannelCard({ channel }: { channel: MenuChannel }) {
  const farol = riskFarol(channel.riskScore);

  return (
    <article className="flex flex-col rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{channel.name}</h3>
          {channel.pillarName && (
            <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {channel.pillarName}
            </span>
          )}
        </div>
        {/* Faról de risco (AC2). */}
        <div
          className="flex shrink-0 items-center gap-1.5"
          role="img"
          aria-label={`${farol.label} (nota ${channel.riskScore})`}
          title={farol.label}
        >
          <span className={`h-3 w-3 rounded-full ${farol.dotClass}`} />
          <span className={`text-xs font-medium ${farol.textClass}`}>{farol.label}</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1.5">
        <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {Math.round(channel.matchScore)}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">de match</span>
      </div>

      <dl className="grid grid-cols-1 gap-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Gasto estimado</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatBRL(channel.estimatedSpend)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Retorno estimado</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatReturnRange(channel.returnRangeMin, channel.returnRangeMax)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-zinc-500 dark:text-zinc-400">Payback</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatPayback(channel.paybackMonths)}
          </dd>
        </div>
      </dl>

      {channel.fitReason && (
        <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
          {channel.fitReason}
        </p>
      )}

      <Link
        href={`/app/menu/${channel.id}`}
        className="mt-4 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Ver detalhes
      </Link>
    </article>
  );
}
