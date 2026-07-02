"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { allocateBudget, type PillarMinimumsInput } from "@/app/app/allocation/actions";
import {
  allocateBudgetPure,
  AllocationError,
  DEFAULT_RATIOS,
  round2,
  type AllocationChannelInput,
  type AllocationItem,
  type PillarMinimums,
  type PillarMinimumWarning,
} from "@/lib/allocation/engine";

/**
 * Configurador de MÍNIMO ENTRE PILARES — guardrail (Story 5.5).
 *
 * Client Component com estado LOCAL. O usuário define um % mínimo de investimento
 * por pilar de monetização (Ads, Afiliações, Parcerias — AC1). A alocação é
 * recalculada em tempo real reutilizando a engine PURA (`allocateBudgetPure`), de
 * modo que a prévia bate exatamente com o que é persistido ao confirmar (AC2, AC3).
 * Quando não é possível satisfazer todos os mínimos com o orçamento disponível,
 * um alerta visual é exibido (AC4). Os mínimos são OPCIONAIS (padrão 0% / podem ser
 * desativados — AC5) e são persistidos em `allocations.risk_band_ratios` (AC6).
 *
 * Nenhum segredo é exposto: recebe apenas dados de canal já públicos ao usuário e
 * delega a persistência à Server Action.
 */

/** Canal candidato (subset do menu — Story 4.5) com o pilar (Story 5.5). */
export type PillarChannel = {
  channelId: string;
  name: string;
  riskScore: number;
  matchScore?: number | null;
  /** Slug estável do pilar (`ads`/`afiliacoes`/`parcerias`). */
  pillarSlug: string | null;
  /** Nome de exibição do pilar. */
  pillarName: string | null;
};

