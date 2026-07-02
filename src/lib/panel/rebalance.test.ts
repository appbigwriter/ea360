import { describe, it, expect } from "vitest";
import { buildRebalanceRecommendation, type ChannelPerf } from "./rebalance";

const ch = (over: Partial<ChannelPerf>): ChannelPerf => ({
  channelId: "c",
  name: "Canal",
  projectedSpend: 1000,
  realSpend: 1000,
  realRoa: null,
  projectedRoa: null,
  killHit: false,
  ...over,
});

describe("buildRebalanceRecommendation (Story 7.4)", () => {
  it("canal acima da projeção (ROAS 2x) => aumentar", () => {
    const r = buildRebalanceRecommendation([
      ch({ channelId: "a", name: "A", projectedRoa: 2, realRoa: 4 }),
    ]);
    expect(r.increases).toHaveLength(1);
    expect(r.increases[0].suggestedDeltaPct).toBe(20);
    expect(r.overallHealth).toBe("on_track");
  });

  it("canal >20% abaixo => reduzir; saúde off_track", () => {
    const r = buildRebalanceRecommendation([
      ch({ channelId: "b", name: "B", projectedSpend: 1000, realSpend: 700 }),
    ]);
    expect(r.reductions).toHaveLength(1);
    expect(r.reductions[0].suggestedDeltaPct).toBe(-30);
    expect(r.overallHealth).toBe("off_track");
  });

  it("kill-criteria => encerrar; saúde critical (prioridade sobre demais)", () => {
    const r = buildRebalanceRecommendation([
      ch({ channelId: "k", name: "K", killHit: true, projectedSpend: 1000, realSpend: 2000 }),
    ]);
    expect(r.kills).toHaveLength(1);
    expect(r.kills[0].suggestedDeltaPct).toBe(-100);
    expect(r.increases).toHaveLength(0);
    expect(r.overallHealth).toBe("critical");
  });

  it("alinhado à projeção => sem ajustes, on_track", () => {
    const r = buildRebalanceRecommendation([
      ch({ channelId: "o", name: "O", projectedSpend: 1000, realSpend: 1000 }),
    ]);
    expect(r.increases).toHaveLength(0);
    expect(r.reductions).toHaveLength(0);
    expect(r.overallHealth).toBe("on_track");
    expect(r.justification).toContain("on_track");
  });

  it("sem dados de performance => canal ignorado (sem ajuste)", () => {
    const r = buildRebalanceRecommendation([
      ch({ channelId: "x", name: "X", projectedSpend: 0, realSpend: null }),
    ]);
    expect(r.increases).toHaveLength(0);
    expect(r.reductions).toHaveLength(0);
  });
});
