-- ==============================================================================
-- Migração: Story 8.10 — Credenciais Meta (Integrations)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.meta_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  waba_id text NOT NULL,
  meta_access_token text NOT NULL, -- em um app real, seria criptografado com pgsodium
  phone_number_id text NOT NULL,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (business_id)
);

ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integrations belong to business owner"
ON public.meta_integrations FOR ALL
TO authenticated
USING (business_id IN (
  SELECT id FROM public.businesses WHERE owner_id = auth.uid()
))
WITH CHECK (business_id IN (
  SELECT id FROM public.businesses WHERE owner_id = auth.uid()
));

CREATE TRIGGER set_updated_at_meta_integrations
BEFORE UPDATE ON public.meta_integrations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- GATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_integrations') THEN
    RAISE EXCEPTION 'GATE FALHOU: meta_integrations não criada.';
  END IF;
END $$;
