"use client";

import { useMemo, useState } from "react";
import type { MenuChannel } from "@/app/app/menu/queries";
import { MenuChannelCard } from "./ChannelCard";
import { SORT_OPTIONS, DEFAULT_SORT, sortChannels, type SortCriterion } from "./sort";

/**
 * Navegador do menu de canais (Story 4.5, AC1/AC3/AC7).
 *
 * Recebe os canais já carregados no servidor e oferece controles de ordenação
 * por critério (AC3) — match (padrão), custo, retorno e payback. A reordenação
 * é feita no client sobre o dataset (pequeno), sem novo round-trip. Renderiza um
 * grid responsivo de cards (AC7).
 */
export function MenuBrowser({ channels }: { channels: MenuChannel[] }) {
  const [criterion, setCriterion] = useState<SortCriterion>(DEFAULT_SORT);

  const sorted = useMemo(() => sortChannels(channels, criterion), [channels, criterion]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label htmlFor="menu-sort" className="text-sm text-zinc-600 dark:text-zinc-400">
          Ordenar por
        </label>
        <select
          id="menu-sort"
          value={criterion}
          onChange={(e) => setCriterion(e.target.value as SortCriterion)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-zinc-100"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((channel) => (
          <MenuChannelCard key={channel.id} channel={channel} />
        ))}
      </div>
    </div>
  );
}
