import { describe, expect, it } from "vitest";
import {
  deriveExcludedChannels,
  normalizeText,
  toExcludedChannelIds,
  type FilterableChannel,
} from "./philosophy";

/** Catálogo mínimo de canais (subset do seed real do GOM) para os testes. */
const CHANNELS: FilterableChannel[] = [
  { id: "u-paid-social", slug: "paid_social", name: "Paid social", pillarSlug: "ads" },
  { id: "u-search", slug: "search_ads", name: "Search ads", pillarSlug: "ads" },
  { id: "u-cupom", slug: "cupom_deal", name: "Cupom / deal", pillarSlug: "afiliacoes" },
  {
    id: "u-afil-email",
    slug: "afiliado_email",
    name: "Afiliado por e-mail",
    pillarSlug: "afiliacoes",
  },
  {
    id: "u-mlm",
    slug: "programa_afiliados_inhouse",
    name: "Programa in-house",
    pillarSlug: "afiliacoes",
  },
  { id: "u-influencer", slug: "influencer_pago", name: "Influencer pago", pillarSlug: "ads" },
  { id: "u-coproduto", slug: "co_criacao_produto", name: "Co-criação", pillarSlug: "parcerias" },
];

describe("normalizeText", () => {
  it("remove acentos, minúsculas e colapsa espaços", () => {
    expect(normalizeText("  Dependência   de   PLATAFORMA ")).toBe("dependencia de plataforma");
  });
});

describe("deriveExcludedChannels", () => {
  it('AC2: "evito MLM" exclui canais de revenda em cadeia', () => {
    const result = deriveExcludedChannels(["Evito MLM e pirâmide"], CHANNELS);
    const slugs = result.map((r) => r.channelSlug);
    expect(slugs).toContain("programa_afiliados_inhouse");
    expect(result.every((r) => r.reason.length > 0)).toBe(true);
  });

  it("exclui cupom/desconto quando o usuário recusa cupom", () => {
    const result = deriveExcludedChannels(["Não uso cupom nem desconto"], CHANNELS);
    expect(result.map((r) => r.channelSlug)).toContain("cupom_deal");
  });

  it("Big Tech exclui canais de mídia paga das grandes plataformas", () => {
    const result = deriveExcludedChannels(["Quero evitar dependência de Big Tech"], CHANNELS);
    const slugs = result.map((r) => r.channelSlug);
    expect(slugs).toContain("paid_social");
    expect(slugs).toContain("search_ads");
  });

  it("regra de pilar exclui todos os canais de afiliação", () => {
    const result = deriveExcludedChannels(["Não quero afiliados"], CHANNELS);
    const slugs = result.map((r) => r.channelSlug);
    expect(slugs).toContain("cupom_deal");
    expect(slugs).toContain("afiliado_email");
    expect(slugs).toContain("programa_afiliados_inhouse");
  });

  it("deduplica canais marcados por mais de uma regra", () => {
    const result = deriveExcludedChannels(["Evito cupom e também não quero afiliados"], CHANNELS);
    const ids = result.map((r) => r.channelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retorna vazio quando nada casa", () => {
    expect(deriveExcludedChannels(["Quero crescer faturamento"], CHANNELS)).toEqual([]);
  });

  it("retorna vazio para entradas vazias", () => {
    expect(deriveExcludedChannels([], CHANNELS)).toEqual([]);
    expect(deriveExcludedChannels(["cupom"], [])).toEqual([]);
  });
});

describe("toExcludedChannelIds", () => {
  it("AC3: extrai UUIDs únicos no formato do matchmaking", () => {
    const excluded = deriveExcludedChannels(["evito mlm e cupom"], CHANNELS);
    const ids = toExcludedChannelIds(excluded);
    expect(ids).toContain("u-mlm");
    expect(ids).toContain("u-cupom");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
