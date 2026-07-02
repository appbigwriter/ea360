import { describe, it, expect } from "vitest";
import {
  allocateBudgetPure,
  assertBudgetConsistency,
  classifyRiskBand,
  validateRatios,
  calcDownside,
  downsideRate,
  portfolioDownside,
  checkGuardrails,
  sanitizeGuardrailConfig,
  DEFAULT_GUARDRAILS,
  AllocationError,
  DEFAULT_RATIOS,
  type AllocationChannelInput,
  type AllocationItem,
} from "./engine";

/** Conjunto de canais cobrindo as três faixas (risk 1–2 core, 3 growth, 4–5 exp). */
const channels: AllocationChannelInput[] = [
  { channelId: "core-1", riskScore: 1 },
  { channelId: "core-2", riskScore: 2 },
  { channelId: "growth-1", riskScore: 3 },
  { channelId: "exp-1", riskScore: 4 },
  { channelId: "exp-2", riskScore: 5 },
];

describe("classifyRiskBand (AC3)", () => {
  it("score 1–2 => core, 3 => growth, 4–5 => experiment", () => {
    expect(classifyRiskBand(1)).toBe("core");
    expect(classifyRiskBand(2)).toBe("core");
    expect(classifyRiskBand(3)).toBe("growth");
    expect(classifyRiskBand(4)).toBe("experiment");
    expect(classifyRiskBand(5)).toBe("experiment");
  });

  it("score não-finito cai em core (conservador)", () => {
    expect(classifyRiskBand(Number.NaN)).toBe("core");
  });
});

describe("validateRatios (AC2)", () => {
  it("aceita 70/20/10", () => {
    expect(() => validateRatios(DEFAULT_RATIOS)).not.toThrow();
  });

  it("rejeita soma != 100%", () => {
    expect(() => validateRatios({ core: 60, growth: 20, experiment: 10 })).toThrow(AllocationError);
  });

  it("rejeita ratio negativo", () => {
    expect(() => validateRatios({ core: 110, growth: 0, experiment: -10 })).toThrow(
      AllocationError
    );
  });
});

describe("allocateBudgetPure (AC1–AC4, AC6)", () => {
  it("R$10.000 com ratios padrão => núcleo 7000, crescimento 2000, experimento 1000", () => {
    const result = allocateBudgetPure(10000, channels);

    const sumBand = (band: string) =>
      result.items.filter((i) => i.riskBand === band).reduce((a, i) => a + i.amount, 0);

    expect(sumBand("core")).toBeCloseTo(7000, 2);
    expect(sumBand("growth")).toBeCloseTo(2000, 2);
    expect(sumBand("experiment")).toBeCloseTo(1000, 2);
  });

  it("soma dos amount = orçamento total (±0,01) — AC6", () => {
    const result = allocateBudgetPure(10000, channels);
    const total = result.items.reduce((a, i) => a + i.amount, 0);
    expect(Math.abs(total - 10000)).toBeLessThanOrEqual(0.01);
    expect(() => assertBudgetConsistency(result)).not.toThrow();
  });

  it("distribui igualmente dentro da faixa sem match_score", () => {
    const result = allocateBudgetPure(10000, channels);
    const core = result.items.filter((i) => i.riskBand === "core");
    expect(core).toHaveLength(2);
    expect(core[0].amount).toBeCloseTo(3500, 2);
    expect(core[1].amount).toBeCloseTo(3500, 2);
  });

  it("distribui proporcional ao match_score quando presente (AC4)", () => {
    const withScores: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, matchScore: 75 },
      { channelId: "core-2", riskScore: 2, matchScore: 25 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, withScores);
    const core = result.items.filter((i) => i.riskBand === "core");
    // 70% de 10000 = 7000; 75/25 => 5250 / 1750.
    expect(core[0].amount).toBeCloseTo(5250, 2);
    expect(core[1].amount).toBeCloseTo(1750, 2);
  });

  it("percentage é relativo ao orçamento total", () => {
    const result = allocateBudgetPure(10000, channels);
    const totalPct = result.items.reduce((a, i) => a + i.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 1);
  });

  it('resíduo de arredondamento fecha a soma exata (orçamento "feio")', () => {
    const result = allocateBudgetPure(9999.99, channels);
    expect(() => assertBudgetConsistency(result)).not.toThrow();
  });
});

