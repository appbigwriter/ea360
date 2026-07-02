"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { allocateBudget, type AllocateBudgetResult } from "@/app/app/allocation/actions";
import type { GuardrailViolation } from "@/lib/allocation/engine";

/**
 * Botão "Gerar carteira" (Story 5.2 — AC1 / Task 3; fluxo de guardrails Story 6.3).
 *
 * Coleta o orçamento total do usuário e dispara a Server Action `allocateBudget`,
 * que distribui a verba 70/20/10 entre os canais da recomendação e persiste a
 * carteira. Quando a engine detecta violações de guardrail (Story 6.3 — AC3/AC4), a
 * action recusa persistir e devolve `requiresAcknowledgement: true` (AC5): exibimos
 * as violações e um checkbox "Ciente dos riscos"; ao confirmar, re-enviamos com
 * `acknowledged: true`, autorizando salvar mesmo com riscos (AC5).
 */

type Props = {
  /** id da recomendação ativa do usuário (Story 4.5). */
  recommendationId: string;
  /** Orçamento sugerido (ex.: vindo do perfil de monetização). */
  defaultBudget?: number;
};

export function GenerateAllocationButton({ recommendationId, defaultBudget = 0 }: Props) {
  const [isPending, startTransition] = useTransition();
  const [budget, setBudget] = useState<string>(defaultBudget > 0 ? String(defaultBudget) : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [violations, setViolations] = useState<GuardrailViolation[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  function generate(withAcknowledgement: boolean) {
    setError(null);
    setSuccess(null);
    setViolations(null);

    const parsed = Number(budget);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Informe um orçamento total maior que zero.");
      return;
    }

    startTransition(async () => {
      const res: AllocateBudgetResult = await allocateBudget(
        recommendationId,
        parsed,
        undefined,
        {},
        {},
        { acknowledged: withAcknowledgement }
      );
      if (res.ok) {
        setSuccess(
          `Carteira gerada: ${res.itemCount} canais distribuídos em R$${res.totalBudget.toLocaleString(
            "pt-BR"
          )}.`
        );
        setAcknowledged(false);
      } else if (res.requiresAcknowledgement && res.guardrailViolations) {
        // Story 6.3 AC5: violações sem ciência — exibe lista + checkbox.
        setViolations(res.guardrailViolations);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Gerar carteira de monetização
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Distribui seu orçamento entre os canais recomendados pela regra 70/20/10 (núcleo /
          crescimento / experimento).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Orçamento total (R$)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            disabled={isPending}
            className="w-48 rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="10000"
          />
        </label>

        {violations && violations.length > 0 ? (
          <Button
            onClick={() => generate(true)}
            disabled={isPending || !acknowledged}
            aria-disabled={!acknowledged}
          >
            {isPending ? "Gerando..." : "Confirmar ciente dos riscos"}
          </Button>
        ) : (
          <Button onClick={() => generate(false)} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar carteira"}
          </Button>
        )}
      </div>

      {violations && violations.length > 0 ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-200"
        >
          <p className="font-medium">
            Esta carteira viola {violations.length}{" "}
            {violations.length === 1 ? "guardrail" : "guardrails"} de risco:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {violations.map((v, i) => (
              <li key={`${v.type}-${v.entityKey}-${i}`}>{v.message}</li>
            ))}
          </ul>
          <label className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={isPending}
              className="h-4 w-4 rounded border-zinc-400"
            />
            <span>Estou ciente dos riscos e quero salvar esta carteira mesmo assim.</span>
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-700 dark:text-green-400" aria-live="polite">
          {success}
        </p>
      ) : null}
    </div>
  );
}
