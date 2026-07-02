import { describe, expect, it } from "vitest";
import {
  buildProfileSystemPrompt,
  buildProfileUserPrompt,
  buildFallbackProfile,
  parseMonetizationProfile,
  emptyProfile,
  type ProfileQAItem,
} from "./profile";

describe("buildProfileSystemPrompt", () => {
  it("pede EXATAMENTE os campos do AC3", () => {
    const sys = buildProfileSystemPrompt();
    expect(sys).toContain('"objectives"');
    expect(sys).toContain('"philosophy"');
    expect(sys).toContain('"current_stage"');
    expect(sys).toContain('"resources"');
    expect(sys).toContain('"excluded_channels"');
  });

  it("instrui a responder apenas com JSON", () => {
    expect(buildProfileSystemPrompt()).toContain("APENAS com o objeto JSON");
  });
});

describe("buildProfileUserPrompt", () => {
  it("lista as Q&A como contexto (AC1)", () => {
    const qa: ProfileQAItem[] = [
      { question: "Qual seu objetivo?", answer: "Faturar 10k/mês", layer: "objetivos" },
    ];
    const prompt = buildProfileUserPrompt(qa);
    expect(prompt).toContain("Qual seu objetivo?");
    expect(prompt).toContain("Faturar 10k/mês");
    expect(prompt).toContain("camada: objetivos");
  });

  it("tolera lista vazia", () => {
    expect(buildProfileUserPrompt([])).toContain("(nenhuma resposta registrada)");
  });
});

describe("parseMonetizationProfile", () => {
  it("parseia JSON puro com todos os campos do AC3", () => {
    const json = JSON.stringify({
      objectives: ["crescer"],
      philosophy: ["não fazer spam"],
      current_stage: "início",
      resources: ["tempo"],
      // Story 3.6: o LLM não conhece os UUIDs; excluded_channels é preenchido
      // pelo filtro de filosofia determinístico, não pelo parse. Aqui fica vazio.
      excluded_channels: ["cold-call"],
    });
    const profile = parseMonetizationProfile(json);
    expect(profile).toEqual({
      objectives: ["crescer"],
      philosophy: ["não fazer spam"],
      current_stage: "início",
      resources: ["tempo"],
      excluded_channels: [],
      excluded_channel_details: [],
    });
  });

  it("extrai JSON embutido em texto", () => {
    const raw = 'Aqui está:\n{"objectives":["x"],"current_stage":"y"}\nFim.';
    const profile = parseMonetizationProfile(raw);
    expect(profile?.objectives).toEqual(["x"]);
    expect(profile?.current_stage).toEqual("y");
    expect(profile?.philosophy).toEqual([]);
  });

  it("coage campos ausentes/ inválidos para defaults seguros", () => {
    const profile = parseMonetizationProfile('{"objectives":"não-array"}');
    expect(profile).toEqual(emptyProfile());
  });

  it("retorna null em entrada inválida (cai no fallback AC6)", () => {
    expect(parseMonetizationProfile("sem json aqui")).toBeNull();
    expect(parseMonetizationProfile("")).toBeNull();
    expect(parseMonetizationProfile(null)).toBeNull();
    expect(parseMonetizationProfile("[1,2,3]")).toBeNull();
  });
});

describe("buildFallbackProfile (AC6)", () => {
  const qa: ProfileQAItem[] = [
    { question: "Objetivo?", answer: "Crescer", layer: "objetivos" },
    { question: "Valores?", answer: "Honestidade", layer: "filosofia" },
    { question: "Momento?", answer: "Validando", layer: "momento" },
    { question: "Recursos?", answer: "2h/dia", layer: "recursos" },
    { question: "Solta?", answer: "Extra", layer: null },
  ];

  it("distribui respostas pelas camadas conhecidas", () => {
    const fb = buildFallbackProfile(qa);
    expect(fb.objectives).toContain("Crescer");
    expect(fb.philosophy).toContain("Honestidade");
    expect(fb.current_stage).toContain("Validando");
    expect(fb.resources).toContain("2h/dia");
    // camada desconhecida vira objetivo genérico
    expect(fb.objectives).toContain("Extra");
  });

  it("preserva as respostas cruas em raw_answers (auditoria)", () => {
    const fb = buildFallbackProfile(qa);
    expect(fb.raw_answers).toHaveLength(5);
    expect(fb.raw_answers[0]).toEqual({
      question: "Objetivo?",
      answer: "Crescer",
      layer: "objetivos",
    });
  });

  it("ignora respostas vazias na distribuição mas mantém em raw_answers", () => {
    const fb = buildFallbackProfile([{ question: "P", answer: "   ", layer: "objetivos" }]);
    expect(fb.objectives).toHaveLength(0);
    expect(fb.raw_answers).toHaveLength(1);
  });
});
