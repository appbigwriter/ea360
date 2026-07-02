"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { allocateBudget, type ChannelCeilings } from "@/app/app/allocation/actions";
import {
  allocateBudgetPure,
  AllocationError,
  DEFAULT_GLOBAL_CEILING_PCT,
  DEFAULT_RATIOS,
  portfolioDownside,
  round2,
  type AllocationChannelInput,
  type AllocationItem,
  type RiskBand,
} from "@/lib/allocation/engine";

/**
 * Configurador de teto por canal — guardrail (Story 5.4).
 *
 * Client Component com estado LOCAL. O usuário define um teto GLOBAL padrão (% do
 * orçamento total) e/ou um teto INDIVIDUAL por canal (AC2). A alocação é
 * recalculada em tempo real reutilizando a engine PURA da Story 5.2/5.4
 * (`allocateBudgetPure`), de modo que a prévia bate exatamente com o que será
 * persistido ao confirmar (AC3, AC4). Canais que atingem o teto recebem o badge
 * "Teto atingido" (AC5); teto 0% exclui o canal (AC6).
 *
 * Nenhum segredo é exposto: recebe apenas dados de canal já públicos ao usuário
 * (nome, faixa, match_score) e delega a persistência à Server Action.
 */

/** Canal candidato à configuração de teto (subset do menu — Story 4.5). */
export type CeilingChannel = {
  channelId: string;
  name: string;
  riskScore: number;
  matchScore?: number | null;
};

type Props = {
  /** id da recomendação ativa — alvo do "Confirmar" (AC2). */
  recommendationId: string;
  /** Canais recomendados (do menu). */
  channels: CeilingChannel[];
  /** Orçamento inicial sugerido. */
  defaultBudget?: number;
};

