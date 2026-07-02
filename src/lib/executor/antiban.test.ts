import { describe, it, expect } from "vitest";
import { runAntibanRules } from "./antiban";

const tpl = (body: string) => ({
  name: "t",
  bodyText: body,
  headerText: undefined as string | undefined,
});

describe("runAntibanRules (Story 8.3)", () => {
  it("template conforme => verde/passed", () => {
    const r = runAntibanRules(
      tpl("Olá! Sou um bot. Posso te ajudar com seu pedido?"),
      "Sou um bot"
    );
    expect(r.flagLevel).toBe("green");
    expect(r.status).toBe("passed");
  });

  it("promessa de ganho garantido => vermelho/failed (AC testing)", () => {
    const r = runAntibanRules(tpl("Ganhe R$1000 garantido agora!"));
    expect(r.flagLevel).toBe("red");
    expect(r.status).toBe("failed");
    expect(r.issues.some((i) => i.severity === "blocking")).toBe(true);
  });

  it("clickbait => amarelo/flagged", () => {
    const r = runAntibanRules(tpl("Clique aqui para saber mais."));
    expect(r.flagLevel).toBe("yellow");
    expect(r.status).toBe("flagged");
  });

  it("bot_disclosure ausente do corpo => warning amarelo", () => {
    const r = runAntibanRules(tpl("Olá!"), "Sou uma assistente virtual");
    expect(r.issues.some((i) => i.rule === "bot_nao_identificado")).toBe(true);
    expect(r.flagLevel).toBe("yellow");
  });
});
