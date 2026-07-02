"use server";

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/oracle/embeddings";
import Anthropic from "@anthropic-ai/sdk";
import { trackOracleQueried } from "@/lib/analytics";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type QAResponse = {
  answer: string;
  sources: { title: string; url: string }[];
  error?: string;
};

export async function queryOracle(question: string): Promise<QAResponse> {
  try {
    const supabase = await createClient();

    // 1. Gera embedding da pergunta
    const queryEmbedding = await generateEmbedding(question);

    // 2. Busca documentos similares no Supabase (threshold 0.7)
    // Precisamos formatar o array do JS para a string que o pgvector aceita '[0.1, 0.2, ...]'
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    const { data: docs, error } = await supabase.rpc("match_oracle_documents", {
      query_embedding: embeddingStr,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) {
      console.error("Error fetching from oracle:", error);
      throw new Error("Falha ao buscar no banco de dados.");
    }

    if (!docs || docs.length === 0) {
      return {
        answer:
          "Não encontrei informações suficientes no Oráculo para responder a essa pergunta com segurança.",
        sources: [],
      };
    }

    // 3. Prepara o contexto
    const contextText = docs
      .map(
        (doc: { title: string; url: string; content: string }) =>
          `Documento: ${doc.title}\nURL: ${doc.url}\nConteúdo: ${doc.content}\n---`
      )
      .join("\n");

    // 4. Chama o Anthropic (Claude)
    const prompt = `Você é o Oráculo de Conformidade Meta (EA360).
Responda à pergunta do usuário usando APENAS as informações fornecidas no contexto abaixo.
Se a informação não estiver no contexto, diga que não sabe.
Ao final da resposta, SEMPRE liste as fontes utilizadas, citando o Título e a URL exata do documento que embasou sua resposta.

Contexto:
${contextText}

Pergunta do usuário: ${question}
`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system:
        "Você é um assistente de conformidade focado em políticas da Meta. Responda em português.",
      messages: [{ role: "user", content: prompt }],
    });

    const answerText = "text" in message.content[0] ? message.content[0].text : "";

    // Extrai fontes únicas para retornar no payload (útil para a UI)
    const uniqueSources = Array.from(
      new Map(
        docs.map((doc: { title: string; url: string }) => [
          doc.url,
          { title: doc.title, url: doc.url },
        ])
      ).values()
    ) as { title: string; url: string }[];

    const response = {
      answer: answerText,
      sources: uniqueSources,
    };

    // Fire-and-forget analytics
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .limit(1)
          .maybeSingle()
          .then(({ data: biz }) => {
            if (biz) {
              trackOracleQueried(biz.id, user.id, question.length).catch(() => {});
            }
          });
      }
    });

    return response;
  } catch (err: unknown) {
    console.error("Error querying oracle:", err);
    return {
      answer: "",
      sources: [],
      error: err instanceof Error ? err.message : "Erro inesperado ao consultar o Oráculo.",
    };
  }
}
