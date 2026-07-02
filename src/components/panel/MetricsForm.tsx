"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveChannelMetrics, type ActiveChannel } from "@/app/app/panel/metrics/actions";

/**
 * Formulário de ingest manual de métricas por canal (Story 7.2 — AC1, AC3).
 *
 * Validações client-side espelham as server-side (spend >= 0, period_end >= start).
 * Submete via Server Action `saveChannelMetrics` (AC2). Múltiplos registros por
 * canal/período são permitidos (AC4 — histórico).
 */
export function MetricsForm({ channels }: { channels: ActiveChannel[] }) {
  const [isPending, startTransition] = useTransition();
  const [allocationItemId, setAllocationItemId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [spendActual, setSpendActual] = useState("");
  const [roas, setRoas] = useState("");
  const [cpa, setCpa] = useState("");
  const [paybackActual, setPaybackActual] = useState("");
  const [contribution, setContribution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (channels.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Gere uma carteira primeiro para registrar métricas dos canais.
      </p>
    );
  }

  function submit() {
    setError(null);
    setSuccess(null);

    const selected = channels.find((c) => c.allocationItemId === allocationItemId);
    if (!selected) {
      setError("Selecione um canal.");
      return;
    }
    const spend = Number(spendActual);
    if (!Number.isFinite(spend) || spend < 0) {
      setError("O gasto real deve ser maior ou igual a zero.");
      return;
    }
    if (!periodStart || !periodEnd || new Date(periodEnd) < new Date(periodStart)) {
      setError("Informe um período válido (final >= inicial).");
      return;
    }

    const num = (v: string): number | null => {
      if (v.trim() === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    startTransition(async () => {
      const res = await saveChannelMetrics({
        allocationItemId: selected.allocationItemId,
        channelId: selected.channelId,
        periodStart,
        periodEnd,
        spendActual: spend,
        roas: num(roas),
        cpa: num(cpa),
        paybackActual: num(paybackActual),
        contribution: num(contribution),
      });
      if (res.ok) {
        setSuccess("Métrica registrada.");
        setSpendActual("");
        setRoas("");
        setCpa("");
        setPaybackActual("");
        setContribution("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700 dark:text-zinc-300">Canal</span>
          <select
            value={allocationItemId}
            onChange={(e) => setAllocationItemId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Selecione…</option>
            {channels.map((c) => (
              <option key={c.allocationItemId} value={c.allocationItemId}>
                {c.channelName}
              </option>
            ))}
          </select>
        </label>
        <DateField label="Início do período" value={periodStart} onChange={setPeriodStart} />
        <DateField label="Fim do período" value={periodEnd} onChange={setPeriodEnd} />
        <NumField label="Gasto real (R$)" value={spendActual} onChange={setSpendActual} required />
        <NumField label="ROAS" value={roas} onChange={setRoas} placeholder="3.5" />
        <NumField label="CPA (R$)" value={cpa} onChange={setCpa} />
        <NumField label="Payback real" value={paybackActual} onChange={setPaybackActual} />
        <NumField label="Contribuição (R$)" value={contribution} onChange={setContribution} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? "Salvando..." : "Registrar métrica"}
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-700 dark:text-zinc-300">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </label>
  );
}
