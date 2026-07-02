"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  runAntibanChecks,
  type AntibanRunResult,
} from "@/app/app/executor/templates/antiban-action";
import type { TemplateCompliance } from "@/app/app/executor/templates/antiban-action";

/**
 * Painel da Blindagem anti-ban (Story 8.3 — AC4, AC5, AC7). Botão "Verificar" roda as
 * regras em todos os templates; cada um recebe um farol + lista de issues. Mostra a
 * taxa de aprovação (sem flag vermelho) — métrica §10 (AC6).
 */
const DOT: Record<string, string> = {
  green: "bg-green-600",
  yellow: "bg-yellow-500",
  red: "bg-red-600",
};

export function AntibanReport({ initial }: { initial: TemplateCompliance[] }) {
  const [isPending, startTransition] = useTransition();
  const [checks, setChecks] = useState(initial);
  const [passRate, setPassRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res: AntibanRunResult = await runAntibanChecks();
      if (res.ok) {
        setChecks(res.checks);
        setPassRate(res.passRate);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={isPending} variant="outline">
          {isPending ? "Verificando..." : "Verificar (Blindagem)"}
        </Button>
        {passRate !== null ? (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            Taxa de aprovação (sem vermelho): <strong>{Math.round(passRate * 100)}%</strong>
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {checks.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gere templates e execute a Blindagem para ver o resultado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li
              key={c.templateId}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[c.result.flagLevel]}`}
                />
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</span>
                <span className="text-zinc-500">— {c.result.status}</span>
              </div>
              {c.result.issues.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-600 dark:text-zinc-400">
                  {c.result.issues.map((i, idx) => (
                    <li key={idx}>
                      <strong>{i.severity === "blocking" ? "Bloqueante" : "Aviso"}:</strong>{" "}
                      {i.message} <em>{i.suggestion}</em>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