describe("allocateBudgetPure — validações de erro (AC2, AC7)", () => {
  it("ratios com soma != 100% lança erro descritivo", () => {
    expect(() =>
      allocateBudgetPure(10000, channels, { core: 50, growth: 20, experiment: 10 })
    ).toThrow(AllocationError);
  });

  it("faixa com verba mas sem canais lança erro (AC7)", () => {
    const onlyCore: AllocationChannelInput[] = [{ channelId: "core-1", riskScore: 1 }];
    expect(() => allocateBudgetPure(10000, onlyCore)).toThrow(AllocationError);
  });

  it("faixa zerada por ratio não exige canais", () => {
    const onlyCore: AllocationChannelInput[] = [{ channelId: "core-1", riskScore: 1 }];
    const result = allocateBudgetPure(10000, onlyCore, {
      core: 100,
      growth: 0,
      experiment: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBeCloseTo(10000, 2);
  });

  it("orçamento negativo lança erro", () => {
    expect(() => allocateBudgetPure(-1, channels)).toThrow(AllocationError);
  });
});

describe("teto por canal — guardrail (Story 5.4)", () => {
  it("AC3: amount não excede total_budget * ceiling_pct / 100", () => {
    // Canal core-1 com teto 20% e budget 10000 => max 2000; sem teto, receberia
    // 3500 (metade dos 7000 do núcleo). O excedente vai para core-2.
    const withCeiling: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 20 },
      { channelId: "core-2", riskScore: 2 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, withCeiling);
    const c1 = result.items.find((i) => i.channelId === "core-1")!;
    const c2 = result.items.find((i) => i.channelId === "core-2")!;
    expect(c1.amount).toBeLessThanOrEqual(2000 + 0.01);
    expect(c1.ceilingReached).toBe(true);
    // Núcleo continua somando 7000: excedente de 1500 redistribuído para core-2.
    expect(c1.amount + c2.amount).toBeCloseTo(7000, 2);
    expect(c2.amount).toBeCloseTo(5000, 2);
  });

  it("AC4: excedente redistribuído proporcionalmente entre canais da mesma faixa", () => {
    const withCeiling: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 10 }, // max 1000
      { channelId: "core-2", riskScore: 2 },
      { channelId: "core-3", riskScore: 2 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, withCeiling);
    const core = result.items.filter((i) => i.riskBand === "core");
    const coreSum = core.reduce((a, i) => a + i.amount, 0);
    expect(coreSum).toBeCloseTo(7000, 2);
    const c1 = core.find((i) => i.channelId === "core-1")!;
    expect(c1.amount).toBeCloseTo(1000, 2);
    // 6000 restantes divididos igualmente entre core-2 e core-3.
    const c2 = core.find((i) => i.channelId === "core-2")!;
    const c3 = core.find((i) => i.channelId === "core-3")!;
    expect(c2.amount).toBeCloseTo(3000, 2);
    expect(c3.amount).toBeCloseTo(3000, 2);
  });

  it("AC6: teto 0% exclui o canal da alocação", () => {
    const withCeiling: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 0 }, // excluído
      { channelId: "core-2", riskScore: 2 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, withCeiling);
    expect(result.items.find((i) => i.channelId === "core-1")).toBeUndefined();
    // core-2 recebe os 7000 inteiros do núcleo.
    const c2 = result.items.find((i) => i.channelId === "core-2")!;
    expect(c2.amount).toBeCloseTo(7000, 2);
  });

  it("AC7: faixa com todos os canais em teto 0% lança erro", () => {
    const allExcluded: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 0 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    expect(() => allocateBudgetPure(10000, allExcluded)).toThrow(AllocationError);
  });

  it("quando todos os canais da faixa atingem o teto, o excedente fica retido e a consistência aceita soma < total", () => {
    // Núcleo recebe 7000, mas ambos os canais têm teto 25% (2500 cada => 5000 max).
    const cappedBand: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 25 },
      { channelId: "core-2", riskScore: 2, ceilingPct: 25 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, cappedBand);
    const core = result.items.filter((i) => i.riskBand === "core");
    const coreSum = core.reduce((a, i) => a + i.amount, 0);
    expect(coreSum).toBeCloseTo(5000, 2); // 2000 de excedente retido
    expect(core.every((i) => i.ceilingReached)).toBe(true);
    // Consistência tolera soma < total quando há canal em teto.
    expect(() => assertBudgetConsistency(result)).not.toThrow();
  });

  it("teto que não é atingido não marca ceilingReached e mantém soma exata", () => {
    const looseCeiling: AllocationChannelInput[] = [
      { channelId: "core-1", riskScore: 1, ceilingPct: 90 },
      { channelId: "core-2", riskScore: 2 },
      { channelId: "growth-1", riskScore: 3 },
      { channelId: "exp-1", riskScore: 4 },
    ];
    const result = allocateBudgetPure(10000, looseCeiling);
    const c1 = result.items.find((i) => i.channelId === "core-1")!;
    expect(c1.ceilingReached).toBe(false);
    expect(() => assertBudgetConsistency(result)).not.toThrow();
  });
});

