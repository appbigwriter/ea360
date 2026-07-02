-- ==============================================================================
-- Migração Aditiva: Story 8.4 — Escape Humano
-- ==============================================================================

-- 1. Adição do campo human_escape_config na tabela funnels
ALTER TABLE public.funnels 
ADD COLUMN IF NOT EXISTS human_escape_config JSONB;

COMMENT ON COLUMN public.funnels.human_escape_config IS 'Configuração de escape humano (keyword, handoff_message)';

-- GATE de verificação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'funnels' AND column_name = 'human_escape_config'
  ) THEN
    RAISE EXCEPTION 'GATE FALHOU: coluna human_escape_config não criada.';
  END IF;
END $$;
