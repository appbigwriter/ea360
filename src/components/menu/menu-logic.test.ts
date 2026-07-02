import { describe, it, expect } from "vitest";
import { riskFarol } from "./risk-farol";
import { sortChannels } from "./sort";
import type { MenuChannel } from "@/app/app/menu/queries";

function makeChannel(overrides: Partial<MenuChannel>): MenuChannel {
  return {
    id: "i",
    channelId: "c",
    name: "Canal",
    pillarName: "Pilar",
    pillarSlug: "pilar",
    matchScore: 50,
    estimatedSpend: 1000,
    returnRangeMin: 500,
    returnRangeMax: 3000,
    paybackMonths: 6,
    riskScore: 3,
    fitReason: null,
    avoidReason: null,
    rankPosition: 0,
    ...overrides,
  };
}

describe("riskFarol (AC2)", () => {
  it("1..2 => verde", () => {
    expect(riskFarol(1).level).toBe("green");
    expect(riskFarol(2).level).toBe("green");
  });

  it("3 => amarelo", () => {
    expect(riskFarol(3).level).toBe("yellow");
  });

  it("4..5 => vermelho", () => {
    expect(riskFarol(4).level).toBe("red");
    expect(riskFarol(5).level).toBe("red");
  });

  it("valor não-finito cai para amarelo (moderado) defensivamente", () => {
    expect(riskFarol(Number.NaN).level).toBe("yellow");
  });

  it("expõe classes Tailwind canônicas (Dev Note)", () => {
    expect(riskFarol(1).textClass).toBe("text-green-600");
    expect(riskFarol(3).textClass).toBe("text-yellow-500");
    expect(riskFarol(5).textClass).toBe("text-red-600");
  });
});

describe("sortChannels (AC3)", () => {
  const channels: MenuChannel[] = [
    makeChannel({
      id: "a",
      matchScore: 80,
      estimatedSpend: 5000,
      returnRangeMax: 1000,
      paybackMonths: 9,
      rankPosition: 0,
    }),
    makeChannel({
      id: "b",
      matchScore: 60,
      estimatedSpend: 1000,
      returnRangeMax: 9000,
      paybackMonths: 3,
      rankPosition: 1,
    }),
    makeChannel({
      id: "c",
      matchScore: 90,
      estimatedSpend: 3000,
      returnRangeMax: 5000,
      paybackMonths: 6,
      rankPosition: 2,
    }),
  ];

  it("match (padrão): maior score primeiro", () => {
    expect(sortChannels(channels, "match").map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("cost: menor gasto primeiro", () => {
    expect(sortChannels(channels, "cost").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("return: maior retorno máximo primeiro", () => {
    expect(sortChannels(channels, "return").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("payback: menor payback primeiro", () => {
    expect(sortChannels(channels, "payback").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("não muta a lista original", () => {
    const original = [...channels];
    sortChannels(channels, "cost");
    expect(channels).toEqual(original);
  });

  it("empate é resolvido pelo rankPosition original", () => {
    const tied: MenuChannel[] = [
      makeChannel({ id: "x", matchScore: 50, rankPosition: 2 }),
      makeChannel({ id: "y", matchScore: 50, rankPosition: 0 }),
      makeChannel({ id: "z", matchScore: 50, rankPosition: 1 }),
    ];
    expect(sortChannels(tied, "match").map((c) => c.id)).toEqual(["y", "z", "x"]);
  });
});
