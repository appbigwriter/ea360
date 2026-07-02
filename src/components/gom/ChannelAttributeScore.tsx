/**
 * Exibe a nota 1–5 de um atributo de canal (Story 2.5, AC2).
 *
 * Renderiza o nome do atributo, uma barra de progresso segmentada (5 segmentos)
 * e a nota numérica. A visualização é neutra (não julga "alto = bom"), em
 * consonância com o ChannelCard do GOM Browser (Story 2.4).
 */
export function ChannelAttributeScore({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
        <span className="text-sm text-zinc-500 tabular-nums dark:text-zinc-400">{clamped}/5</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${label}: nota ${clamped} de 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={
              i < clamped
                ? "h-2 flex-1 rounded-sm bg-zinc-900 dark:bg-zinc-100"
                : "h-2 flex-1 rounded-sm bg-zinc-200 dark:bg-zinc-700"
            }
          />
        ))}
      </div>
    </div>
  );
}