const BANDS: Record<RiskBand, { label: string; color: string }> = {
  core: { label: "Núcleo", color: "#2563eb" },
  growth: { label: "Crescimento", color: "#16a34a" },
  experiment: { label: "Experimento", color: "#d97706" },
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Sentinela: canal sem teto individual (herda o global, se ativo). */
const NO_INDIVIDUAL = "" as const;

export function CeilingConfigurator({ recommendationId, channels, defaultBudget = 10000 }: Props) {
  const [budget, setBudget] = useState<number>(defaultBudget > 0 ? defaultBudget : 0);
  // Teto global padrão: habilitado/valor (AC2 — "padrão global").
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(false);
  const [globalPct, setGlobalPct] = useState<number>(DEFAULT_GLOBAL_CEILING_PCT);
  // Tetos individuais: channelId -> string ('' = herda global/sem teto).
  const [individual, setIndividual] = useState<Record<string, string>>({});

  const [isPending, startTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  /** Resolve o teto efetivo (em %) de cada canal: individual > global > sem teto. */
  const ceilingsMap = useMemo<ChannelCeilings>(() => {
    const out: ChannelCeilings = {};
    for (const c of channels) {
      const raw = individual[c.channelId];
      if (raw !== undefined && raw !== NO_INDIVIDUAL) {
        const v = Number(raw);
        if (Number.isFinite(v) && v >= 0 && v <= 100) {
          out[c.channelId] = v;
          continue;
        }
      }
      if (globalEnabled) out[c.channelId] = globalPct;
    }
    return out;
  }, [channels, individual, globalEnabled, globalPct]);

  // Recálculo client-side em tempo real (AC3, AC4), reutilizando a engine pura.
  const { items, error: calcError } = useMemo(() => {
    const engineInput: AllocationChannelInput[] = channels.map((c) => ({
      channelId: c.channelId,
      riskScore: c.riskScore,
      matchScore: c.matchScore ?? null,
      ceilingPct: ceilingsMap[c.channelId] ?? null,
    }));
    try {
      const result = allocateBudgetPure(budget, engineInput, DEFAULT_RATIOS);
      return { items: result.items, error: null as string | null };
    } catch (err) {
      const message =
        err instanceof AllocationError
          ? err.message
          : "Não foi possível calcular esta distribuição.";
      return { items: [] as AllocationItem[], error: message };
    }
  }, [budget, channels, ceilingsMap]);

  // Downside total da carteira (Story 6.2 — AC2): soma do downside por canal.
  const totalDownside = useMemo(() => portfolioDownside(items), [items]);

  function setIndividualCeiling(channelId: string, value: string) {
    setConfirmError(null);
    setConfirmSuccess(null);
    setIndividual((prev) => ({ ...prev, [channelId]: value }));
  }

  function handleConfirm() {
    setConfirmError(null);
    setConfirmSuccess(null);

    if (!Number.isFinite(budget) || budget <= 0) {
      setConfirmError("Informe um orçamento total maior que zero.");
      return;
    }
    if (calcError) {
      setConfirmError(calcError);
      return;
    }

    startTransition(async () => {
      const res = await allocateBudget(recommendationId, budget, DEFAULT_RATIOS, ceilingsMap);
      if (res.ok) {
        const capped = res.cappedChannelIds.length;
        setConfirmSuccess(
          `Carteira gerada: ${res.itemCount} canais em ${BRL.format(
            res.totalBudget
          )}${capped > 0 ? ` (${capped} no teto)` : ""}.`
        );
      } else {
        setConfirmError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Controles globais (AC2) */}
      <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
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
        </div>

        <div className="flex flex-wrap items-end gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={globalEnabled}
              onChange={(e) => {
                setConfirmError(null);
                setConfirmSuccess(null);
                setGlobalEnabled(e.target.checked);
              }}
              className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
            />
            Aplicar teto global padrão
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Teto global (% do orçamento)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              value={globalPct}
              disabled={!globalEnabled}
              onChange={(e) => {
                setConfirmError(null);
                setConfirmSuccess(null);
                setGlobalPct(round2(Number(e.target.value)));
              }}
              className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Canais com teto individual ignoram o global. Teto 0% exclui o canal da carteira.
          </p>
        </div>
      </section>

      {/* Downside total da carteira em destaque (Story 6.2 — AC3). */}
      {items.length > 0 ? (
        <section className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Risco máximo da carteira (pior cenário)
          </span>
          <span className="text-2xl font-semibold text-amber-900 tabular-nums dark:text-amber-200">
            {BRL.format(totalDownside)}
          </span>
          <span className="text-xs text-amber-700 dark:text-amber-400">
            Perda máxima estimada se todos os canais falhassem no pior cenário, ponderada pelo risco
            de cada canal (20% a 100% do valor alocado).
          </span>
        </section>
      ) : null}

      {/* Tabela de canais com teto individual + resultado (AC2, AC5) */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h3 className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          Teto por canal
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="px-5 py-2 font-medium">Canal</th>
                <th className="px-5 py-2 font-medium">Faixa</th>
                <th className="px-5 py-2 font-medium">Teto individual (%)</th>
                <th className="px-5 py-2 text-right font-medium">Valor alocado</th>
                <th
                  className="px-5 py-2 text-right font-medium"
                  title="Perda máxima estimada do canal: valor alocado × taxa de perda do risco (20% a 100%)."
                >
                  Risco máximo (R$)
                </th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => {
                const item = items.find((i) => i.channelId === channel.channelId);
                const meta = item ? BANDS[item.riskBand] : null;
                const ceilingValue = individual[channel.channelId] ?? NO_INDIVIDUAL;
                return (
                  <tr
                    key={channel.channelId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-5 py-2 text-zinc-900 dark:text-zinc-100">{channel.name}</td>
                    <td className="px-5 py-2">
                      {meta ? (
                        <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: meta.color }}
                            aria-hidden="true"
                          />
                          {meta.label}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        placeholder="—"
                        value={ceilingValue}
                        onChange={(e) => setIndividualCeiling(channel.channelId, e.target.value)}
                        aria-label={`Teto do canal ${channel.name}`}
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </td>
                    <td className="px-5 py-2 text-right text-zinc-900 tabular-nums dark:text-zinc-100">
                      {item ? BRL.format(item.amount) : "—"}
                    </td>
                    <td className="px-5 py-2 text-right text-amber-700 tabular-nums dark:text-amber-500">
                      {item ? BRL.format(item.downsideEstimate ?? 0) : "—"}
                    </td>
                    <td className="px-5 py-2">
                      {!item ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Excluído
                        </span>
                      ) : item.ceilingReached ? (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-400"
                          title={
                            item.ceilingAmount != null
                              ? `Limitado a ${BRL.format(item.ceilingAmount)}`
                              : undefined
                          }
                        >
                          Teto atingido
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {items.length > 0 ? (
              <tfoot>
                {/* Story 6.2 (AC2, AC3): downside total da carteira em destaque. */}
                <tr className="border-t border-zinc-200 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  <td className="px-5 py-3" colSpan={3}>
                    Total da carteira
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {BRL.format(items.reduce((acc, i) => round2(acc + i.amount), 0))}
                  </td>
                  <td className="px-5 py-3 text-right text-amber-700 tabular-nums dark:text-amber-500">
                    {BRL.format(totalDownside)}
                  </td>
                  <td className="px-5 py-3" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        {calcError ? (
          <p className="px-5 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {calcError}
          </p>
        ) : null}
      </section>

      {/* Confirmação (AC2) */}
      <section className="flex flex-col gap-3">
        <Button onClick={handleConfirm} disabled={isPending || !!calcError || budget <= 0}>
          {isPending ? "Gerando..." : "Gerar carteira com estes tetos"}
        </Button>
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
