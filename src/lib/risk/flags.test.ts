import { describe, it, expect } from "vitest";
import {
  calculateChannelFlag,
  portfolioFlag,
  worstLevel,
  isCriticalViolation,
  type ChannelFlagInput,
} from "./flags";
import type { GuardrailViolation } from "@/lib/allocation/engine";

const ch = (over: Partial<ChannelFlagInput>): ChannelFlagInput => ({
  channelId: "c1",
  concentrationPct: 30,
  riskScore: 2,
  violations: [],
  ...over,
});

const violation = (over: Partial<GuardrailViolation>): GuardrailViolation => ({
  type: "channel_concentration",
  entityKey: "c1",
  limit: 40,
  actual: 45,
  unit: "pct",
  message: "canal acima do limite",
  ...over,
});

describe("calculateChannelFlag (AC1–AC4)", () => {
  it("AC2: verde quando conc < 40%, risk <= 2 e sem violações", () => {
    expect(calculateChannelFlag(ch({})).level).toBe("green");
    expect(calculateChannelFlag(ch({ concentrationPct: 0, riskScore: 1 })).level).toBe("green");
  });

  it("AC3: amarelo por concentração 40–60%", () => {
    expect(calculateChannelFlag(ch({ concentrationPct: 50 })).level).toBe("yellow");
    expect(calculateChannelFlag(ch({ concentrationPct: 40 })).level).toBe("yellow");
    expect(calculateChannelFlag(ch({ concentrationPct: 60 })).level).toBe("yellow");
  });

  it("AC4: vermelho por concentração > 60%", () => {
    expect(calculateChannelFlag(ch({ concentrationPct: 61 })).level).toBe("red");
    expect(calculateChannelFlag(ch({ concentrationPct: 70 })).level).toBe("red");
  });

  it("AC3: amarelo por risk_score = 3", () => {
    expect(calculateChannelFlag(ch({ riskScore: 3 })).level).toBe("yellow");
  });

  it("AC4: vermelho por risk_score >= 4", () => {
    expect(calculateChannelFlag(ch({ riskScore: 4 })).level).toBe("red");
    expect(calculateChannelFlag(ch({ riskScore: 5 })).level).toBe("red");
  });

  it("AC3: amarelo por violação de guardrail (aviso)", () => {
    const r = calculateChannelFlag(ch({ violations: [violation({ actual: 45, limit: 40 })] }));
    expect(r.level).toBe("yellow");
    expect(r.reasons.some((x) => x.includes("acima do limite"))).toBe(true);
  });

  it("AC4: vermelho por violação CRÍTICA (brecha >= 1.5x o limite)", () => {
    // limite 40, actual 70 => 70 >= 60 => crítica.
    const r = calculateChannelFlag(ch({ violations: [violation({ actual: 70, limit: 40 })] }));
    expect(r.level).toBe("red");
  });

  it("pior nível prevalece ao combinar sinais", () => {
    // conc verde (30) + risk 5 => vermelho.
    expect(calculateChannelFlag(ch({ concentrationPct: 30, riskScore: 5 })).level).toBe("red");
    // conc amarelo (50) + risk 4 => vermelho.
    expect(calculateChannelFlag(ch({ concentrationPct: 50, riskScore: 4 })).level).toBe("red");
  });

  it("valores não-finitos não elevam o nível (defensivo)", () => {
    expect(
      calculateChannelFlag(ch({ concentrationPct: Number.NaN, riskScore: Number.NaN })).level
    ).toBe("green");
  });
});

describe("isCriticalViolation", () => {
  it("crítica quando actual >= 1.5x o limite", () => {
    expect(isCriticalViolation(violation({ actual: 60, limit: 40 }))).toBe(true);
    expect(isCriticalViolation(violation({ actual: 45, limit: 40 }))).toBe(false);
  });
  it("nunca crítica com limite ausente/inválido", () => {
    expect(isCriticalViolation(violation({ actual: 999, limit: 0 }))).toBe(false);
  });
});

describe("worstLevel", () => {
  it("red > yellow > green", () => {
    expect(worstLevel("green", "yellow")).toBe("yellow");
    expect(worstLevel("yellow", "red")).toBe("red");
    expect(worstLevel("red", "green")).toBe("red");
  });
});

describe("portfolioFlag (AC5)", () => {
  it("verde quando todos os canais verdes", () => {
    const flags = [
      { channelId: "a", level: "green" as const, reasons: [] },
      { channelId: "b", level: "green" as const, reasons: [] },
    ];
    expect(portfolioFlag(flags).level).toBe("green");
  });

  it("amarelo se algum canal amarelo", () => {
    const flags = [
      { channelId: "a", level: "green" as const, reasons: [] },
      { channelId: "b", level: "yellow" as const, reasons: [] },
    ];
    expect(portfolioFlag(flags).level).toBe("yellow");
  });

  it("vermelho se algum canal vermelho", () => {
    const flags = [
      { channelId: "a", level: "red" as const, reasons: [] },
      { channelId: "b", level: "green" as const, reasons: [] },
    ];
    expect(portfolioFlag(flags).level).toBe("red");
  });

  it("violação de carteira (downside) eleva o farol mesmo sem canal vermelho", () => {
    const flags = [{ channelId: "a", level: "green" as const, reasons: [] }];
    const v = [
      violation({ type: "downside_total", entityKey: "portfolio", actual: 70, limit: 40 }),
    ];
    expect(portfolioFlag(flags, v).level).toBe("red");
  });
});
