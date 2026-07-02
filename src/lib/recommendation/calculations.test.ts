import { describe, it, expect } from "vitest";
import {
  round2,
  calcEstimatedSpend,
  calcPaybackMonths,
  calcReturnRange,
  calcRiskScore,
  calcChannelFinancials,
} from "./calculations";

describe("round2 (AC7)", () => {
  it("arredonda para 2 casas decimais", () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(10)).toBe(10);
  });

  it("coage valores não-finitos para 0", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("calcEstimatedSpend (AC2)", () => {
  it("cost_score=5 com budget=10000 consome o orçamento inteiro", () => {
    expect(calcEstimatedSpend(10000, 5)).toBe(10000);
  });

  it("escala proporcional ao cost_score", () => {
    expect(calcEstimatedSpend(10000, 1)).toBe(2000);
    expect(calcEstimatedSpend(10000, 3)).toBe(6000);
  });

  it("orçamento inválido/negativo vira 0", () => {
    expect(calcEstimatedSpend(-100, 5)).toBe(0);
    expect(calcEstimatedSpend(Number.NaN, 5)).toBe(0);
  });

  it("clampa cost_score fora de 1..5", () => {
    expect(calcEstimatedSpend(10000, 9)).toBe(10000);
    expect(calcEstimatedSpend(10000, 0)).toBe(2000);
  });
});

describe("calcPaybackMonths (AC4)", () => {
  it("payback_score=5 => 3 meses (retorno rápido)", () => {
    expect(calcPaybackMonths(5)).toBe(3);
  });

  it("payback_score=1 => 15 meses (longo prazo)", () => {
    expect(calcPaybackMonths(1)).toBe(15);
  });
});

describe("calcReturnRange (AC3)", () => {
  it("faixa = [0.5x, 3x] do gasto estimado", () => {
    expect(calcReturnRange(10000)).toEqual({ min: 5000, max: 30000 });
  });

  it("gasto zero/negativo produz faixa zerada", () => {
    expect(calcReturnRange(0)).toEqual({ min: 0, max: 0 });
    expect(calcReturnRange(-5)).toEqual({ min: 0, max: 0 });
  });
});

describe("calcRiskScore (AC5)", () => {
  it("risk_score=1 do canal => 1 no item", () => {
    expect(calcRiskScore(1)).toBe(1);
  });

  it("repassa e clampa em 1..5", () => {
    expect(calcRiskScore(5)).toBe(5);
    expect(calcRiskScore(7)).toBe(5);
  });
});

describe("calcChannelFinancials (AC1)", () => {
  it("calcula todas as métricas e arredonda (2 casas)", () => {
    const result = calcChannelFinancials(10000, {
      cost_score: 5,
      payback_score: 5,
      risk_score: 1,
    });
    expect(result).toEqual({
      estimated_spend: 10000,
      return_range_min: 5000,
      return_range_max: 30000,
      payback_months: 3,
      risk_score: 1,
    });
  });

  it("todos os valores têm no máximo 2 casas decimais (AC7)", () => {
    const result = calcChannelFinancials(3333.33, {
      cost_score: 3,
      payback_score: 2,
      risk_score: 4,
    });
    for (const v of Object.values(result)) {
      expect(Number.isFinite(v)).toBe(true);
      expect(round2(v)).toBe(v);
    }
  });
});
