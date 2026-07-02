-- ==============================================================================
-- Migração: Story 9.1 e 9.2 — Analytics Events
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_name text NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  timestamp timestamp with time zone DEFAULT now()
);

-- Analytics events geralmente são write-only pelo client ou inseridos por Service Role.
-- Habilitando RLS genérico:
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Usuários só podem inserir seus próprios eventos e ler seus próprios (ou service role lê tudo).
DROP POLICY IF EXISTS "Users can insert own events" ON public.analytics_events;
CREATE POLICY "Users can insert own events"
ON public.analytics_events FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own events" ON public.analytics_events;
CREATE POLICY "Users can read own events"
ON public.analytics_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- GATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_events') THEN
    RAISE EXCEPTION 'GATE FALHOU: analytics_events não criada.';
  END IF;
END $$;
