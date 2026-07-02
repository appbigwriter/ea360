"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveGuardrailConfig, type GuardrailConfigResult } from "@/app/app/allocation/actions";
import type { GuardrailConfig } from "@/lib/allocation/engine";

/**
 * Configurador de guardrails de risco (Story 6.3 — AC1, AC6).
 *
 * Formulário com os 5 guardrails personalizáveis. Campos vazios = regra inativa
 * (No Invention — não inventamos limites). Ao salvar, a Server Action
 * `saveGuardrailConfig` sanitiza (descarta valores fora de 0..100) e persiste em
 * `allocations.guardrail_config` da carteira mais recente (AC2). A configuração
 * persiste entre sessões (AC testing). Guardrails avisam, não bloqueiam (AC4/AC5).
 */
type Props = {
  initial: GuardrailConfigResult;
};

/** Campo numérico opcional: string vazia => null (regra inativa). */
type Form = {
  maxPillarConcentrationPct: string;
  maxChannelConcentrationPct: string;
  minPillarPct: string;
  maxDownsideAmount: string;
  maxDownsidePct: string;
};

function toForm(c: GuardrailConfig): Form {
  const f = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    maxPillarConcentrationPct: f(c.maxPillarConcentrationPct),
    maxChannelConcentrationPct: f(c.maxChannelConcentrationPct),
    minPillarPct: f(c.minPillarPct),
    maxDownsideAmount: f(c.maxDownsideAmount),
    maxDownsidePct: f(c.maxDownsidePct),
  };
}

export function GuardrailSettings({ initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(() => toForm(initial.config));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSuccess(null);
    setError(null);
  };

  function handleSave() {
    setError(null);
    setSuccess(null);
    const num = (v: string) => {
      if (v.trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const config: GuardrailConfig = {
      maxPillarConcentrationPct: num(form.maxPillarConcentrationPct),
      maxChannelConcentrationPct: num(form.maxChannelConcentrationPct),
      minPillarPct: num(form.minPillarPct),
      maxDownsideAmount: num(form.maxDownsideAmount),
      maxDownsidePct: num(form.maxDownsidePct),
    };
    startTransition(async () => {
      const res = await saveGuardrailConfig(config);
      if (res.ok) {
        setSuccess("Guardrails salvos. Eles serão aplicados na próxima carteira gerada.");
      } else {
        setError(res.error ?? "Não foi possível salvar os guardrails.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Guardrails de risco</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Defina limites personalizados. Deixe um campo em branco para desativar aquela regra. Os
          guardrails <strong>avisam</strong>, não bloqueiam — você pode salvar uma carteira mesmo
          com violações, confirmando que está ciente dos riscos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Concentração máx. por pilar (%)"
          value={form.maxPillarConcentrationPct}
          onChange={set("maxPillarConcentrationPct")}
          placeholder="60"
          hint="Ex.: 60 limita qualquer pilar a 60% do orçamento."
        />
        <Field
          label="Concentração máx. por canal (%)"
          value={form.maxChannelConcentrationPct}
          onChange={set("maxChannelConcentrationPct")}
          placeholder="40"
          hint="Ex.: 40 limita qualquer canal a 40% do orçamento."
        />
        <Field
          label="Investimento mínimo por pilar (%)"
          value={form.minPillarPct}
          onChange={set("minPillarPct")}
          placeholder="10"
          hint="Ex.: 10 garante ao menos 10% em cada pilar presente."
        />
        <Field
          label="Downside total máx. (R$)"
          value={form.maxDownsideAmount}
          onChange={set("maxDownsideAmount")}
          placeholder="5000"
          hint="Perda máxima tolerada da carteira, em reais."
        />
        <Field
          label="Downside total máx. (% do orçamento)"
          value={form.maxDownsidePct}
          onChange={set("maxDownsidePct")}
          placeholder="50"
          hint="Ex.: 50 limita a perda projetada a 50% do orçamento."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar guardrails"}
        </Button>
        {success ? (
          <span className="text-sm text-green-700 dark:text-green-400" aria-live="polite">
            {success}
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {hint ? <span className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</span> : null}
    </label>
  );
}
