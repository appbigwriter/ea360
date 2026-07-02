import { FLAG_STYLE, type FlagLevel } from "@/lib/risk/flags";

/**
 * Ponto colorido de farol de risco (Story 6.4 — AC: componente `RiskFlag`).
 *
 * Exibe o nível (verde/amarelo/vermelho) como um círculo, com `title` (tooltip nativo)
 * contendo a razão legível (AC: "Tooltip com razão do faról"). Tamanho configurável
 * para uso em linha (canal) ou destacado (header da carteira).
 */
type Props = {
  level: FlagLevel;
  reasons?: string[];
  size?: "sm" | "md";
  label?: string;
};

export function RiskFlag({ level, reasons, size = "sm", label }: Props) {
  const style = FLAG_STYLE[level];
  const dim = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const tip = reasons && reasons.length > 0 ? reasons.join(" • ") : style.label;
  return (
    <span className="inline-flex items-center gap-1.5" title={tip}>
      <span
        role="img"
        aria-label={style.label}
        className={`inline-block ${dim} rounded-full ${style.dot}`}
      />
      {label ? <span className={`text-xs font-medium ${style.text}`}>{label}</span> : null}
    </span>
  );
}
