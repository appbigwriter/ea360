"use client";

import { useMemo, useState, useTransition } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { allocateBudget } from "@/app/app/allocation/actions";
import {
  allocateBudgetPure,
  AllocationError,
  DEFAULT_RATIOS,
  round2,
  type AllocationChannelInput,
  type AllocationItem,
  type RiskBand,
  type RiskBandRatios,
} from "@/lib/allocation/engine";

/**
 * Simulador de cenário de alocação (Story 5.3).
 *
 * Client Component com estado LOCAL: o usuário ajusta orçamento total e os ratios
 * de cada faixa de risco (núcleo / crescimento / experimento) e a alocação é
 * recalculada em tempo real, SEM round-trip ao servidor (AC2). O recálculo
 * reutiliza a engine PURA da Story 5.2 (`allocateBudgetPure`) para garantir
 * consistência exata com o resultado que será persistido (Dev Note 5.3).
 *
 * - AC1: sliders/inputs para orçamento total e % de cada faixa.
 * - AC2: ajuste recalcula client-side, sem servidor.
 * - AC3: tabela de canais recalculados + gráfico de pizza por faixa (recharts).
 * - AC4: soma dos ratios validada em tempo real (erro se != 100%).
 * - AC5: "Confirmar esta alocação" chama a Server Action `allocateBudget` (5.2).
 * - AC6: gráfico usa `recharts` (PRD §7).
 *
 * Nenhum segredo é exposto: o componente só recebe dados de canal já públicos ao
 * usuário (nome, faixa de risco, match_score) e delega a persistência à action.
 */

/** Canal candidato à simulação (subset do menu — Story 4.5). */
export type SimulatorChannel = {
  channelId: string;
  name: string;
  riskScore: number;
  matchScore?: number | null;
};

type Props = {
  /** id da recomendação ativa — alvo do "Confirmar" (AC5). */
  recommendationId: string;
  /** Canais recomendados para distribuir (do menu). */
  channels: SimulatorChannel[];
  /** Orçamento inicial sugerido. */
  defaultBudget?: number;
};

const BANDS: { band: RiskBand; label: string; color: string }[] = [
  { band: "core", label: "Núcleo", color: "#2563eb" },
  { band: "growth", label: "Crescimento", color: "#16a34a" },
  { band: "experiment", label: "Experimento", color: "#d97706" },
];

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Soma dos ratios é válida quando bate 100% (tolerância de float). */
function ratiosSumValid(ratios: RiskBandRatios): boolean {
  const sum = ratios.core + ratios.growth + ratios.experiment;
  return Math.abs(sum - 100) <= 0.01;
}

