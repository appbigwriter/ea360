import { describe, it, expect } from "vitest";
import { generateFunnelStructure, FunnelError } from "./funnel";

const cfg = (over: Partial<Parameters<typeof generateFunnelStructure>[0]>) => ({
  objective: "Vender curso",
  product: "Curso X",
  audience: "Empreendedores",
  cta: "Quero saber mais",
  botDisclosure: "Sou uma assistente virtual",
  ...over,
});

describe("generateFunnelStructure (Story 8.1)", () => {
  it("gera as 4 etapas (AC2)", () => {
    const f = generateFunnelStructure(cfg({}));
    expect(f.stages.map((s) => s.key)).toEqual([
      "ctwa_ad",
      "free_window",
      "bot_flow",
      "nurture_sequence",
    ]);
  });

  it("bot_disclosure obrigatorio (AC6)", () => {
    expect(() => generateFunnelStructure(cfg({ botDisclosure: "" }))).toThrow(FunnelError);
    expect(() => generateFunnelStructure(cfg({ botDisclosure: "   " }))).toThrow(FunnelError);
  });

  it("inclui a identificacao do bot na etapa bot_flow", () => {
    const f = generateFunnelStructure(cfg({ botDisclosure: "Assistente virtual EA360" }));
    expect(f.stages.find((s) => s.key === "bot_flow")!.description).toContain(
      "Assistente virtual EA360"
    );
  });
});
