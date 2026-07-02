/**
 * Skeleton exibido enquanto as perguntas da Entrevista 360 são carregadas no
 * servidor (Story 3.2, AC7). Renderizado via <Suspense fallback> em
 * /app/interview.
 */
export function InterviewSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true" data-testid="interview-skeleton">
      {/* indicador de camada + barra de progresso */}
      <div className="mb-8 space-y-3">
        <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* pergunta */}
      <div className="mb-6 h-7 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />

      {/* campo de resposta */}
      <div className="mb-8 h-32 w-full rounded-md bg-zinc-200 dark:bg-zinc-800" />

      {/* botões de navegação */}
      <div className="flex justify-between">
        <div className="h-10 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-10 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
