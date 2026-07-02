"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveFunnel, type SaveFunnelResult } from "@/app/app/executor/funnel/actions";
import type { FunnelStructure } from "@/lib/executor/funnel";

/**
 * Builder do funil CTWA (Story 8.1 — AC1, AC3, AC5, AC6). Formulário de configuração
 * + visualização das etapas geradas. `bot_disclosure` é obrigatório (AC6).
 */
export function FunnelBuilder({
  initial,
  initialFunnelId,
}: {
  initial: FunnelStructure | null;
  initialFunnelId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [structure, setStructure] = useState<FunnelStructure | null>(initial);
  const [funnelId, setFunnelId] = useState<string | undefined>(initialFunnelId);
  const [objective, setObjective] = useState("");
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [cta, setCta] = useState("");
  const [botDisclosure, setBotDisclosure] = useState(
    "Sou uma assistente virtual. Posso te ajudar agora?"
  );
  const [escapeKeyword, setEscapeKeyword] = useState("HUMANO");
  const [escapeHandoff, setEscapeHandoff] = useState("Transferindo para nossa equipe...");
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res: SaveFunnelResult = await saveFunnel({
        objective,
        product,
        audience,
        cta,
        botDisclosure,
        humanEscapeConfig: {
          keyword: escapeKeyword,
          handoffMessage: escapeHandoff,
        },
      });
      if (res.ok) {
        setStructure(res.structure);
        setFunnelId(res.funnelId);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-5 sm:grid-cols-2 dark:border-zinc-800">
        <Field label="Objetivo da campanha" value={objective} onChange={setObjective} />
        <Field label="Produto/serviço" value={product} onChange={setProduct} />
        <Field label="Público-alvo" value={audience} onChange={setAudience} />
        <Field label="CTA principal" value={cta} onChange={setCta} />
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-700 dark:text-zinc-300">
            Identificação do bot (bot_disclosure) *
          </span>
          <input
            value={botDisclosure}
            onChange={(e) => setBotDisclosure(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>

        <div className="col-span-1 mt-2 border-t border-zinc-200 pt-4 sm:col-span-2 dark:border-zinc-800">
          <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Escape Humano
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Palavra-chave de Escape"
              value={escapeKeyword}
              onChange={setEscapeKeyword}
            />
            <Field label="Mensagem de Handoff" value={escapeHandoff} onChange={setEscapeHandoff} />
          </div>
        </div>

        <div className="mt-2 sm:col-span-2">
          <Button onClick={generate} disabled={isPending}>
            {isPending ? "Gerando..." : "Gerar funil"}
          </Button>
          {error ? (
            <span className="ml-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      {structure ? (
        <ol className="flex flex-col gap-3">
          {structure.stages.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500">Etapa {i + 1}</p>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.description}</p>
            </li>
          ))}
        </ol>
      ) : null}

      {funnelId ? (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" asChild>
            <a href={`/api/executor/export-n8n?funnelId=${funnelId}`} download>
              Exportar para n8n
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </label>
  );
}
