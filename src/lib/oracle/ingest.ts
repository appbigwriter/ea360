import { createClient } from "@supabase/supabase-js";
import { generateEmbedding, chunkText } from "./embeddings";

// Usamos admin/service_role para ingestão (INSERT) conforme RLS definido
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DocumentInput = {
  title: string;
  content: string;
  url: string;
  source_type: "meta_policy" | "help_center" | "api_docs";
};

/**
 * Ingere um documento grande no Oráculo:
 * 1. Divide em chunks.
 * 2. Gera embeddings para cada chunk.
 * 3. Insere no Supabase.
 */
export async function ingestDocument(doc: DocumentInput): Promise<void> {
  const chunks = chunkText(doc.content);
  console.log(`Ingesting "${doc.title}": split into ${chunks.length} chunks.`);

  for (const [index, chunk] of chunks.entries()) {
    const embedding = await generateEmbedding(chunk);

    const chunkTitle = chunks.length > 1 ? `${doc.title} (Part ${index + 1})` : doc.title;

    const { error } = await supabase.from("oracle_documents").insert({
      title: chunkTitle,
      content: chunk,
      url: doc.url,
      source_type: doc.source_type,
      embedding,
      scraped_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error inserting chunk into Supabase:", error);
      throw new Error(`Failed to ingest document chunk ${index + 1}`);
    }
  }

  console.log(`Successfully ingested "${doc.title}".`);
}
