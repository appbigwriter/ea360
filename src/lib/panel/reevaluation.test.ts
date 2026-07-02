import { describe, it, expect } from "vitest";
import { checkReevaluationTriggers } from "./reevaluation";

describe("checkReevaluationTriggers (Story 7.5)", () => {
  it("sem gatilhos => nao disparado", () => {
    const r = checkReevaluationTriggers({
      daysSinceLastInterview: 10,
      budgetChangePct: 5,
      channelsBelowHalfProjected: 0,
    });
    expect(r.triggered).toBe(false);
    expect(r.reasons).toHaveLength(0);
  });

  it(">90 dias desde a entrevista => disparado", () => {
    const r = checkReevaluationTriggers({
      daysSinceLastInterview: 100,
      budgetChangePct: 0,
      channelsBelowHalfProjected: 0,
    });
    expect(r.triggered).toBe(true);
    expect(r.reasons[0]).toContain("100 dias");
  });

  it("mudanca de budget >30% (em modulo) => disparado", () => {
    const r = checkReevaluationTriggers({
      daysSinceLastInterview: 1,
      budgetChangePct: -45,
      channelsBelowHalfProjected: 0,
    });
    expect(r.triggered).toBe(true);
    expect(r.reasons[0]).toContain("-45%");
  });

  it("3+ canais abaixo de 50% => disparado", () => {
    const r = checkReevaluationTriggers({
      daysSinceLastInterview: 1,
      budgetChangePct: 0,
      channelsBelowHalfProjected: 3,
    });
    expect(r.triggered).toBe(true);
    expect(r.reasons[0]).toContain("3 canais");
  });

  it("varios gatilhos => varias razoes", () => {
    const r = checkReevaluationTriggers({
      daysSinceLastInterview: 200,
      budgetChangePct: 50,
      channelsBelowHalfProjected: 5,
    });
    expect(r.triggered).toBe(true);
    expect(r.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
