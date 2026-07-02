/**
 * Skeleton loader exibido enquanto os dados do GOM são carregados no servidor
 * (AC8). Renderizado via <Suspense fallback> em /gom.
 */
export function ChannelListSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true" data-testid="gom-skeleton">
      {/* barra de busca + filtros */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="h-10 w-full max-w-md rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>

      {/* grupos */}
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="mb-8">
          <div className="mb-4 h-6 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, c) => (
              <div key={c} className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
