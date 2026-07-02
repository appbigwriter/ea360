/**
 * Arquiteto de funil CTWA (Story 8.1 — R7). Gera a estrutura de funil em JSON com as
 * 4 etapas (AC2): ctwa_ad, free_window, bot_flow, nurture_sequence. Função PURA.
 *
 * `bot_disclosure` é OBRIGATÓRIO (AC6 — bot sempre identificado). Sem ele, erro.
 */
export type FunnelConfig = {
  objective: string;
  product: string;
  audience: string;
  cta: string;
  botDisclosure: string;
  humanEscapeConfig?: {
    keyword: string;
    handoffMessage: string;
  };
};

export type FunnelStage = {
  key: "ctwa_ad" | "free_window" | "bot_flow" | "nurture_sequence";
  title: string;
  description: string;
};

export type FunnelStructure = {
  objective: string;
  stages: FunnelStage[];
  botDisclosure: string;
  humanEscapeConfig?: {
    keyword: string;
    handoffMessage: string;
  };
};

export class FunnelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FunnelError";
  }
}

/**
 * Gera a estrutura do funil (AC2, AC6). Valida `botDisclosure` obrigatório.
 */
export function generateFunnelStructure(config: FunnelConfig): FunnelStructure {
  if (!config.botDisclosure || !config.botDisclosure.trim()) {
    throw new FunnelError("A identificação do bot (bot_disclosure) é obrigatória.");
  }
  const obj = config.objective.trim() || "Conversão via WhatsApp";
  const product = config.product.trim() || "seu produto/serviço";
  const audience = config.audience.trim() || "público-alvo";
  const cta = config.cta.trim() || "Falar no WhatsApp";

  return {
    objective: obj,
    botDisclosure: config.botDisclosure.trim(),
    humanEscapeConfig: config.humanEscapeConfig,
    stages: [
      {
        key: "ctwa_ad",
        title: "Anúncio CTWA (Click-to-WhatsApp)",
        description: `Anúncio Meta direcionando "${audience}" para o WhatsApp de "${product}" com CTA "${cta}".`,
      },
      {
        key: "free_window",
        title: "Janela grátis de 24h",
        description:
          "Aproveitar a janela gratuita de 24h iniciada pelo contato via CTWA para a primeira resposta.",
      },
      {
        key: "bot_flow",
        title: "Fluxo do bot",
        description: `Atendimento automatizado identificando-se como bot ("${config.botDisclosure.trim()}"), qualificando o lead e roteando para humano quando necessário.`,
      },
      {
        key: "nurture_sequence",
        title: "Sequência de nurture",
        description: `Cadência de mensagens pós-janela para nutrir o lead de "${product}" até a conversão.`,
      },
    ],
  };
}
