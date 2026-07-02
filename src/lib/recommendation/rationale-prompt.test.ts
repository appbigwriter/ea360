import { describe, it, expect } from "vitest";
import {
  MAX_RATIONALE_WORDS,
  countWords,
  truncateToWords,
  buildRationaleSystemPrompt,
  buildRationaleUserPrompt,
  parseRationale,
} from "./rationale-prompt";

describe("countWords", () => {
  it("conta palavras separadas por espaços", () => {
    expect(countWords("um dois três")).toBe(3);
  });
  it("retorna 0 para texto vazio ou só espaços", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("colapsa múltiplos espaços/quebras de linha", () => {
    expect(countWords("a   b\n\nc")).toBe(3);
  });
});

describe("truncateToWords (AC4: máx. 150 palavras)", () => {
  it("não altera texto dentro do limite", () => {
    expect(truncateToWords("curto e direto", 5)).toBe("curto e direto");
  });
  it("trunca para o limite e sinaliza com reticências", () => {
    const long = Array.from({ length: 200 }, (_, i) => `p${i}`).join(" ");
    const out = truncateToWords(long);
    // 150 palavras + a reticência anexada na última.
    expect(countWords(out)).toBe(MAX_RATIONALE_WORDS);
    expect(out.endsWith("…")).toBe(true);
  });
  it("usa MAX_RATIONALE_WORDS (150) por padrão", () => {
    expect(MAX_RATIONALE_WORDS).toBe(150);
  });
});

describe("buildRationaleSystemPrompt (AC3/AC4)", () => {
  const sys = buildRationaleSystemPrompt();
  it("menciona fit_reason e avoid_reason", () => {
    expect(sys).toContain("fit_reason");
    expect(sys).toContain("avoid_reason");
  });
  it("impõe o limite de 150 palavras", () => {
    expect(sys).toContain(String(MAX_RATIONALE_WORDS));
  });
  it("exige saída JSON", () => {
    expect(sys.toLowerCase()).toContain("json");
  });
});

describe("buildRationaleUserPrompt (AC3: perfil + canal + score)", () => {
  const prompt = buildRationaleUserPrompt({
    profile: {
      goals: { crescimento: true, margem: false },
      horizon: "medio",
      riskTolerance: 5,
      capitalAvailable: 2,
      profileData: { resources: { budget: 10000 } },
    },
    channel: {
      name: "Google Ads",
      pillarName: "Aquisição",
      costScore: 4,
      paybackScore: 5,
      riskScore: 2,
    },
    matchScore: 87.5,
  });

  it("inclui o nome do canal", () => {
    expect(prompt).toContain("Google Ads");
  });
  it("inclui o score de match", () => {
    expect(prompt).toContain("87.5");
  });
  it("inclui metas priorizadas (só as truthy)", () => {
    expect(prompt).toContain("crescimento");
    expect(prompt).not.toContain("margem");
  });
  it("inclui o orçamento de profile_data", () => {
    expect(prompt).toContain("10000");
  });
  it("tolera score de match ausente sem quebrar", () => {
    const p = buildRationaleUserPrompt({
      profile: {},
      channel: { name: "SEO" },
      matchScore: null,
    });
    expect(p).toContain("não informado");
    expect(p).toContain("SEO");
  });
});

describe("parseRationale (AC1/AC4: parse tolerante + limite)", () => {
  it("extrai fit/avoid de JSON puro", () => {
    const r = parseRationale('{"fit_reason":"cabe bem","avoid_reason":"evite se sem caixa"}');
    expect(r).not.toBeNull();
    expect(r?.fitReason).toBe("cabe bem");
    expect(r?.avoidReason).toBe("evite se sem caixa");
  });

  it("extrai JSON embutido em texto extra", () => {
    const raw = 'Claro! Aqui:\n{"fit_reason":"x","avoid_reason":"y"}\nEspero ajudar.';
    const r = parseRationale(raw);
    expect(r?.fitReason).toBe("x");
    expect(r?.avoidReason).toBe("y");
  });

  it("aplica o limite de 150 palavras em cada campo", () => {
    const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const r = parseRationale(JSON.stringify({ fit_reason: long, avoid_reason: long }));
    expect(countWords(r!.fitReason)).toBe(MAX_RATIONALE_WORDS);
    expect(countWords(r!.avoidReason)).toBe(MAX_RATIONALE_WORDS);
  });

  it("retorna null para JSON inválido (não lança — AC5)", () => {
    expect(parseRationale("não é json")).toBeNull();
    expect(parseRationale("{quebrado")).toBeNull();
  });

  it("retorna null quando ambos os campos estão vazios", () => {
    expect(parseRationale('{"fit_reason":"","avoid_reason":""}')).toBeNull();
  });

  it("tolera apenas um dos campos presente", () => {
    const r = parseRationale('{"fit_reason":"só fit"}');
    expect(r?.fitReason).toBe("só fit");
    expect(r?.avoidReason).toBe("");
  });

  it("retorna null para entradas nulas/vazias", () => {
    expect(parseRationale(null)).toBeNull();
    expect(parseRationale(undefined)).toBeNull();
    expect(parseRationale("")).toBeNull();
  });
});
