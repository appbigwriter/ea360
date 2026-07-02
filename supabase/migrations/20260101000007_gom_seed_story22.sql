-- ============================================================================
-- EA360 — Migração 0007: Seed completo do GOM (Story 2.2)
-- ----------------------------------------------------------------------------
-- AC da Story 2.2:
--   AC1: 3 pilares em gom_pillars (Ads, Afiliações, Parcerias).
--   AC2: categorias em gom_categories conforme o guia de advertising EA360.
--   AC3: ~50 canais em gom_channels com notas 1..5 para os 5 atributos
--        (Custo, Payback, Controle, Risco, Escala).
--   AC4: nenhum canal com NULL nos 5 score columns.
--   AC5: seed reproduzível como migração SQL (este arquivo).
--   AC6: SELECT COUNT(*) FROM gom_channels >= 45.
--
-- IDS: REUSE > ADAPT > CREATE.
--   A verdade canônica do catálogo já vive em 20260101000000_init_ea360.sql
--   (3 pilares, 7 categorias, 49 canais com os 5 scores 1..5). Esta migração
--   NÃO duplica nem reinventa os dados: re-afirma exatamente esses mesmos slugs
--   de forma IDEMPOTENTE (`ON CONFLICT (slug) DO NOTHING`), tornando o seed
--   reproduzível e auto-contido (AC5) sem causar regressão se a init já rodou.
--
--   Mapeamento dos 5 atributos do AC3 para as colunas-base 1..5:
--     Custo    -> capital_intensity   (col. gerada cost_score    = capital_intensity)
--     Payback  -> liquidity           (col. gerada payback_score = liquidity)
--     Controle -> control_score
--     Risco    -> risk_score
--     Escala   -> scalability         (col. gerada scale_score   = scalability)
--   cost_score/payback_score/scale_score são GENERATED STORED (Story 2.1):
--   o INSERT escreve nas colunas-base; os scores canônicos derivam delas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AC1 — Pilares (idempotente por slug)
-- ----------------------------------------------------------------------------
insert into public.gom_pillars (slug, kind, name, description, sort) values
  ('ads',        'ads',        'Ads (mídia paga)',         'Comprar e vender mídia.',                  1),
  ('afiliacoes', 'afiliacoes', 'Afiliações (performance)', 'Ser afiliado e ter o próprio programa.',   2),
  ('parcerias',  'parcerias',  'Parcerias (estratégicas)', 'Audiência, distribuição e estruturais.',   3)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. AC2 — Categorias (idempotente por slug)
-- ----------------------------------------------------------------------------
insert into public.gom_categories (pillar_id, slug, name, description, sort)
select p.id, v.slug, v.name, v.description, v.sort
from (values
  ('ads',        'ads_comprando',     'Comprando mídia',          'Aquisição paga.',                          1),
  ('ads',        'ads_vendendo',      'Vendendo mídia',           'Virando publisher da própria audiência.',  2),
  ('afiliacoes', 'afil_sendo',        'Sendo afiliado',           'Promove outros, ganha comissão.',          1),
  ('afiliacoes', 'afil_programa',     'Tendo seu programa',       'Outros promovem você.',                    2),
  ('parcerias',  'parc_audiencia',    'Audiência e co-marketing', 'Somar e trocar públicos.',                 1),
  ('parcerias',  'parc_distribuicao', 'Distribuição e canal',     'Alguém distribui seu produto.',            2),
  ('parcerias',  'parc_estruturais',  'Estruturais e de produto', 'Alianças, licença, franquia, JV.',         3)
) as v(pillar_slug, slug, name, description, sort)
join public.gom_pillars p on p.slug = v.pillar_slug
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 3. AC3/AC4 — Canais (49) com os 5 scores 1..5. Idempotente por slug.
--    Ordem dos scores nas values: liquidity, control_score, scalability,
--    risk_score, capital_intensity  (todos NOT NULL 1..5 -> AC4 garantido).
-- ----------------------------------------------------------------------------
insert into public.gom_channels
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
join public.gom_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 4. GATE determinístico — falha o `supabase db push` se o seed não bater os AC
-- ----------------------------------------------------------------------------
do $$
declare
  pillar_count   int;
  channel_count  int;
  null_scores    int;
  distinct_pillars int;
begin
  -- AC1: 3 pilares
  select count(*) into pillar_count from public.gom_pillars
    where slug in ('ads','afiliacoes','parcerias');
  if pillar_count < 3 then
    raise exception 'GOM SEED GATE [AC1]: esperados 3 pilares, encontrados %', pillar_count;
  end if;

  -- AC3/AC6: >= 45 canais
  select count(*) into channel_count from public.gom_channels;
  if channel_count < 45 then
    raise exception 'GOM SEED GATE [AC6]: COUNT(gom_channels)=% (< 45)', channel_count;
  end if;

  -- AC4: nenhum NULL nos 5 score columns (base + gerados)
  select count(*) into null_scores from public.gom_channels
    where liquidity is null or control_score is null or scalability is null
       or risk_score is null or capital_intensity is null
       or cost_score is null or payback_score is null or scale_score is null;
  if null_scores > 0 then
    raise exception 'GOM SEED GATE [AC4]: % canais com score NULL', null_scores;
  end if;

  -- AC1/AC2: canais distribuídos pelos 3 pilares
  select count(distinct pl.id) into distinct_pillars
    from public.gom_channels ch
    join public.gom_categories cat on cat.id = ch.category_id
    join public.gom_pillars pl on pl.id = cat.pillar_id;
  if distinct_pillars < 3 then
    raise exception 'GOM SEED GATE [AC1/AC2]: canais cobrem só % pilar(es), esperado 3', distinct_pillars;
  end if;

  raise notice 'GOM SEED GATE Story 2.2: OK — % pilares, % canais, 0 NULL scores, % pilares cobertos.',
    pillar_count, channel_count, distinct_pillars;
end $$;

-- ============================================================================
-- Fim — Seed completo do GOM (Story 2.2).
-- ============================================================================