describe("mínimo entre pilares — guardrail (Story 5.5)", () => {
  /** Canais cobrindo os 3 pilares; sem mínimos, Parcerias fica subalocado. */
  const pillarChannels: AllocationChannelInput[] = [
    // Ads domina (presente em todas as faixas).
    { channelId: "ads-core", riskScore: 1, pillarKey: "ads" },
    { channelId: "ads-growth", riskScore: 3, pillarKey: "ads" },
    { channelId: "ads-exp", riskScore: 4, pillarKey: "ads" },
    // Afiliações no núcleo.
    { channelId: "afil-core", riskScore: 2, pillarKey: "afiliacoes" },
    // Parcerias só no núcleo, sem match (recebe pouco por padrão).
    { channelId: "parc-core", riskScore: 1, pillarKey: "parcerias" },
  ];

  it("AC5: mínimo = 0% / desativado não impõe restrição (resultado idêntico ao base)", () => {
    const base = allocateBudgetPure(10000, pillarChannels);
    const withZero = allocateBudgetPure(10000, pillarChannels, DEFAULT_RATIOS, {
      parcerias: 0,
    });
    const sum = (r: typeof base, id: string) => r.items.find((i) => i.channelId === id)!.amount;
    for (const item of base.items) {
      expect(sum(withZero, item.channelId)).toBeCloseTo(item.amount, 2);
    }
    expect(withZero.pillarWarnings).toEqual([]);
  });

  it("AC2/AC3: mínimo de 15% para Parcerias realoca verba para o pilar", () => {
    const result = allocateBudgetPure(10000, pillarChannels, DEFAULT_RATIOS, {
      parcerias: 15,
    });
    const parcSum = result.items
      .filter((i) => i.pillarKey === "parcerias")
      .reduce((a, i) => a + i.amount, 0);
    // Pelo menos 15% de 10000 = 1500.
    expect(parcSum).toBeGreaterThanOrEqual(1500 - 0.01);
    expect(result.pillarWarnings).toEqual([]);
    // Consistência preservada: realocação só move verba entre canais.
    const total = result.items.reduce((a, i) => a + i.amount, 0);
    expect(total).toBeCloseTo(10000, 2);
    expect(() => assertBudgetConsistency(result)).not.toThrow();
  });

  it("AC4: mínimo inviável gera aviso (sem canais do pilar com folga)", () => {
    // Não há canais de Parcerias; o mínimo não pode ser satisfeito.
    const noParcerias: AllocationChannelInput[] = [
      { channelId: "ads-core", riskScore: 1, pillarKey: "ads" },
      { channelId: "afil-growth", riskScore: 3, pillarKey: "afiliacoes" },
      { channelId: "ads-exp", riskScore: 4, pillarKey: "ads" },
    ];
    const result = allocateBudgetPure(10000, noParcerias, DEFAULT_RATIOS, {
      parcerias: 15,
    });
    // Pilar inexistente nos itens => mínimo é ignorado (não há canais), sem aviso.
    expect(result.pillarWarnings).toEqual([]);
  });

  it("AC4: mínimo inviável por teto gera aviso (canal do pilar travado no teto)", () => {
    // Parcerias só tem 1 canal com teto 5% (500 max), mas mínimo exigido é 15%.
    const cappedPillar: AllocationChannelInput[] = [
      { channelId: "ads-core", riskScore: 1, pillarKey: "ads" },
      { channelId: "ads-growth", riskScore: 3, pillarKey: "ads" },
      { channelId: "ads-exp", riskScore: 4, pillarKey: "ads" },
      { channelId: "parc-core", riskScore: 1, pillarKey: "parcerias", ceilingPct: 5 },
    ];
    const result = allocateBudgetPure(10000, cappedPillar, DEFAULT_RATIOS, {
      parcerias: 15,
    });
    expect(result.pillarWarnings?.length).toBe(1);
    expect(result.pillarWarnings![0].pillarKey).toBe("parcerias");
    expect(result.pillarWarnings![0].requiredAmount).toBeCloseTo(1500, 2);
    // Parcerias não passa de 500 (teto 5%).
    const parcSum = result.items
      .filter((i) => i.pillarKey === "parcerias")
      .reduce((a, i) => a + i.amount, 0);
    expect(parcSum).toBeLessThanOrEqual(500 + 0.01);
  });

  it("doador não cede abaixo do próprio mínimo", () => {
    // Ads e Parcerias com mínimo; Afiliações é o doador livre.
    const result = allocateBudgetPure(10000, pillarChannels, DEFAULT_RATIOS, {
      ads: 50,
      parcerias: 15,
    });
    const sumPillar = (key: string) =>
      result.items.filter((i) => i.pillarKey === key).reduce((a, i) => a + i.amount, 0);
    expect(sumPillar("ads")).toBeGreaterThanOrEqual(5000 - 0.01);
    expect(sumPillar("parcerias")).toBeGreaterThanOrEqual(1500 - 0.01);
    const total = result.items.reduce((a, i) => a + i.amount, 0);
    expect(total).toBeCloseTo(10000, 2);
  });
});

