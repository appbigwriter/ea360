import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt, parseFollowUps, MAX_FOLLOW_UPS } from "./prompt";

describe("buildSystemPrompt", () => {
  it("inclui as quatro camadas como contexto (AC3)", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain("Objetivos & Metas");
    expect(sys).toContain("Filosofia & Valores");
    expect(sys).toContain("Momento");
    expect(sys).toContain("Recursos");
  });

  it("instrui a gerar de 0 a 3 perguntas em JSON (AC1)", () => {
    const sys = buildSystemPrompt();
    expect(sys).toContain(`0 a ${MAX_FOLLOW_UPS}`);
    expect(sys.toLowerCase()).toContain("json");
  });
});

describe("buildUserPrompt", () => {
  it("inclui camada atual, histórico e a resposta mais recente (AC3)", () => {
    const prompt = buildUserPrompt({
      currentLayer: "filosofia",
      history: [{ question: "P anterior?", answer: "R anterior", layer: "objetivos" }],
      latestQuestion: "Qual seu propósito?",
      latestAnswer: "Ajudar pessoas.",
    });
    expect(prompt).toContain("Filosofia & Valores");
    expect(prompt).toContain("P anterior?");
    expect(prompt).toContain("R anterior");
    expect(prompt).toContain("Qual seu propósito?");
    expect(prompt).toContain("Ajudar pessoas.");
  });

  it("lida com histórico vazio sem quebrar", () => {
    const prompt = buildUserPrompt({
      currentLayer: null,
      history: [],
      latestQuestion: "Q",
      latestAnswer: "A",
    });
    expect(prompt).toContain("(nenhuma resposta anterior)");
  });
});

describe("parseFollowUps", () => {
  it("faz parse de um array JSON puro (AC1)", () => {
    const result = parseFollowUps('["Pergunta 1?", "Pergunta 2?"]');
    expect(result).toEqual([{ question: "Pergunta 1?" }, { question: "Pergunta 2?" }]);
  });

  it("extrai array JSON embutido em texto", () => {
    const result = parseFollowUps('Claro! Aqui:\n["A?", "B?"]\nEspero ajudar.');
    expect(result.map((r) => r.question)).toEqual(["A?", "B?"]);
  });

  it("limita a no máximo 3 perguntas (AC1)", () => {
    const result = parseFollowUps('["1?","2?","3?","4?","5?"]');
    expect(result).toHaveLength(MAX_FOLLOW_UPS);
  });

  it("retorna [] para array vazio (0 perguntas é válido, AC1)", () => {
    expect(parseFollowUps("[]")).toEqual([]);
  });

  it("é tolerante a falhas: retorna [] para JSON inválido (AC4)", () => {
    expect(parseFollowUps("isto não é json")).toEqual([]);
    expect(parseFollowUps("")).toEqual([]);
    expect(parseFollowUps(null)).toEqual([]);
    expect(parseFollowUps(undefined)).toEqual([]);
  });

  it("ignora itens não-string e em branco", () => {
    const result = parseFollowUps('["Boa?", 42, "", "  ", "Outra?"]');
    expect(result.map((r) => r.question)).toEqual(["Boa?", "Outra?"]);
  });
});
