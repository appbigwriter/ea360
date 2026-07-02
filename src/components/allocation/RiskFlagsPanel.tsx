"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RiskFlag } from "@/components/allocation/RiskFlag";
import {
  computeAndSaveRiskFlags,
  getRiskFlags,
  type SavedRiskFlag,
  type RiskFlagsResult,
} from "@/app/app/allocation/risk-flags-actions";
import type { FlagLevel } from "@/lib/risk/flags";

/**
 * Painel de faróis de risco da carteira (Story 6.4 — AC1, AC5, AC7).
 *
 * Mostra o farol da CARTEIRA (nível mais alto entre os canais — AC5) no header e um
 * farol por canal. O botão "Recalcular faróis" chama `computeAndSaveRiskFlags`
 * (AC7 — atualizados a cada recalculação) e atualiza a view.
 *
 * Recebe o estado inicial (pré-carregado pela página via `getRiskFlags`) e o
 * `allocationId`. Quando não há alocação, nada é renderizado (painel oculto).
 */
type Props = {
  allocationId: string | null;
  initialPortfolio: SavedRiskFlag | null;
  initialChannels: SavedRiskFlag[];
  channelNames: Record<string, string>;
};

export function RiskFlagsPanel({
  allocationId,
  initialPortfolio,
  initialChannels,
  channelNames,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [portfolio, setPortfolio] = useState<SavedRiskFlag | null>(initialPortfolio);
  const [channels, setChannels] = useState<SavedRiskFlag[]>(initialChannels);
  const [error, setError] = useState<string | null>(null);

  if (!allocationId) return null;

  function recalc() {
    if (!allocationId) return;
    setError(null);
    startTransition(async () => {
      const res: RiskFlagsResult = await computeAndSaveRiskFlags(allocationId);
      if (res.ok) {
        setPortfolio({
          channelId: null,
          level: res.portfolio.level,
          reasons: res.portfolio.reasons,
        });
        setChannels(
          res.channelFlags.map((cf) => ({
            channelId: cf.channelId,
            level: cf.level,
            reasons: cf.reasons,
          }))
        );
      } else {
        // Recalculo falhou — recarrega o estado salvo para não mentir na UI.
        const got = await getRiskFlags(allocationId);
        if (got.ok) {
          setPortfolio(got.portfolio);
          setChannels(got.channels);
        }
        setError(res.error);
      }
    });
  }

  const portfolioLevel: FlagLevel = portfolio?.level ?? "green";
  const portfolioReasons = portfolio?.reasons ?? [];

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RiskFlag level={portfolioLevel} reasons={portfolioReasons} size="md" />
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Farol da carteira:{" "}
            <span className="capitalize">
              {portfolioLevel === "green"
                ? "baixo"
                : portfolioLevel === "yellow"
                  ? "atenção"
                  : "alto"}
            </span>
          </h2>
        </div>
        <Button onClick={recalc} disabled={isPending} variant="outline">
          {isPending ? "Recalculando..." : "Recalcular faróis"}
        </Button>
      </div>

      {portfolioReasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {portfolioReasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Nenhum risco destacado nesta carteira.
        </p>
      )}

      {channels.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {channels.map((cf) => (
            <div
              key={cf.channelId}
              className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <RiskFlag level={cf.level} reasons={cf.reasons} />
              <span className="text-zinc-700 dark:text-zinc-300">
                {channelNames[cf.channelId ?? ""] ?? cf.channelId}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
