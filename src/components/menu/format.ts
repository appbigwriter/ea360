/**
 * Formatação de exibição do menu (Story 4.5).
 *
 * Funções PURAS de apresentação das métricas financeiras (Story 4.3) em pt-BR.
 * Mantidas isoladas para reuso entre os cards e a página de detalhe.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Formata um valor monetário em BRL (ex.: 10000 => "R$ 10.000"). */
export function formatBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return BRL.format(safe);
}

/** Formata a faixa de retorno estimada (ex.: "R$ 5.000 – R$ 30.000"). */
export function formatReturnRange(min: number, max: number): string {
  return `${formatBRL(min)} – ${formatBRL(max)}`;
}

/** Formata o payback em meses (ex.: 3 => "3 meses", 1 => "1 mês"). */
export function formatPayback(months: number): string {
  const safe = Number.isFinite(months) ? Math.round(months) : 0;
  return safe === 1 ? "1 mês" : `${safe} meses`;
}
