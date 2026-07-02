-- ============================================================================
-- EA360 — Entrepreneur Ads 360
-- Migração inicial: schema, RLS, funções e seed do GOM (Guia de Opções de Monetização)
-- Alvo: Supabase / PostgreSQL. Coloque em supabase/migrations/0001_init_ea360.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensões
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- embeddings do Oráculo (RAG)

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type pillar_type          as enum ('ads','afiliacoes','parcerias');
create type payback_level         as enum ('imediato','curto','medio','longo');
create type control_level         as enum ('alto','medio','baixo');
create type scale_level           as enum ('baixa','media','alta','muito_alta');
create type effort_mode           as enum ('cash','effort','mixed');
create type allocation_tier       as enum ('nucleo','crescimento','experimento');
create type interview_status      as enum ('rascunho','em_andamento','concluida');
create type recommendation_status as enum ('gerada','revisada','arquivada');
create type flag_level            as enum ('verde','amarelo','vermelho');

-- ----------------------------------------------------------------------------
-- 2. Função utilitária: updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- ----------------------------------------------------------------------------
-- 3. Identidade
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  locale      text default 'pt-BR',
  role        text default 'owner',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table businesses (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  segment     text,
  stage       text,                       -- ideação, validação, tração, escala
  philosophy  jsonb default '{}'::jsonb,   -- princípios/valores capturados
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on businesses(owner_id);
create trigger trg_businesses_updated before update on businesses
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. GOM — Guia de Opções de Monetização (base de ativos, leitura pública)
-- ----------------------------------------------------------------------------
create table gom_pillars (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  kind        pillar_type not null,
  name        text not null,
  description text,
  sort        int default 0
);

create table gom_categories (
  id          uuid primary key default gen_random_uuid(),
  pillar_id   uuid not null references gom_pillars(id) on delete cascade,
  slug        text unique not null,
  name        text not null,
  description text,
  sort        int default 0
);
create index on gom_categories(pillar_id);

create table gom_channels (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references gom_categories(id) on delete cascade,
  slug            text unique not null,
  name            text not null,
  how_it_works    text,
  best_for        text,
  cost_model      text,                    -- CPC, CPM, CPA, comissão, fixo, rev-share, esforço, zero
  payback         payback_level not null,
  control         control_level not null,
  scale           scale_level not null,
  effort_mode     effort_mode not null,
  risk_note       text,
  -- scores 1..5 (consumidos pelo alocador). Direção em comentário:
  liquidity        int not null default 3 check (liquidity between 1 and 5),        -- 5 = retorno mais rápido
  control_score    int not null default 3 check (control_score between 1 and 5),    -- 5 = mais controle
  scalability      int not null default 3 check (scalability between 1 and 5),      -- 5 = escala mais longe
  risk_score       int not null default 3 check (risk_score between 1 and 5),       -- 5 = mais arriscado
  capital_intensity int not null default 3 check (capital_intensity between 1 and 5),-- 5 = exige mais caixa
  created_at      timestamptz default now()
);
create index on gom_channels(category_id);

-- ----------------------------------------------------------------------------
-- 5. Diagnóstico (Entrevista 360 → perfil de monetização)
-- ----------------------------------------------------------------------------
create table interview_questions (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  layer       text not null,              -- objetivos, filosofia, momento, recursos
  prompt      text not null,
  input_type  text default 'text',        -- text, single, multi, scale
  options     jsonb default '[]'::jsonb,
  sort        int default 0
);

create table interviews (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  status      interview_status default 'rascunho',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on interviews(business_id);
create trigger trg_interviews_updated before update on interviews
  for each row execute function set_updated_at();

create table interview_answers (
  id           uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id) on delete cascade,
  question_id  uuid references interview_questions(id) on delete set null,
  layer        text,
  answer       jsonb not null default '{}'::jsonb,
  created_at   timestamptz default now()
);
create index on interview_answers(interview_id);

create table monetization_profiles (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  interview_id  uuid references interviews(id) on delete set null,
  goals         jsonb default '{}'::jsonb,   -- crescimento, margem, marca, previsibilidade
  horizon       payback_level default 'medio',
  risk_tolerance     int default 3 check (risk_tolerance between 1 and 5),
  capital_available  int default 3 check (capital_available between 1 and 5),
  effort_capacity    int default 3 check (effort_capacity between 1 and 5),
  owned_audience     int default 1 check (owned_audience between 1 and 5),
  philosophy_excludes text[] default '{}',   -- slugs de canal ou pilar a excluir por princípio
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on monetization_profiles(business_id);
create trigger trg_profiles_updated before update on monetization_profiles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Recomendação (Menu personalizado)
-- ----------------------------------------------------------------------------
create table recommendations (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  profile_id  uuid references monetization_profiles(id) on delete set null,
  status      recommendation_status default 'gerada',
  created_at  timestamptz default now()
);
create index on recommendations(business_id);

create table recommendation_items (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendations(id) on delete cascade,
  channel_id        uuid not null references gom_channels(id),
  score             numeric(6,2),
  suggested_tier    allocation_tier,
  est_spend_min     numeric(12,2),
  est_spend_max     numeric(12,2),
  est_return_note   text,
  rationale_fit     text,                 -- por que cabe agora
  rationale_avoid   text,                 -- por que evitar (quando aplicável)
  rank              int
);
create index on recommendation_items(recommendation_id);

-- ----------------------------------------------------------------------------
-- 7. Alocação de portfólio
-- ----------------------------------------------------------------------------
create table allocations (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  total_budget  numeric(12,2) not null default 0,
  split_core    int default 70,
  split_growth  int default 20,
  split_exp     int default 10,
  max_per_channel_pct int default 40,     -- guardrail: teto por canal
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on allocations(business_id);
create trigger trg_allocations_updated before update on allocations
  for each row execute function set_updated_at();

create table allocation_items (
  id            uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  channel_id    uuid not null references gom_channels(id),
  tier          allocation_tier not null,
  amount        numeric(12,2) not null default 0,
  share_pct     numeric(5,2)
);
create index on allocation_items(allocation_id);

create table experiments (
  id            uuid primary key default gen_random_uuid(),
  allocation_item_id uuid not null references allocation_items(id) on delete cascade,
  hypothesis    text,
  kill_criteria text not null,            -- todo experimento nasce com critério de corte
  budget_cap    numeric(12,2),
  deadline      date,
  status        text default 'ativo',
  created_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 8. Mitigador de risco
-- ----------------------------------------------------------------------------
create table risk_flags (
  id            uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  level         flag_level not null,
  kind          text not null,            -- concentracao_plataforma, concentracao_pilar, sem_corte, etc.
  message       text,
  payload       jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);
create index on risk_flags(allocation_id);

-- ----------------------------------------------------------------------------
-- 9. Painel 360 (métricas e reavaliação)
-- ----------------------------------------------------------------------------
create table channel_metrics (
  id            uuid primary key default gen_random_uuid(),
  allocation_item_id uuid not null references allocation_items(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  spend         numeric(12,2) default 0,
  revenue       numeric(12,2) default 0,
  roas          numeric(8,2),
  cpa           numeric(12,2),
  payback_days  int,
  created_at    timestamptz default now()
);
create index on channel_metrics(allocation_item_id);

create table allocation_reviews (
  id            uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  summary       text,
  rebalance     jsonb default '{}'::jsonb, -- sugestão de novo split por canal/faixa
  created_at    timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 10. Nó executor / Oráculo (RAG) e Blindagem
-- ----------------------------------------------------------------------------
create table oracle_documents (
  id            uuid primary key default gen_random_uuid(),
  source_url    text,
  title         text,
  content       text,
  embedding     vector(1536),             -- ajuste a dimensão ao modelo de embedding
  fetched_at    timestamptz default now(),
  is_stale      boolean default false
);

create table compliance_checks (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  context       text,                     -- funil, template, persona do bot
  level         flag_level not null,
  findings      jsonb default '[]'::jsonb,
  created_at    timestamptz default now()
);
create index on compliance_checks(business_id);

-- ----------------------------------------------------------------------------
-- 11. RLS — Row Level Security
-- ----------------------------------------------------------------------------
alter table profiles               enable row level security;
alter table businesses             enable row level security;
alter table interviews             enable row level security;
alter table interview_answers      enable row level security;
alter table monetization_profiles  enable row level security;
alter table recommendations        enable row level security;
alter table recommendation_items   enable row level security;
alter table allocations            enable row level security;
alter table allocation_items       enable row level security;
alter table experiments            enable row level security;
alter table risk_flags             enable row level security;
alter table channel_metrics        enable row level security;
alter table allocation_reviews     enable row level security;
alter table compliance_checks      enable row level security;
-- GOM e perguntas: leitura pública; sem RLS de escrita para anon
alter table gom_pillars            enable row level security;
alter table gom_categories         enable row level security;
alter table gom_channels           enable row level security;
alter table interview_questions    enable row level security;

-- Perfil próprio
create policy "perfil próprio" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Negócios do dono
create policy "negócios do dono" on businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Helper: negócio pertence ao usuário?
create or replace function owns_business(b uuid)
returns boolean language sql stable as $$
  select exists (select 1 from businesses where id = b and owner_id = auth.uid());
$$;

-- Tabelas filhas ligadas direto a business_id
create policy "interviews do dono" on interviews
  for all using (owns_business(business_id)) with check (owns_business(business_id));
create policy "monet_profiles do dono" on monetization_profiles
  for all using (owns_business(business_id)) with check (owns_business(business_id));
create policy "recommendations do dono" on recommendations
  for all using (owns_business(business_id)) with check (owns_business(business_id));
create policy "allocations do dono" on allocations
  for all using (owns_business(business_id)) with check (owns_business(business_id));
create policy "risk_flags do dono" on risk_flags
  for all using (exists (select 1 from allocations a where a.id = risk_flags.allocation_id and owns_business(a.business_id)));
create policy "allocation_reviews do dono" on allocation_reviews
  for all using (exists (select 1 from allocations a where a.id = allocation_reviews.allocation_id and owns_business(a.business_id)));
create policy "compliance do dono" on compliance_checks
  for all using (owns_business(business_id)) with check (owns_business(business_id));

-- Tabelas filhas indiretas
create policy "interview_answers do dono" on interview_answers
  for all using (exists (select 1 from interviews i where i.id = interview_answers.interview_id and owns_business(i.business_id)));
create policy "rec_items do dono" on recommendation_items
  for all using (exists (select 1 from recommendations r where r.id = recommendation_items.recommendation_id and owns_business(r.business_id)));
create policy "alloc_items do dono" on allocation_items
  for all using (exists (select 1 from allocations a where a.id = allocation_items.allocation_id and owns_business(a.business_id)));
create policy "experiments do dono" on experiments
  for all using (exists (select 1 from allocation_items ai join allocations a on a.id = ai.allocation_id
                         where ai.id = experiments.allocation_item_id and owns_business(a.business_id)));
create policy "metrics do dono" on channel_metrics
  for all using (exists (select 1 from allocation_items ai join allocations a on a.id = ai.allocation_id
                         where ai.id = channel_metrics.allocation_item_id and owns_business(a.business_id)));

-- Leitura pública do GOM e das perguntas
create policy "gom pilares públicos"   on gom_pillars        for select using (true);
create policy "gom categorias públicas" on gom_categories    for select using (true);
create policy "gom canais públicos"     on gom_channels      for select using (true);
create policy "perguntas públicas"      on interview_questions for select using (true);

-- ----------------------------------------------------------------------------
-- 12. Funções de negócio
-- ----------------------------------------------------------------------------

-- Score composto de um canal dado um perfil (0..100, scaffolding ajustável)
create or replace function fn_channel_score(ch gom_channels, p monetization_profiles)
returns numeric language plpgsql immutable as $$
declare
  s numeric;
begin
  -- pesos derivados do perfil (normalizados de forma simples)
  s :=
      (ch.liquidity      * (6 - p.risk_tolerance))      -- impaciente => valoriza payback rápido
    + (ch.scalability    * 2)
    + ((6 - ch.risk_score) * p.risk_tolerance)          -- tolerante a risco => penaliza menos risco alto
    + (ch.control_score  * 1.5)
    + (case when ch.capital_intensity > p.capital_available then -8 else 4 end) -- caixa insuficiente penaliza
    + (case when ch.effort_mode = 'effort' then p.effort_capacity * 1.5 else 0 end);
  -- normaliza grosseiramente para 0..100
  return round(greatest(0, least(100, s * 2.2)), 2);
end; $$;

-- Menu: canais ranqueados para um perfil, excluindo o que a filosofia veta
create or replace function fn_match_channels(p_profile uuid, p_limit int default 12)
returns table (
  channel_id uuid, slug text, name text, pillar pillar_type,
  score numeric, payback payback_level, control control_level, scale scale_level, risk_score int
) language plpgsql stable as $$
declare prof monetization_profiles;
begin
  select * into prof from monetization_profiles where id = p_profile;
  return query
  select ch.id, ch.slug, ch.name, pl.kind,
         fn_channel_score(ch, prof) as score,
         ch.payback, ch.control, ch.scale, ch.risk_score
  from gom_channels ch
  join gom_categories cat on cat.id = ch.category_id
  join gom_pillars pl on pl.id = cat.pillar_id
  where not (ch.slug = any(prof.philosophy_excludes))
    and not (pl.slug = any(prof.philosophy_excludes))
  order by score desc
  limit p_limit;
end; $$;

-- Mitigador: detecta concentração por canal e por pilar numa alocação
create or replace function fn_concentration_check(p_allocation uuid)
returns table (level flag_level, kind text, message text) language plpgsql stable as $$
declare a allocations; total numeric;
begin
  select * into a from allocations where id = p_allocation;
  select sum(amount) into total from allocation_items where allocation_id = p_allocation;
  if coalesce(total,0) = 0 then return; end if;

  -- teto por canal
  return query
  select 'vermelho'::flag_level, 'concentracao_canal',
         'Canal acima do teto de ' || a.max_per_channel_pct || '%: ' || ai.channel_id::text
  from allocation_items ai
  where ai.allocation_id = p_allocation
    and (ai.amount / total * 100) > a.max_per_channel_pct;

  -- concentração por pilar (> 60% num único pilar)
  return query
  select 'amarelo'::flag_level, 'concentracao_pilar',
         'Pilar ' || pl.kind::text || ' concentra ' || round(sum(ai.amount)/total*100,0) || '% da verba'
  from allocation_items ai
  join gom_channels ch on ch.id = ai.channel_id
  join gom_categories cat on cat.id = ch.category_id
  join gom_pillars pl on pl.id = cat.pillar_id
  where ai.allocation_id = p_allocation
  group by pl.kind
  having sum(ai.amount)/total*100 > 60;
end; $$;

-- ============================================================================
-- 13. SEED — GOM (Guia de Opções de Monetização)
-- ============================================================================

-- 13.1 Pilares
insert into gom_pillars (slug, kind, name, description, sort) values
  ('ads',        'ads',        'Ads (mídia paga)',            'Comprar e vender mídia.', 1),
  ('afiliacoes', 'afiliacoes', 'Afiliações (performance)',    'Ser afiliado e ter o próprio programa.', 2),
  ('parcerias',  'parcerias',  'Parcerias (estratégicas)',    'Audiência, distribuição e estruturais.', 3);

-- 13.2 Categorias
insert into gom_categories (pillar_id, slug, name, description, sort)
select p.id, v.slug, v.name, v.description, v.sort
from (values
  ('ads',        'ads_comprando',     'Comprando mídia',            'Aquisição paga.', 1),
  ('ads',        'ads_vendendo',      'Vendendo mídia',             'Virando publisher da própria audiência.', 2),
  ('afiliacoes', 'afil_sendo',        'Sendo afiliado',             'Promove outros, ganha comissão.', 1),
  ('afiliacoes', 'afil_programa',     'Tendo seu programa',         'Outros promovem você.', 2),
  ('parcerias',  'parc_audiencia',    'Audiência e co-marketing',   'Somar e trocar públicos.', 1),
  ('parcerias',  'parc_distribuicao', 'Distribuição e canal',       'Alguém distribui seu produto.', 2),
  ('parcerias',  'parc_estruturais',  'Estruturais e de produto',   'Alianças, licença, franquia, JV.', 3)
) as v(pillar_slug, slug, name, description, sort)
join gom_pillars p on p.slug = v.pillar_slug;

-- 13.3 Canais (50)
insert into gom_channels
  (category_id, slug, name, how_it_works, best_for, cost_model, payback, control, scale, effort_mode,
   risk_note, liquidity, control_score, scalability, risk_score, capital_intensity)
select c.id, v.slug, v.name, v.how_it_works, v.best_for, v.cost_model,
       v.payback::payback_level, v.control::control_level, v.scale::scale_level, v.effort_mode::effort_mode,
       v.risk_note, v.liquidity, v.control_score, v.scalability, v.risk_score, v.capital_intensity
from (values
  -- ===== ADS — Comprando mídia =====
  ('ads_comprando','search_ads','Search ads (Google, Bing)','Captura quem já procura o que você vende.','Fundo de funil, intenção alta.','CPC','curto','medio','alta','cash','Leilão caro em nichos disputados; clique sem conversão.',4,3,4,3,4),
  ('ads_comprando','paid_social','Paid social (Meta, TikTok, LinkedIn)','Interrompe com segmentação por interesse.','Descoberta e meio de funil.','CPM/CPC','curto','baixo','muito_alta','cash','Dependência de plataforma; fadiga de criativo; bloqueio de conta.',4,2,5,4,4),
  ('ads_comprando','display_programatica','Display / programática','Banners via redes e DSPs.','Awareness e retargeting.','CPM','longo','medio','muito_alta','cash','Baixa atenção; fraude; banner blindness.',2,3,5,3,3),
  ('ads_comprando','video_ads','Vídeo (YouTube, CTV/OTT)','Conta história em movimento.','Topo e meio de funil, marca.','CPV/CPM','medio','medio','alta','cash','Caro de produzir; viewer pula.',2,3,4,3,4),
  ('ads_comprando','native_ads','Native ads (Taboola, Outbrain)','Anúncio disfarçado de conteúdo em portais.','Volume barato de tráfego.','CPC','medio','medio','alta','cash','Tráfego frio e curioso; baixa qualidade.',3,3,4,4,3),
  ('ads_comprando','retargeting','Retargeting / remarketing','Persegue quem já te visitou.','Conversão de público quente.','CPM/CPC','imediato','medio','media','cash','Público pequeno; saturação e irritação.',5,3,3,2,2),
  ('ads_comprando','shopping_marketplace','Shopping / marketplace ads','Anúncio dentro do marketplace, no momento da compra.','E-commerce, intenção altíssima.','CPC/CPA','imediato','baixo','alta','cash','Taxa e dependência do marketplace; guerra de preço.',5,2,4,3,3),
  ('ads_comprando','audio_ads','Áudio (Spotify, podcast)','Anúncio em streaming ou leitura em podcast.','Marca e nichos engajados.','CPM/fixo','medio','medio','media','cash','Difícil de mensurar; sem clique.',3,3,3,3,3),
  ('ads_comprando','messaging_ads','Messaging ads (CTWA, click-to-DM)','Anúncio que abre conversa em vez de página.','Opt-in real; alto engajamento.','CPM + mensageria','curto','medio','alta','cash','Exige resposta rápida e bot em conformidade.',4,3,4,3,3),
  ('ads_comprando','app_install','App install campaigns','Paga por instalação, otimiza por evento no app.','Quem tem app.','CPI/CPA','medio','medio','alta','cash','Instala e não usa; fraude de instalação.',2,3,4,4,4),
  ('ads_comprando','influencer_pago','Influencer pago (placement avulso)','Paga um creator por menção fixa, sem comissão.','Aluga a confiança da audiência dele.','fixo','curto','baixo','media','cash','Engajamento falso; fit ruim; ação one-off.',3,2,3,4,3),
  ('ads_comprando','dooh','DOOH / out-of-home digital','Telas e painéis programáticos físicos.','Awareness local ou de massa.','CPM/fixo','longo','medio','media','cash','Atribuição difícil; caro.',1,3,3,3,5),
  ('ads_comprando','geo_local_ads','Geo / local ads','Anúncios com raio geográfico, hiperlocal.','Negócio físico.','CPC/CPM','curto','medio','baixa','cash','Público pequeno.',4,3,2,2,2),
  -- ===== ADS — Vendendo mídia =====
  ('ads_vendendo','rede_display_publisher','Rede de display (AdSense, Mediavine)','Cede espaço do site; a rede preenche.','Renda passiva com tráfego.','zero','curto','baixo','alta','effort','Depende de tráfego; RPM volátil; polui UX.',3,2,4,3,1),
  ('ads_vendendo','patrocinio_newsletter','Patrocínio de newsletter','Vende slots no seu e-mail.','Lista engajada e nichada.','fixo','imediato','alto','media','effort','Queima a confiança da lista se exagerar.',5,5,3,2,1),
  ('ads_vendendo','patrocinio_podcast','Patrocínio de podcast','Leitura paga dentro do seu áudio.','Audiência fiel.','fixo','imediato','alto','media','effort','Precisa de audiência relevante.',5,5,3,2,1),
  ('ads_vendendo','sponsor_youtube','Sponsor de vídeo (YouTube)','Menção paga dentro do seu vídeo.','Canal com audiência.','fixo','imediato','alto','media','effort','Fit com a audiência.',5,5,3,2,1),
  ('ads_vendendo','conteudo_patrocinado','Conteúdo patrocinado / advertorial','Marca paga por artigo ou post no seu veículo.','Veículo com credibilidade.','fixo','imediato','alto','media','effort','Desgasta a credibilidade editorial.',5,4,3,3,1),
  ('ads_vendendo','espaco_nativo_proprio','Espaço nativo próprio (venda direta)','Vende posições direto, sem rede no meio.','Margem alta com esforço comercial.','zero','curto','alto','media','effort','Precisa vender ativamente.',4,5,3,2,1),
  ('ads_vendendo','branded_content','Branded content','Campanha co-criada com a marca anunciante.','Quem tem voz própria forte.','fixo','curto','alto','baixa','effort','Trabalhoso, feito caso a caso.',4,4,2,2,1),
  -- ===== AFILIAÇÕES — Sendo afiliado =====
  ('afil_sendo','redes_afiliacao','Redes de afiliação (Amazon, Hotmart)','Pega link/produto da rede e ganha % por venda.','Entrada fácil, sem estoque.','comissão','medio','baixo','alta','effort','Mudança de regra; cookie curto.',2,2,4,3,1),
  ('afil_sendo','programas_diretos','Programas diretos','Acordo direto com a empresa, sem rede.','Termos melhores.','comissão','medio','medio','media','effort','Depende da empresa honrar o acordo.',2,3,3,3,1),
  ('afil_sendo','conteudo_review','Conteúdo de review / comparativo','Conteúdo "melhores X" que captura decisão de compra.','Intenção alta via SEO.','esforço','longo','medio','alta','effort','Dependência de SEO e de updates do Google.',1,3,4,3,1),
  ('afil_sendo','cupom_deal','Cupom / deal','Canais de desconto que capturam caçadores de oferta.','Volume com margem baixa.','esforço','curto','baixo','media','effort','Público sem fidelidade; comoditiza a oferta.',4,2,3,3,1),
  ('afil_sendo','afiliado_email','Afiliado por e-mail','Promove ofertas pra lista própria.','Alto retorno por contato.','esforço','curto','alto','media','effort','Queimar a lista com excesso de oferta.',4,5,3,3,1),
  ('afil_sendo','afiliado_autoridade','Afiliado de autoridade / nicho','Site especialista que vira referência.','Passivo e defensável quando maduro.','esforço','longo','medio','alta','effort','Tempo até amadurecer.',1,3,4,2,1),
  ('afil_sendo','afiliado_saas_recorrente','SaaS / recorrente','Comissão recorrente enquanto o cliente fica.','Receita previsível (a joia).','comissão','medio','medio','alta','effort','Churn do cliente derruba a comissão.',3,3,4,2,1),
  ('afil_sendo','high_ticket','High-ticket','Poucos produtos caros, comissão gorda.','Venda consultiva.','comissão','medio','medio','media','effort','Ciclo de venda longo; volume baixo.',2,3,3,3,1),
  ('afil_sendo','cpl_pay_per_call','CPL / pay-per-call','Ganha por lead ou ligação, não por venda.','Seguros, crédito, serviços.','CPL','curto','medio','alta','effort','Qualidade do lead; fraude.',4,3,4,4,1),
  -- ===== AFILIAÇÕES — Tendo seu programa =====
  ('afil_programa','programa_afiliados_inhouse','Programa de afiliados in-house','Recruta promotores que vendem por comissão.','Força de vendas paga por resultado.','comissão','curto','alto','alta','effort','Gestão; fraude de afiliado; proteção de marca.',4,4,4,3,2),
  ('afil_programa','programa_indicacao','Programa de indicação (referral)','Cliente que indica ganha recompensa.','Aquisição barata de alta confiança.','recompensa','curto','alto','alta','mixed','Incentivo mal calibrado; gaming do sistema.',4,4,4,2,2),
  ('afil_programa','programa_embaixadores','Programa de embaixadores / criadores','Creators com código próprio promovem.','Marca + performance.','comissão/fixo','medio','medio','media','mixed','Gestão de muitos parceiros; fit.',3,3,3,3,2),
  ('afil_programa','revendedores_comissao','Revendedores com comissão','Terceiros vendem e ficam com a margem.','Distribuição via revenda.','margem','curto','medio','alta','mixed','Controle de preço e de marca.',4,3,4,3,2),
  -- ===== PARCERIAS — Audiência e co-marketing =====
  ('parc_audiencia','co_marketing','Co-marketing','Campanha conjunta somando os dois públicos.','Alcance dobrado, custo dividido.','esforço','curto','medio','media','effort','Alinhamento e divisão de crédito.',4,3,3,2,1),
  ('parc_audiencia','cross_promotion','Cross-promotion / swap de audiência','Vocês se promovem mutuamente.','Aquisição quase de graça.','esforço','curto','alto','media','effort','Precisa de públicos compatíveis.',4,4,3,2,1),
  ('parc_audiencia','bundling','Bundling','Seu produto no pacote do parceiro.','Acesso ao público dele.','rev-share','curto','medio','media','mixed','Canibalização; divisão de margem.',4,3,3,3,2),
  ('parc_audiencia','patrocinio_evento','Patrocínio (patrocina/é patrocinado)','Associa a marca a evento ou conteúdo.','Awareness e posicionamento.','fixo','longo','medio','media','cash','Difícil mensurar; fit de marca.',1,3,3,3,4),
  ('parc_audiencia','parceria_comunidade','Parceria com comunidade / associação','Acesso a público organizado e confiante.','Lead de altíssima qualidade.','esforço/rev-share','curto','medio','media','mixed','Precisa entregar valor; não virar spam.',4,3,3,2,2),
  ('parc_audiencia','parceria_midia_sindicacao','Parceria de mídia / sindicação','Conteúdo distribuído por veículo parceiro.','Alcance emprestado.','esforço','medio','medio','media','effort','Diluição de marca.',2,3,3,2,1),
  -- ===== PARCERIAS — Distribuição e canal =====
  ('parc_distribuicao','parceria_canal_distribuicao','Parceria de canal / distribuição','Parceiro distribui ou revende seu produto.','Entra em mercados novos.','margem','medio','baixo','alta','mixed','Dependência do canal; controle de marca.',2,2,4,3,2),
  ('parc_distribuicao','revenda_var','Revenda / VAR','Revendedor agrega serviço e revende.','B2B e produtos técnicos.','margem','medio','medio','alta','mixed','Qualidade da entrega depende do parceiro.',2,3,4,3,2),
  ('parc_distribuicao','white_label_oem','White-label / OEM','Seu produto com a marca de outro.','Volume grande.','rev-share/licença','medio','baixo','muito_alta','mixed','Virar commodity; dependência de cliente grande.',2,2,5,4,2),
  ('parc_distribuicao','parceria_integracao','Parceria de integração (tech / marketplace)','Integra ao produto de outro ou lista no marketplace dele.','Distribuição via ecossistema.','esforço','longo','medio','alta','effort','Dependência da plataforma host; mudança de API.',1,3,4,3,3),
  -- ===== PARCERIAS — Estruturais e de produto =====
  ('parc_estruturais','alianca_estrategica','Aliança estratégica','Colaboração ampla e duradoura entre empresas.','Alavancagem grande.','esforço','longo','medio','alta','mixed','Desalinhamento; dependência mútua.',1,3,4,3,4),
  ('parc_estruturais','licenciamento','Licenciamento','Licencia marca/IP/conteúdo a terceiros.','Receita com pouco esforço contínuo.','licença','medio','medio','alta','mixed','Uso indevido da marca; controle de qualidade.',2,3,4,3,2),
  ('parc_estruturais','franquia','Franquia','Replica o modelo via franqueados.','Escala física com capital de terceiros.','taxa + royalties','longo','medio','muito_alta','cash','Padronização; gestão da rede; jurídico pesado.',1,3,5,4,5),
  ('parc_estruturais','joint_venture','Joint venture','Projeto novo com parceiro, receita e risco divididos.','Somar forças num empreendimento.','investimento','longo','medio','alta','mixed','Conflito de sócios; governança.',1,3,4,4,4),
  ('parc_estruturais','revenue_share','Revenue-share','Parceiro entrega algo e ganha % da receita.','Alinha incentivo sem custo fixo.','rev-share','curto','medio','alta','mixed','Rastreio e confiança na atribuição.',4,3,4,3,1),
  ('parc_estruturais','co_criacao_produto','Co-criação de produto','Produto novo com um parceiro, receita dividida.','Somar competências.','investimento','longo','medio','media','mixed','Propriedade; divisão; time-to-market.',1,3,3,3,4)
) as v(category_slug, slug, name, how_it_works, best_for, cost_model, payback, control, scale, effort_mode,
       risk_note, liquidity, control_score, scalability, risk_score, capital_intensity)
join gom_categories c on c.slug = v.category_slug;

-- 13.4 Perguntas-semente da Entrevista 360 (amostra inicial)
insert into interview_questions (slug, layer, prompt, input_type, sort) values
  ('objetivo_principal','objetivos','Qual é o objetivo principal agora: crescer faturamento, melhorar margem, construir marca ou ganhar previsibilidade?','single',1),
  ('horizonte','objetivos','Em quanto tempo você espera ver retorno do que investir?','single',2),
  ('filosofia_excludentes','filosofia','Há canais ou abordagens que você recusa por princípio (ex.: depender de Big Tech, usar cupom, etc.)?','multi',3),
  ('caixa','momento','Quanto de caixa você tem disponível para investir por mês?','scale',4),
  ('margem','momento','Como está a margem do negócio hoje?','single',5),
  ('audiencia_propria','momento','Você já tem audiência própria (lista, comunidade, seguidores)?','scale',6),
  ('apetite_risco','momento','Qual seu apetite a risco, de conservador a agressivo?','scale',7),
  ('capacidade_esforco','recursos','Quanta capacidade de execução (tempo e time) você tem para canais que exigem esforço em vez de dinheiro?','scale',8);

-- ============================================================================
-- Fim da migração inicial EA360.
-- ============================================================================
