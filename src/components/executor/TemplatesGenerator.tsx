"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  generateWhatsAppTemplates,
  type GenerateTemplatesResult,
} from "@/app/app/executor/templates/actions";
import type { WhatsAppTemplate } from "@/lib/executor/copy";

/**
 * Gerador + lista de templates (Story 8.2 — AC5). Botão "Gerar templates" dispara a
 * Server Action (LLM com fallback); cada template é exibido como preview editável.
 */
export function TemplatesGenerator({
  initial,
}: {
  initial: (WhatsAppTemplate & { id: string })[];
}) {
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const res: GenerateTemplatesResult = await generateWhatsAppTemplates();
      if (res.ok) {
        setStatus(`Templates gerados (${res.source === "llm" ? "LLM" : "fallback"}).`);
        // Recarrega a lista do servidor.
        location.reload();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button onClick={generate} disabled={isPending}>
          {isPending ? "Gerando..." : "Gerar templates"}
        </Button>
        {status ? (
          <span className="text-sm text-green-700 dark:text-green-400" aria-live="polite">
            {status}
          </span>
        ) : null}
        {error ? (
          <span className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Nenhum template gerado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <article
              key={t.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{t.name}</h3>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {t.category}
                </span>
              </div>
              {t.headerText ? (
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t.headerText}
                </p>
              ) : null}
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{t.bodyText}</p>
              {t.footerText ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">{t.footerText}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
