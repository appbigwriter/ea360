-- Seed Admin User for Local Development
-- E-mail: admin@ea360.com
-- Password: admin123

-- Inserir usuário na tabela auth.users (gerenciado pelo Supabase)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  app_metadata,
  user_metadata,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  email_change,
  email_change_token_new,
  email_change_confirm_status
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a53e6b7c-3f41-4835-a128-6447833fb260',
  'authenticated',
  'authenticated',
  'admin@ea360.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  NULL,
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Admin User"}',
  FALSE,
  now(),
  now(),
  NULL,
  NULL,
  '',
  '',
  0
) ON CONFLICT (id) DO NOTHING;

-- Inserir a identidade do usuário
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  'a53e6b7c-3f41-4835-a128-6447833fb260',
  'a53e6b7c-3f41-4835-a128-6447833fb260',
  'a53e6b7c-3f41-4835-a128-6447833fb260',
  '{"sub": "a53e6b7c-3f41-4835-a128-6447833fb260", "email": "admin@ea360.com"}',
  'email',
  now(),
  now(),
  now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Inserir o perfil público correspondente (tabela public.profiles)
INSERT INTO public.profiles (
  id,
  full_name,
  locale,
  role,
  created_at,
  updated_at
)
VALUES (
  'a53e6b7c-3f41-4835-a128-6447833fb260',
  'Admin EA360',
  'pt-BR',
  'admin',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET role = 'admin';
