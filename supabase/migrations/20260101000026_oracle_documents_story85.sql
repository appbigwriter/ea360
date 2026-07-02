-- ==============================================================================
-- Migração: Story 8.5 — Oracle Documents (RAG)
-- ==============================================================================

-- Habilita a extensão pgvector se não existir
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Tabela de documentos do Oráculo
DROP TABLE IF EXISTS public.oracle_documents CASCADE;
DROP TYPE IF EXISTS public.oracle_source_type CASCADE;
CREATE TYPE public.oracle_source_type AS ENUM ('meta_policy', 'help_center', 'api_docs');

CREATE TABLE IF NOT EXISTS public.oracle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  url text,
  embedding vector(1536),
  source_type public.oracle_source_type,
  scraped_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE public.oracle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documentos são visíveis para usuários autenticados" 
ON public.oracle_documents FOR SELECT 
TO authenticated USING (true);

-- Trigger de updated_at
CREATE TRIGGER set_updated_at_oracle_documents
BEFORE UPDATE ON public.oracle_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Index HNSW para busca vetorial rápida
CREATE INDEX IF NOT EXISTS oracle_documents_embedding_idx 
ON public.oracle_documents USING hnsw (embedding vector_cosine_ops);

-- Função de match (Busca por Similaridade)
CREATE OR REPLACE FUNCTION match_oracle_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    oracle_documents.id,
    oracle_documents.title,
    oracle_documents.content,
    oracle_documents.url,
    1 - (oracle_documents.embedding <=> query_embedding) AS similarity
  FROM oracle_documents
  WHERE 1 - (oracle_documents.embedding <=> query_embedding) > match_threshold
  ORDER BY oracle_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- GATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oracle_documents') THEN
    RAISE EXCEPTION 'GATE FALHOU: oracle_documents não criada.';
  END IF;
END $$;