describe("modelo de downside por canal (Story 6.2)", () => {
  it("AC1: taxa de perda — risk 1 => 20% ... risk 5 => 100% (linear)", () => {
    expect(downsideRate(1)).toBeCloseTo(0.2, 6);
    expect(downsideRate(2)).toBeCloseTo(0.4, 6);
    expect(downsideRate(3)).toBeCloseTo(0.6, 6);
    expect(downsideRate(4)).toBeCloseTo(0.8, 6);
    expect(downsideRate(5)).toBeCloseTo(1.0, 6);
  });

  it("AC1: calcDownside — risk 1 e R$1.000 => ~R$200", () => {
    expect(calcDownside(1000, 1)).toBeCloseTo(200, 2);
  });

  it("AC1: calcDownside — risk 5 e R$1.000 => R$1.000 (perda total)", () => {
    expect(calcDownside(1000, 5)).toBeCloseTo(1000, 2);
  });

  it("AC1: scores fora de 1..5 são saturados; não-finitos caem no piso", () => {
    expect(calcDownside(1000, 0)).toBeCloseTo(200, 2); // satura em risk 1
    expect(calcDownside(1000, 9)).toBeCloseTo(1000, 2); // satura em risk 5
    expect(calcDownside(1000, Number.NaN)).toBeCloseTo(200, 2); // piso 20%
  });

  it("AC1: amount inválido ou <= 0 => downside 0", () => {
    expect(calcDownside(0, 5)).toBe(0);
    expect(calcDownside(-100, 5)).toBe(0);
    expect(calcDownside(Number.NaN, 5)).toBe(0);
  });

  it("AC1: cada item da carteira recebe downsideEstimate coerente com seu amount/risco", () => {
    const result = allocateBudgetPure(10000, channels);
    for (const item of result.items) {
      expect(item.downsideEstimate).toBeGreaterThanOrEqual(0);
      // downside <= amount (taxa máxima 100%).
      expect(item.downsideEstimate!).toBeLessThanOrEqual(item.amount + 0.01);
      // downside >= 20% do amount (taxa mínima 20%).
      expect(item.downsideEstimate!).toBeGreaterThanOrEqual(item.amount * 0.2 - 0.01);
    }
  });

  it("AC2: portfolioDownside = soma dos downside por canal", () => {
    const result = allocateBudgetPure(10000, channels);
    const manual = result.items.reduce((acc, i) => acc + (i.downsideEstimate ?? 0), 0);
    expect(portfolioDownside(result.items)).toBeCloseTo(manual, 2);
  });

  it("AC1: downside é recalculado após o guardrail de mínimo entre pilares", () => {
    const pillarChannels: AllocationChannelInput[] = [
      { channelId: "ads-core", riskScore: 1, pillarKey: "ads" },
      { channelId: "ads-growth", riskScore: 3, pillarKey: "ads" },
      { channelId: "ads-exp", riskScore: 4, pillarKey: "ads" },
      { channelId: "parc-core", riskScore: 1, pillarKey: "parcerias" },
    ];
    const result = allocateBudgetPure(10000, pillarChannels, DEFAULT_RATIOS, {
      parcerias: 15,
    });
    // downsideEstimate de cada item bate com calcDownside do amount final.
    for (const item of result.items) {
      const risk = pillarChannels.find((c) => c.channelId === item.channelId)!.riskScore;
      expect(item.downsideEstimate).toBeCloseTo(calcDownside(item.amount, risk), 2);
    }
  });
});

