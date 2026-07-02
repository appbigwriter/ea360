"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráfico real vs. projetado por canal (Story 7.3 — AC2, AC3, AC6).
 *
 * Barras agrupadas (recharts, PRD §7): projetado vs. real (spend). A barra "real"
 * é colorida por performance (AC6): verde se real >= projetado; vermelho se real <
 * projetado em mais de 20%; amarelo caso contrário.
 */
export type ChannelComparison = {
  name: string;
  projected: number | null;
  real: number | null;
};

export function RealVsProjectedChart({ data }: { data: ChannelComparison[] }) {
  const rows = data.map((d) => ({
    name: d.name,
    Projetado: d.projected ?? 0,
    Real: d.real ?? 0,
    realColor: colorFor(d.real, d.projected),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Projetado" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Real" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.realColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** AC6: verde se real >= projetado; vermelho se real < 0.8x projetado; amarelo ok. */
function colorFor(real: number | null, projected: number | null): string {
  if (real === null || projected === null || projected === 0) return "#a1a1aa";
  if (real >= projected) return "#16a34a";
  if (real < projected * 0.8) return "#dc2626";
  return "#eab308";
}
