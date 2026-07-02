"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startNewInterview } from "@/app/app/panel/reevaluation-actions";

/**
 * Banner de reavaliação (Story 7.5 — AC2, AC3, AC4). Exibido no Painel 360 quando há
 * gatilho ativo. Mostra as razões e o botão "Refazer Entrevista", que cria uma nova
 * entrevista `in_progress` e redireciona para `/app/interview` (AC4).
 */
export function ReevaluationBanner({
  triggered,
  reasons,
}: {
  triggered: boolean;
  reasons: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!triggered) return null;

  function remake() {
    setError(null);
    startTransition(async () => {
      const res = await startNewInterview();
      if (res.ok) router.push("/app/interview");
      else setError(res.error);
    });
  }

  return (
    <section
      role="status"
      className="mb-8 flex flex-col gap-3 rounded-lg border border-yellow-400 bg-yellow-50 p-5 dark:border-yellow-600 dark:bg-yellow-950/40"
    >
      <div>
        <h2 className="text-base font-medium text-yellow-900 dark:text-yellow-100">
          Recomendamos refazer a Entrevista 360
        </h2>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-yellow-800 dark:text-yellow-200">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={remake} disabled={isPending}>
          {isPending ? "Iniciando..." : "Refazer Entrevista"}
        </Button>
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