type Props = {
  /** id da recomendação ativa — alvo do "Confirmar". */
  recommendationId: string;
  /** Canais recomendados (do menu). */
  channels: PillarChannel[];
  /** Orçamento inicial sugerido. */
  defaultBudget?: number;
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function PillarMinimumConfigurator({
  recommendationId,
  channels,
  defaultBudget = 10000,
}: Props) {
  const [budget, setBudget] = useState<number>(defaultBudget > 0 ? defaultBudget : 0);
  // Guardrail ativável (AC5): quando desligado, nenhum mínimo é imposto.
  const [enabled, setEnabled] = useState<boolean>(false);
  // Mínimos por pilar: pillarSlug -> string ('' = sem mínimo / 0%).
  const [minimums, setMinimums] = useState<Record<string, string>>({});

  const [isPending, startTransition] = useTransition();
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  // Pilares distintos presentes nos canais (AC1 — Ads/Afiliações/Parcerias).
  const pillars = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of channels) {
      if (c.pillarSlug) {
        map.set(c.pillarSlug, c.pillarName ?? c.pillarSlug);
      }
    }
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [channels]);

  /** Mínimos efetivos (apenas quando o guardrail está ativo e valor 0..100). */
  const minimumsMap = useMemo<PillarMinimums>(() => {
    const out: PillarMinimums = {};
    if (!enabled) return out;
    for (const p of pillars) {
      const raw = minimums[p.slug];
      if (raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0 && v <= 100) out[p.slug] = v;
    }
    return out;
  }, [enabled, pillars, minimums]);

  // Recálculo client-side em tempo real (AC2, AC3, AC4), reutilizando a engine pura.
  const {
    items,
    warnings,
    error: calcError,
  } = useMemo(() => {
    const engineInput: AllocationChannelInput[] = channels.map((c) => ({
      channelId: c.channelId,
      riskScore: c.riskScore,
      matchScore: c.matchScore ?? null,
      pillarKey: c.pillarSlug,
    }));
    try {
      const result = allocateBudgetPure(budget, engineInput, DEFAULT_RATIOS, minimumsMap);
      return {
        items: result.items,
        warnings: result.pillarWarnings ?? [],
        error: null as string | null,
      };
    } catch (err) {
      const message =
        err instanceof AllocationError
          ? err.message
          : "Não foi possível calcular esta distribuição.";
      return {
        items: [] as AllocationItem[],
        warnings: [] as PillarMinimumWarning[],
        error: message,
      };
    }
  }, [budget, channels, minimumsMap]);

  /** Verba alocada por pilar a partir dos itens calculados (prévia). */
  const allocatedByPillar = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of items) {
      if (!item.pillarKey) continue;
      m.set(item.pillarKey, round2((m.get(item.pillarKey) ?? 0) + item.amount));
    }
    return m;
  }, [items]);

  function setPillarMinimum(slug: string, value: string) {
    setConfirmError(null);
    setConfirmSuccess(null);
    setMinimums((prev) => ({ ...prev, [slug]: value }));
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

    const payload: PillarMinimumsInput = { ...minimumsMap };

    startTransition(async () => {
      const res = await allocateBudget(recommendationId, budget, DEFAULT_RATIOS, {}, payload);
      if (res.ok) {
        const unmet = res.pillarWarnings.length;
        setConfirmSuccess(
          `Carteira gerada: ${res.itemCount} canais em ${BRL.format(res.totalBudget)}${
            unmet > 0 ? ` — atenção: ${unmet} pilar(es) não atingiram o mínimo.` : "."
          }`
        );
      } else {
        setConfirmError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Controles gerais */}
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

        {/* AC5: guardrail é opcional / desativável. */}
        <label className="flex items-center gap-2 border-t border-zinc-100 pt-4 text-sm text-zinc-700 dark:border-zinc-900 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setConfirmError(null);
              setConfirmSuccess(null);
              setEnabled(e.target.checked);
            }}
            className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          Garantir mínimo de investimento por pilar
        </label>
        <p className="text-xs text-zinc-500">
          Quando ativo, a engine realoca verba para garantir que cada pilar receba ao menos o
          percentual definido (deduzindo de pilares acima do mínimo). O padrão é 0% (sem restrição).
        </p>
      </section>

      {/* AC1: % mínimo por pilar */}
      <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <h3 className="border-b border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          Mínimo por pilar
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                <th className="px-5 py-2 font-medium">Pilar</th>
                <th className="px-5 py-2 font-medium">Mínimo (%)</th>
                <th className="px-5 py-2 text-right font-medium">Alocado (prévia)</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pillars.map((pillar) => {
                const allocated = allocatedByPillar.get(pillar.slug) ?? 0;
                const requiredPct = minimumsMap[pillar.slug];
                const required = requiredPct != null ? round2(budget * (requiredPct / 100)) : null;
                const warning = warnings.find((w) => w.pillarKey === pillar.slug);
                return (
                  <tr
                    key={pillar.slug}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="px-5 py-2 text-zinc-900 dark:text-zinc-100">{pillar.name}</td>
                    <td className="px-5 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        placeholder="0"
                        disabled={!enabled}
                        value={minimums[pillar.slug] ?? ""}
                        onChange={(e) => setPillarMinimum(pillar.slug, e.target.value)}
                        aria-label={`Mínimo do pilar ${pillar.name}`}
                        className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </td>
                    <td className="px-5 py-2 text-right text-zinc-900 tabular-nums dark:text-zinc-100">
                      {BRL.format(allocated)}
                      {required != null ? (
                        <span className="ml-1 text-xs text-zinc-400">
                          / mín. {BRL.format(required)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-2">
                      {warning ? (
                        <span
                          className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-400"
                          title={`Faltam ${BRL.format(
                            round2(warning.requiredAmount - warning.allocatedAmount)
                          )} para o mínimo`}
                        >
                          Mínimo não atingido
                        </span>
                      ) : required != null ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-400">
                          OK
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {calcError ? (
          <p className="px-5 py-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {calcError}
          </p>
        ) : null}
      </section>

      {/* AC4: alerta agregado quando algum mínimo não pode ser satisfeito. */}
      {warnings.length > 0 ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          role="alert"
        >
          Não foi possível satisfazer todos os mínimos com o orçamento disponível. Aumente o
          orçamento, reduza os mínimos ou revise os tetos por canal.
        </div>
      ) : null}

      {/* Confirmação */}
      <section className="flex flex-col gap-3">
        <Button onClick={handleConfirm} disabled={isPending || !!calcError || budget <= 0}>
          {isPending ? "Gerando..." : "Gerar carteira com estes mínimos"}
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
