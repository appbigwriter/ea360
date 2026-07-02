"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  generateReview,
  applySuggestion,
  type GenerateReviewResult,
} from "@/app/app/panel/review/actions";
import type { RebalanceRecommendation, RebalanceAction } from "@/lib/panel/rebalance";

/**
 * Painel de rebalanceamento (Story 7.4 — AC4, AC5). Botão "Gerar recomendação"
 * dispara a análise (AC1–AC3); cada sugestão tem "Aplicar" (nova versão da carteira,
 * AC5) e "Ignorar".
 */
type Props = {
  recommendation: RebalanceRecommendation | null;
  justification: string | null;
  health: "on_track" | "off_track" | "critical" | null;
};

export function RebalanceReview({ recommendation, justification, health }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function generate() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const res: GenerateReviewResult = await generateReview();
      if (res.ok) {
        setStatus("Recomendação gerada.");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function apply(a: RebalanceAction) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const res = await applySuggestion(a.channelId, a.suggestedDeltaPct);
      if (res.ok) {
        setStatus(`Nova versão da carteira criada (${a.type}: ${a.name}).`);
        router.refresh();
      } else {
        setError(res.error ?? "Falha ao aplicar a sugestão.");
      }
    });
  }

  const all = recommendation
    ? [...recommendation.kills, ...recommendation.reductions, ...recommendation.increases]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={isPending}>
          {isPending
            ? "Analisando..."
            : recommendation
              ? "Atualizar recomendação"
              : "Gerar recomendação"}
        </Button>
        {status ? (
          <span className="text-sm text-green-700 dark:text-green-400" aria-live="polite">
            {status}
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {recommendation ? (
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm">
            <span className="font-medium">Saúde da carteira:</span>{" "}
            <span className="capitalize">{healthLabel(health)}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{justification}</p>

          {all.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {all.map((a) => {
                if (dismissed.has(a.channelId + a.type)) return null;
                return (
                  <li
                    key={a.channelId + a.type}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span>
                      <span className={`mr-2 font-medium ${typeColor(a.type)}`}>
                        {typeLabel(a.type)}
                      </span>
                      {a.name} — {a.reason}
                    </span>
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => apply(a)} disabled={isPending}>
                        Aplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDismissed((s) => new Set(s).add(a.channelId + a.type))}
                      >
                        Ignorar
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Nenhum ajuste recomendado.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gere uma recomendação para ver sugestões de rebalanceamento.
        </p>
      )}
    </div>
  );
}

function healthLabel(h: Props["health"]): string {
  if (h === "on_track") return "no caminho";
  if (h === "off_track") return "fora do caminho";
  if (h === "critical") return "crítica";
  return "—";
}
function typeLabel(t: RebalanceAction["type"]): string {
  return t === "increase" ? "Aumentar" : t === "reduce" ? "Reduzir" : "Encerrar";
}
function typeColor(t: RebalanceAction["type"]): string {
  return t === "increase" ? "text-green-600" : t === "reduce" ? "text-yellow-600" : "text-red-600";
}
