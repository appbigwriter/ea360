"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KillCriteriaForm } from "./KillCriteriaForm";
import { saveAllKillCriteria } from "@/app/app/allocation/kill-criteria-actions";
import type { ExperimentChannelInfo } from "@/app/app/allocation/kill-criteria-actions";
import type { KillCriteriaInput, KillCriteriaEntry } from "@/lib/allocation/kill-criteria";

/**
 * Seção de kill-criteria obrigatório por experimento (Story 5.6 — AC1, AC3, AC5, AC6).
 *
 * Exibida APÓS a confirmação da alocação (Story 5.2). Renderiza um `KillCriteriaForm`
 * por canal de faixa "experiment" (AC5). Canais "core"/"growth" não geram formulário
 * (AC6) — quando não há experimentos, a seção não é renderizada.
 *
 * Ao confirmar, submete TODOS os kill-criteria via `saveAllKillCriteria`. Se algum
 * canal estiver sem hipótese/critério de corte, a Server Action bloqueia com erro
 * descritivo e marca os canais faltantes (AC3).
 */

type Props = {
  /** id da alocação confirmada (Story 5.2). */
  allocationId: string;
  /** Canais de experimento que exigem kill-criteria (de `listExperimentChannels`). */
  experimentChannels: ExperimentChannelInfo[];
  /** Callback opcional após sucesso. */
  onSaved?: (savedCount: number) => void;
};

/** Estado inicial vazio de um kill-criteria. */
const EMPTY: KillCriteriaInput = {
  hypothesis: "",
  killCriteria: "",
  targetMetric: "",
  targetValue: null,
  deadline: null,
};

export function ExperimentKillCriteriaSection({
  allocationId,
  experimentChannels,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [forms, setForms] = useState<Record<string, KillCriteriaInput>>(() =>
    Object.fromEntries(experimentChannels.map((c) => [c.allocationItemId, { ...EMPTY }]))
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

  // AC6: sem canais de experimento => nada a exigir; a seção desaparece.
  if (experimentChannels.length === 0) {
    return null;
  }

  function handleChange(allocationItemId: string, next: KillCriteriaInput) {
    setForms((prev) => ({ ...prev, [allocationItemId]: next }));
  }

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    setMissingIds(new Set());

    const entries: KillCriteriaEntry[] = experimentChannels.map((c) => ({
      allocationItemId: c.allocationItemId,
      ...forms[c.allocationItemId],
    }));

    startTransition(async () => {
      const res = await saveAllKillCriteria(allocationId, entries);
      if (res.ok) {
        setSuccess(
          `Kill-criteria salvo para ${res.savedCount} experimento(s). Alocação confirmada.`
        );
        onSaved?.(res.savedCount);
      } else {
        setError(res.error);
        if (res.missingItemIds) setMissingIds(new Set(res.missingItemIds));
      }
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Kill-criteria dos experimentos
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Cada canal na faixa de experimento precisa de um critério de corte para você saber quando
          parar de investir. O preenchimento é obrigatório para confirmar a alocação.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {experimentChannels.map((c) => (
          <KillCriteriaForm
            key={c.allocationItemId}
            allocationItemId={c.allocationItemId}
            channelLabel={c.channelId}
            amount={c.amount}
            value={forms[c.allocationItemId] ?? EMPTY}
            onChange={handleChange}
            disabled={isPending}
            error={
              missingIds.has(c.allocationItemId)
                ? "Preencha hipótese e critério de corte (e um deadline futuro válido)."
                : null
            }
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Salvando..." : "Confirmar experimentos"}
        </Button>
      </div>

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
    </section>
  );
}
