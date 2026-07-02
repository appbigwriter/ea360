"use client";

import { useId } from "react";
import type { KillCriteriaInput } from "@/lib/allocation/kill-criteria";

/**
 * Formulário de kill-criteria de UM canal de experimento (Story 5.6 — AC2, AC5).
 *
 * Campos (AC2): `hypothesis` (o que está testando), `kill_criteria` (condição de
 * corte), `target_metric` + `target_value`, `deadline`. `hypothesis` e
 * `kill_criteria` são obrigatórios (NOT NULL em `experiments` / AC3); os demais são
 * opcionais (colunas nullable da migração 0015 — No Invention, Article IV).
 *
 * Componente CONTROLADO: o estado vive no container (`ExperimentKillCriteriaSection`),
 * que reúne as entradas de todos os canais de experimento e submete em batch. Estilo
 * alinhado ao `GenerateAllocationButton` (inputs nativos + Tailwind) para reuso visual.
 */

type Props = {
  /** id do `allocation_items` (FK destino em `experiments`). */
  allocationItemId: string;
  /** Rótulo amigável do canal (ex.: nome ou id curto). */
  channelLabel: string;
  /** Verba alocada ao canal (R$), exibida como contexto. */
  amount?: number;
  /** Valores atuais do formulário. */
  value: KillCriteriaInput;
  /** Callback de mudança (atualiza o estado do container). */
  onChange: (allocationItemId: string, next: KillCriteriaInput) => void;
  /** Desabilita os campos durante a submissão. */
  disabled?: boolean;
  /** Mensagem de erro específica deste canal (AC3), quando bloqueado. */
  error?: string | null;
};

export function KillCriteriaForm({
  allocationItemId,
  channelLabel,
  amount,
  value,
  onChange,
  disabled = false,
  error = null,
}: Props) {
  const baseId = useId();

  function update(patch: Partial<KillCriteriaInput>) {
    onChange(allocationItemId, { ...value, ...patch });
  }

  const fieldClass =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-4 dark:border-amber-700 dark:bg-amber-950/20"
      aria-labelledby={`${baseId}-title`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${baseId}-title`} className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Experimento: {channelLabel}
        </h3>
        {typeof amount === "number" ? (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            R${amount.toLocaleString("pt-BR")}
          </span>
        ) : null}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">
          Hipótese <span className="text-red-600">*</span>
        </span>
        <textarea
          id={`${baseId}-hypothesis`}
          value={value.hypothesis}
          onChange={(e) => update({ hypothesis: e.target.value })}
          disabled={disabled}
          rows={2}
          required
          className={fieldClass}
          placeholder="O que você está testando neste canal?"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700 dark:text-zinc-300">
          Critério de corte (kill-criteria) <span className="text-red-600">*</span>
        </span>
        <textarea
          id={`${baseId}-kill`}
          value={value.killCriteria}
          onChange={(e) => update({ killCriteria: e.target.value })}
          disabled={disabled}
          rows={2}
          required
          className={fieldClass}
          placeholder='Ex.: "Se CPA > R$50 após 30 dias, encerrar o canal."'
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Métrica-alvo</span>
          <input
            type="text"
            value={value.targetMetric ?? ""}
            onChange={(e) => update({ targetMetric: e.target.value })}
            disabled={disabled}
            className={fieldClass}
            placeholder="Ex.: CPA, ROAS, CTR"
          />
        </label>

        <label className="flex w-32 flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Valor-alvo</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={value.targetValue ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              update({ targetValue: raw === "" ? null : Number(raw) });
            }}
            disabled={disabled}
            className={fieldClass}
            placeholder="50"
          />
        </label>

        <label className="flex w-44 flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Deadline</span>
          <input
            type="date"
            value={value.deadline ?? ""}
            onChange={(e) => update({ deadline: e.target.value === "" ? null : e.target.value })}
            disabled={disabled}
            className={fieldClass}
          />
        </label>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