export function ScenarioSimulator({ recommendationId, channels, defaultBudget = 10000 }: Props) {
  const [budget, setBudget] = useState<number>(defaultBudget > 0 ? defaultBudget : 0);
  const [ratios, setRatios] = useState<RiskBandRatios>(DEFAULT_RATIOS);
  const [isPending, startTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  const ratioSum = round2(ratios.core + ratios.growth + ratios.experiment);
  const sumValid = ratiosSumValid(ratios);

  // Recálculo em tempo real, client-side (AC2). Reutiliza a engine pura (5.2).
  const { items, error: calcError } = useMemo(() => {
    if (!sumValid) {
      return { items: [] as AllocationItem[], error: null as string | null };
    }
    const engineInput: AllocationChannelInput[] = channels.map((c) => ({
      channelId: c.channelId,
      riskScore: c.riskScore,
      matchScore: c.matchScore ?? null,
    }));
    try {
      const result = allocateBudgetPure(budget, engineInput, ratios);
      return { items: result.items, error: null as string | null };
    } catch (err) {
      const message =
        err instanceof AllocationError
          ? err.message
          : "Não foi possível simular esta distribuição.";
      return { items: [] as AllocationItem[], error: message };
    }
  }, [budget, ratios, sumValid, channels]);

  const nameByChannel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of channels) map.set(c.channelId, c.name);
    return map;
  }, [channels]);

  // Totais por faixa para o gráfico de pizza (AC3).
  const bandTotals = useMemo(() => {
    const totals: Record<RiskBand, number> = {
      core: 0,
      growth: 0,
      experiment: 0,
    };
    for (const item of items) {
      totals[item.riskBand] = round2(totals[item.riskBand] + item.amount);
    }
    return BANDS.map((b) => ({
      band: b.band,
      name: b.label,
      color: b.color,
      value: totals[b.band],
    })).filter((entry) => entry.value > 0);
  }, [items]);

  function updateRatio(band: RiskBand, value: number) {
    setConfirmError(null);
    setConfirmSuccess(null);
    setRatios((prev) => ({ ...prev, [band]: round2(value) }));
  }

  function handleConfirm() {
    setConfirmError(null);
    setConfirmSuccess(null);

    if (!sumValid) {
      setConfirmError("A soma dos percentuais precisa ser 100% antes de confirmar.");
      return;
    }
    if (!Number.isFinite(budget) || budget <= 0) {
      setConfirmError("Informe um orçamento total maior que zero.");
      return;
    }
    if (calcError) {
      setConfirmError(calcError);
      return;
    }

    startTransition(async () => {
      const res = await allocateBudget(recommendationId, budget, ratios);
      if (res.ok) {
        setConfirmSuccess(
          `Alocação confirmada: ${res.itemCount} canais distribuídos em ${BRL.format(
            res.totalBudget
          )}.`
        );
      } else {
        setConfirmError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-8 lg:grid-cols-2">
        {/* Controles: orçamento + ratios (AC1) */}
        <div className="flex flex-col gap-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Orçamento total
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">R$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="100"
                value={Number.isFinite(budget) ? budget : ""}
                onChange={(e) => {
                  setConfirmError(null);
                  setConfirmSuccess(null);
                  setBudget(Number(e.target.value));
                }}
                className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(100000, budget)}
              step="500"
              value={Number.isFinite(budget) ? budget : 0}
              onChange={(e) => {
                setConfirmError(null);
                setConfirmSuccess(null);
                setBudget(Number(e.target.value));
              }}
              className="w-full accent-zinc-900 dark:accent-zinc-100"
              aria-label="Orçamento total"
            />
          </div>

          {BANDS.map(({ band, label, color }) => (
            <div key={band} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  {label}
                </span>
                <span className="text-zinc-600 tabular-nums dark:text-zinc-400">
                  {round2(ratios[band])}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step="1"
                value={ratios[band]}
                onChange={(e) => updateRatio(band, Number(e.target.value))}
                className="w-full"
                style={{ accentColor: color }}
                aria-label={`Percentual ${label}`}
              />
            </div>
          ))}

          {/* Validação em tempo real da soma dos ratios (AC4) */}
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              sumValid
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
            }`}
            role={sumValid ? "status" : "alert"}
            aria-live="polite"
          >
            {sumValid
              ? `Soma dos percentuais: ${ratioSum}% ✓`
              : `A soma deve ser 100%. Atual: ${ratioSum}%.`}
          </div>
        </div>

        {/* Gráfico de pizza com distribuição por faixa (AC3, AC6) */}
        <div className="flex min-h-[20rem] flex-col rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Distribuição por faixa de risco
          </h3>
          {bandTotals.length > 0 ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bandTotals}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(entry) => `${entry.name}: ${BRL.format(Number(entry.value))}`}
                  >
                    {bandTotals.map((entry) => (
                      <Cell key={entry.band} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => BRL.format(Number(value))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="flex flex-1 items-center justify-center text-sm text-zinc-500">
              {calcError ?? "Ajuste o orçamento e os percentuais para simular."}
            </p>
          )}
        </div>
      </section>

      {/* Tabela de canais recalculados (AC3) */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h3 className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          Canais e valores simulados
        </h3>
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                  <th className="px-5 py-2 font-medium">Canal</th>
                  <th className="px-5 py-2 font-medium">Faixa</th>
                  <th className="px-5 py-2 text-right font-medium">Valor</th>
                  <th className="px-5 py-2 text-right font-medium">% do total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const meta = BANDS.find((b) => b.band === item.riskBand);
                  return (
                    <tr
                      key={item.channelId}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="px-5 py-2 text-zinc-900 dark:text-zinc-100">
                        {nameByChannel.get(item.channelId) ?? item.channelId}
                      </td>
                      <td className="px-5 py-2">
                        <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: meta?.color }}
                            aria-hidden="true"
                          />
                          {meta?.label ?? item.riskBand}
                        </span>
                      </td>
                      <td className="px-5 py-2 text-right text-zinc-900 tabular-nums dark:text-zinc-100">
                        {BRL.format(item.amount)}
                      </td>
                      <td className="px-5 py-2 text-right text-zinc-600 tabular-nums dark:text-zinc-400">
                        {round2(item.percentage)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-zinc-500">
            {calcError ??
              (sumValid
                ? "Nenhum canal a distribuir com os parâmetros atuais."
                : "Corrija a soma dos percentuais para ver a distribuição.")}
          </p>
        )}
      </section>

      {/* Confirmação (AC5) */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isPending || !sumValid || !!calcError || budget <= 0}
          >
            {isPending ? "Confirmando..." : "Confirmar esta alocação"}
          </Button>
          {!sumValid ? (
            <span className="text-sm text-zinc-500">
              Ajuste os percentuais para 100% para confirmar.
            </span>
          ) : null}
        </div>
        {confirmError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {confirmError}
          </p>
        ) : null}
        {confirmSuccess ? (
          <p className="text-sm text-green-700 dark:text-green-400" aria-live="polite">
            {confirmSuccess}
          </p>
        ) : null}
      </section>
    </div>
  );
}