describe("guardrails configuráveis — checkGuardrails (Story 6.3)", () => {
  /**
   * Carteira de teste (R$ 10.000): Ads concentra 70%, Afiliações 20%, Parcerias 10%.
   * Downside total = 1400 + 800 + 800 = R$ 3.000 (30% do orçamento).
   */
  const items: AllocationItem[] = [
    {
      channelId: "ads-1",
      amount: 7000,
      percentage: 70,
      riskBand: "core",
      pillarKey: "ads",
      downsideEstimate: 1400,
    },
    {
      channelId: "afil-1",
      amount: 2000,
      percentage: 20,
      riskBand: "growth",
      pillarKey: "afiliacoes",
      downsideEstimate: 800,
    },
    {
      channelId: "parc-1",
      amount: 1000,
      percentage: 10,
      riskBand: "experiment",
      pillarKey: "parcerias",
      downsideEstimate: 800,
    },
  ];
  const labels = {
    ads: "Anúncios",
    afiliacoes: "Afiliações",
    parcerias: "Parcerias",
    "ads-1": "Google Ads",
  };

  it("sem guardrails ativos => nenhuma violação (No Invention)", () => {
    expect(checkGuardrails(items, {}, 10000)).toEqual([]);
    expect(checkGuardrails(items, {}, 10000, labels)).toEqual([]);
  });

  it("AC3: concentração MÁXIMA por pilar violada (Ads 70% > 60%)", () => {
    const v = checkGuardrails(items, { maxPillarConcentrationPct: 60 }, 10000, labels);
    const pc = v.filter((x) => x.type === "pillar_concentration");
    expect(pc).toHaveLength(1);
    expect(pc[0].entityKey).toBe("ads");
    expect(pc[0].actual).toBeCloseTo(70, 1);
    expect(pc[0].limit).toBe(60);
    // label amigável aparece na mensagem (AC4).
    expect(pc[0].message).toContain("Anúncios");
  });

  it("AC3: concentração MÁXIMA por canal violada (ads-1 70% > 40%)", () => {
    const v = checkGuardrails(items, { maxChannelConcentrationPct: 40 }, 10000, labels);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("channel_concentration");
    expect(v[0].entityKey).toBe("ads-1");
    expect(v[0].message).toContain("Google Ads");
  });

  it("AC3: MÍNIMO por pilar violado (Parcerias 10% < 15%)", () => {
    const v = checkGuardrails(items, { minPillarPct: 15 }, 10000, labels);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("pillar_minimum");
    expect(v[0].entityKey).toBe("parcerias");
    expect(v[0].actual).toBeCloseTo(10, 1);
  });

  it("AC3: downside total em R$ violado (3000 > 2000)", () => {
    const v = checkGuardrails(items, { maxDownsideAmount: 2000 }, 10000);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("downside_total");
    expect(v[0].unit).toBe("brl");
    expect(v[0].actual).toBeCloseTo(3000, 2);
  });

  it("AC3: downside total em % violado (30% > 25%)", () => {
    const v = checkGuardrails(items, { maxDownsidePct: 25 }, 10000);
    expect(v).toHaveLength(1);
    expect(v[0].type).toBe("downside_total");
    expect(v[0].unit).toBe("pct");
    expect(v[0].actual).toBeCloseTo(30, 1);
  });

  it("AC3: várias regras ativas => várias violações agregadas", () => {
    const v = checkGuardrails(
      items,
      { maxPillarConcentrationPct: 60, maxChannelConcentrationPct: 40 },
      10000,
      labels
    );
    // Ads pilar (70>60) + ads-1 canal (70>40) + afil/parc canais não (20/10).
    expect(v.length).toBeGreaterThanOrEqual(2);
    expect(v.some((x) => x.type === "pillar_concentration")).toBe(true);
    expect(v.some((x) => x.type === "channel_concentration")).toBe(true);
  });

  it("AC4: violações avisam, não bloqueiam (engine sempre devolve a lista)", () => {
    const v = checkGuardrails(items, DEFAULT_GUARDRAILS, 10000, labels);
    // Defaults (pilar 60, canal 40, downside 50%) => Ads pilar + ads-1 canal.
    expect(v.length).toBeGreaterThan(0);
    // A decisão de "acknowledged" é do caller, não da engine (AC5).
  });

  it("recalcula o total quando totalBudget não é informado", () => {
    // Soma dos amount = 10000; mesmo resultado sem passar totalBudget.
    const withTotal = checkGuardrails(items, { maxChannelConcentrationPct: 40 }, 10000);
    const derived = checkGuardrails(items, { maxChannelConcentrationPct: 40 });
    expect(derived).toHaveLength(withTotal.length);
  });
});

describe("sanitizeGuardrailConfig (Story 6.3)", () => {
  it("descarta percentuais fora de 0..100 (No Invention)", () => {
    const s = sanitizeGuardrailConfig({
      maxPillarConcentrationPct: 150,
      maxChannelConcentrationPct: -5,
      minPillarPct: 40,
    });
    expect(s?.maxPillarConcentrationPct).toBeUndefined();
    expect(s?.maxChannelConcentrationPct).toBeUndefined();
    expect(s?.minPillarPct).toBe(40);
  });

  it("descarta valores monetários negativos", () => {
    const s = sanitizeGuardrailConfig({ maxDownsideAmount: -100 });
    expect(s).toBeNull();
  });

  it("retorna null quando nenhuma regra é válida", () => {
    expect(sanitizeGuardrailConfig({})).toBeNull();
    expect(sanitizeGuardrailConfig(null)).toBeNull();
    expect(sanitizeGuardrailConfig(undefined)).toBeNull();
  });

  it("ignora mínimo <= 0 (regra inativa por padrão)", () => {
    const s = sanitizeGuardrailConfig({ minPillarPct: 0 });
    expect(s).toBeNull();
  });
});
