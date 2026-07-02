"use client";

import { useMemo, useState } from "react";
import type { GomChannel } from "@/app/gom/queries";
import { cn } from "@/lib/utils";
import { ChannelList } from "./ChannelList";
import { GomCommandPalette } from "./GomCommandPalette";
import { useDebouncedValue } from "./useDebouncedValue";

type SortKey = "name" | "cost_asc" | "payback_desc" | "risk_asc" | "scale_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Nome (A–Z)" },
  { value: "cost_asc", label: "Custo (crescente)" },
  { value: "payback_desc", label: "Payback (mais rápido)" },
  { value: "risk_asc", label: "Risco (menor primeiro)" },
  { value: "scale_desc", label: "Escala (maior primeiro)" },
];

const ALL_PILLARS = "__all__";

function deriveLabel(channel: GomChannel): string {
  return `${channel.name} ${channel.description ?? ""} ${channel.category_name}`.toLowerCase();
}

export function GomBrowser({ channels }: { channels: GomChannel[] }) {
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState<string>(ALL_PILLARS);
  const [sort, setSort] = useState<SortKey>("name");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Pilares distintos para os chips de filtro (AC3), na ordem de aparição.
  const pillars = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of channels) {
      if (!seen.has(c.pillar_id)) seen.set(c.pillar_id, c.pillar_name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [channels]);

  const visible = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    let result = channels.filter((c) => {
      const matchesPillar = pillar === ALL_PILLARS || c.pillar_id === pillar;
      const matchesSearch = term === "" || deriveLabel(c).includes(term);
      return matchesPillar && matchesSearch;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "cost_asc":
          return a.cost_score - b.cost_score || a.name.localeCompare(b.name);
        case "payback_desc":
          return b.payback_score - a.payback_score || a.name.localeCompare(b.name);
        case "risk_asc":
          return a.risk_score - b.risk_score || a.name.localeCompare(b.name);
        case "scale_desc":
          return b.scale_score - a.scale_score || a.name.localeCompare(b.name);
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [channels, debouncedSearch, pillar, sort]);

  function focusChannel(channel: GomChannel) {
    // Garante que o canal selecionado no palette fique visível: limpa filtros
    // que poderiam escondê-lo e o destaca.
    setPillar(ALL_PILLARS);
    setSearch("");
    setHighlightedId(channel.id);
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document
          .getElementById(`channel-anchor-${channel.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  return (
    <div>
      {/* Controles: busca, filtro por pilar, ordenação */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar canal por nome..."
            aria-label="Buscar canal por nome"
            className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="gom-sort"
              className="text-sm whitespace-nowrap text-zinc-500 dark:text-zinc-400"
            >
              Ordenar por
            </label>
            <select
              id="gom-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chips de pilar (AC3) */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por pilar">
          <PillarChip active={pillar === ALL_PILLARS} onClick={() => setPillar(ALL_PILLARS)}>
            Todos
          </PillarChip>
          {pillars.map((p) => (
            <PillarChip key={p.id} active={pillar === p.id} onClick={() => setPillar(p.id)}>
              {p.name}
            </PillarChip>
          ))}
        </div>
      </div>

      <ChannelList channels={visible} highlightedId={highlightedId} />

      <GomCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        channels={channels}
        onSelectChannel={focusChannel}
      />
    </div>
  );
}

function PillarChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 bg-transparent text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      )}
    >
      {children}
    </button>
  );
}
