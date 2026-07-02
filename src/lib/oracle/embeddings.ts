import { OpenAI } from "openai";

// Usado apenas no servidor. Não expor no cliente!
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Gera um embedding vetorial de 1536 dimensões usando a OpenAI.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.replace(/\n/g, " "),
  });

  return response.data[0].embedding;
}

/**
 * Divide um texto em chunks baseado no número aproximado de caracteres por token.
 * Usaremos a heurística de MVP: 1 token ≈ 4 caracteres.
 */
export function chunkText(text: string, chunkSizeTokens = 500, overlapTokens = 50): string[] {
  const charsPerToken = 4;
  const chunkSizeBytes = chunkSizeTokens * charsPerToken;
  const overlapBytes = overlapTokens * charsPerToken;

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSizeBytes, text.length);
    const chunk = text.slice(startIndex, endIndex);
    chunks.push(chunk);

    if (endIndex >= text.length) {
      break;
    }
    startIndex += chunkSizeBytes - overlapBytes;
  }

  return chunks;
}
