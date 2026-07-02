import { describe, it, expect } from "vitest";
import {
  validateKillCriteria,
  assertExperimentsHaveKillCriteria,
  toExperimentRow,
  KillCriteriaError,
  type KillCriteriaEntry,
} from "./kill-criteria";

/** Data fixa de referência para deadlines determinísticos. */
const NOW = new Date("2026-06-27T12:00:00");
const FUTURE = "2026-12-31";
const PAST = "2026-01-01";

describe("validateKillCriteria (Story 5.6 AC2, AC3)", () => {
  it("aceita kill-criteria completo e válido", () => {
    expect(() =>
      validateKillCriteria(
        {
          hypothesis: "TikTok converte para o nicho",
          killCriteria: "CPA > R$50 após 30 dias",
          targetMetric: "CPA",
          targetValue: 50,
          deadline: FUTURE,
        },
        NOW
      )
    ).not.toThrow();
  });

  it("bloqueia quando hypothesis está vazia (AC3)", () => {
    expect(() =>
      validateKillCriteria({ hypothesis: "   ", killCriteria: "corta se ruim" }, NOW)
    ).toThrow(KillCriteriaError);
  });

  it("bloqueia quando killCriteria está vazio (AC3)", () => {
    expect(() => validateKillCriteria({ hypothesis: "teste", killCriteria: "" }, NOW)).toThrow(
      KillCriteriaError
    );
  });

  it("rejeita deadline no passado (Dev Note: deadline deve ser futura)", () => {
    expect(() =>
      validateKillCriteria({ hypothesis: "teste", killCriteria: "corta", deadline: PAST }, NOW)
    ).toThrow(/futura/i);
  });

  it("rejeita deadline com formato inválido", () => {
    expect(() =>
      validateKillCriteria({ hypothesis: "teste", killCriteria: "corta", deadline: "amanhã" }, NOW)
    ).toThrow(KillCriteriaError);
  });

  it("aceita ausência de deadline/targetMetric/targetValue (opcionais)", () => {
    expect(() =>
      validateKillCriteria({ hypothesis: "teste", killCriteria: "corta" }, NOW)
    ).not.toThrow();
  });

  it("rejeita targetValue negativo", () => {
    expect(() =>
      validateKillCriteria({ hypothesis: "teste", killCriteria: "corta", targetValue: -1 }, NOW)
    ).toThrow(KillCriteriaError);
  });
});

describe("assertExperimentsHaveKillCriteria (Story 5.6 AC1, AC3, AC6)", () => {
  const validEntry = (id: string): KillCriteriaEntry => ({
    allocationItemId: id,
    hypothesis: "h",
    killCriteria: "k",
    deadline: FUTURE,
  });

  it("passa quando todos os experimentos têm kill-criteria (AC1)", () => {
    const result = assertExperimentsHaveKillCriteria(
      ["exp-1", "exp-2"],
      [validEntry("exp-1"), validEntry("exp-2")],
      NOW
    );
    expect(result).toHaveLength(2);
  });

  it("bloqueia e lista ids faltantes quando falta kill-criteria (AC3)", () => {
    try {
      assertExperimentsHaveKillCriteria(["exp-1", "exp-2"], [validEntry("exp-1")], NOW);
      throw new Error("deveria ter lançado");
    } catch (err) {
      expect(err).toBeInstanceOf(KillCriteriaError);
      expect((err as KillCriteriaError).missingItemIds).toEqual(["exp-2"]);
    }
  });

  it("bloqueia quando um experimento tem kill-criteria inválido (AC3)", () => {
    const invalid: KillCriteriaEntry = {
      allocationItemId: "exp-2",
      hypothesis: "",
      killCriteria: "",
    };
    expect(() =>
      assertExperimentsHaveKillCriteria(["exp-1", "exp-2"], [validEntry("exp-1"), invalid], NOW)
    ).toThrow(KillCriteriaError);
  });

  it("não exige nada quando não há canais de experimento (AC6)", () => {
    const result = assertExperimentsHaveKillCriteria([], [], NOW);
    expect(result).toEqual([]);
  });
});

describe("toExperimentRow (Story 5.6 AC4)", () => {
  it("normaliza para o formato da tabela experiments", () => {
    const row = toExperimentRow({
      allocationItemId: "item-1",
      hypothesis: "  testar  ",
      killCriteria: "  corta  ",
      targetMetric: "  CPA  ",
      targetValue: 50,
      deadline: FUTURE,
    });
    expect(row).toEqual({
      allocation_item_id: "item-1",
      hypothesis: "testar",
      kill_criteria: "corta",
      target_metric: "CPA",
      target_value: 50,
      deadline: FUTURE,
      status: "active",
    });
  });

  it("converte opcionais vazios em null", () => {
    const row = toExperimentRow({
      allocationItemId: "item-1",
      hypothesis: "h",
      killCriteria: "k",
      targetMetric: "",
      targetValue: null,
      deadline: "",
    });
    expect(row.target_metric).toBeNull();
    expect(row.target_value).toBeNull();
    expect(row.deadline).toBeNull();
  });
});
