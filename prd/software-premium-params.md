---
name: software-premium-params
description: Define o padrão Premium para planejar, especificar, implementar e revisar mini-apps com uso completo de LLMs pagas, múltiplos provedores, agentes de desenvolvimento, geração multimodal, APIs externas pagas, controle de custo, segurança, histórico e exportação de artefatos. Use esta skill quando o mini-app for parte de uma suite Premium e precisar produzir artefatos profissionais com IA avançada.
version: 1.0.0
owner: SextouTools PRO
language: pt-BR
compatible_with:
  - Codex
  - Claude Code
  - Google Antigravity
---

# Skill: software-premium-params

## 1. Objetivo

Esta skill define o padrão de desenvolvimento para **mini-apps Premium** da empresa.

Um mini-app Premium não deve ser apenas um formulário que chama um LLM. Ele deve funcionar como uma **fábrica de artefatos profissionais**, combinando:

- LLMs pagas e configuráveis.
- Modelos multimodais de texto, imagem, áudio, vídeo, visão e raciocínio.
- Agentes de apoio para desenvolvimento, revisão, testes e manutenção.
- APIs externas pagas para potencializar o resultado.
- Controle de custo por execução.
- Histórico completo por usuário.
- Exportação de artefatos prontos para uso.
- Experiência mobile-first, simples e guiada.
- Segurança de chaves, logs e dados sensíveis.

Esta skill deve ser usada para criar, revisar ou implementar mini-apps Premium como:

- Gerador de Vídeos Virais.
- Gerador de Imagens Virais.
- Gerador de Email Marketing.
- Gestor de Redes Sociais.
- Gestor de Canal do YouTube.
- Gerador de Contratos Multi-idiomas.
- Gerador de Apresentações Virais.
- Gerador de E-books.
- Gerador de Infográficos.
- Gerador de Propostas, catálogos, press kits, anúncios e outros artefatos comerciais.

---

## 2. Relação com a skill base

Esta skill é uma evolução Premium da skill `software-params-miniapps`.

A skill base continua obrigatória para:

- Suite de mini-apps.
- Autenticação obrigatória.
- Design system único.
- Mobile-first.
- Histórico por usuário.
- Dropdowns sempre que possível.
- Interface simples.
- Salvamento de entradas, saídas, status e metadados.

A diferença é que esta skill Premium substitui a lógica de **LLM leve e gratuito** por uma arquitetura avançada com:

- Múltiplos provedores LLM.
- Model routing.
- Fallback inteligente.
- APIs pagas externas.
- Agentes especializados.
- Cálculo de custo.
- Observabilidade.
- Artefatos exportáveis.

Regra: nunca remover os princípios da skill base. Apenas ampliá-los para a camada Premium.

---

## 3. Quando usar esta skill

Use `software-premium-params` quando o pedido envolver qualquer uma destas condições:

1. O mini-app usa LLMs pagas.
2. O mini-app precisa de múltiplos modelos configuráveis.
3. O mini-app gera artefatos profissionais, como PDF, DOCX, PPTX, MP4, PNG, HTML, CSV, ZIP, Markdown ou pacotes para redes sociais.
4. O mini-app usa imagem, áudio, vídeo, voz, OCR, visão computacional ou geração multimodal.
5. O mini-app exige integração com APIs externas pagas.
6. O mini-app precisa de roteamento por custo, qualidade, velocidade ou modalidade.
7. O mini-app será desenvolvido ou revisado por Codex, Claude Code ou Antigravity.
8. O mini-app precisa de plano de banco de dados, schemas, jobs, filas, armazenamento e auditoria.

Não use esta skill para mini-apps gratuitos, estáticos, sem LLM ou com apenas uma chamada simples de texto.

---

## 4. Princípios Premium obrigatórios

Todo mini-app Premium deve seguir estes princípios:

1. **Artefato primeiro**  
   O resultado final deve ser um artefato utilizável: documento, peça visual, vídeo, roteiro, campanha, calendário, apresentação, contrato, e-book, infográfico, página, relatório ou pacote de arquivos.

2. **Usuário não conversa com infraestrutura**  
   O usuário não escolhe termos técnicos como temperature, max tokens, embeddings ou routing. Ele escolhe objetivo, tom, canal, idioma, formato, nicho e nível de qualidade.

3. **Múltiplas LLMs configuráveis**  
   O app deve suportar mais de um provedor/modelo, com configuração por app, por tarefa, por plano e por tipo de artefato.

4. **Modelo certo para cada etapa**  
   Não usar o mesmo modelo para tudo. Planejamento, escrita, revisão, imagem, vídeo, voz, tradução, análise jurídica, SEO e exportação podem exigir modelos diferentes.

5. **APIs externas como potencializadores**  
   APIs pagas devem ser usadas para entregar resultado superior, não como enfeite.

6. **Custos medidos por execução**  
   Toda geração Premium deve registrar custo estimado, custo real quando disponível, tokens, arquivos gerados, chamadas externas e tempo de execução.

7. **Segurança de credenciais**  
   Nenhuma API key pode aparecer no client, nos logs públicos, no histórico exportável ou nos prompts visíveis ao usuário.

8. **Agentes com limites claros**  
   Codex, Claude Code e Antigravity podem ser usados como agentes de desenvolvimento, revisão, QA, geração de schemas, refatoração, testes e documentação. No produto final, os agentes operacionais devem ser implementados por APIs, filas e tool calls controladas no servidor.

9. **Human-in-the-loop quando houver risco**  
   Contratos, conteúdo jurídico, claims sensíveis, anúncios regulados, uso de marcas, política, saúde, finanças e imigração exigem avisos, revisão humana e limites de responsabilidade.

10. **Exportação e reuso**  
    O resultado deve permitir copiar, baixar, regenerar, duplicar, versionar, favoritar e transformar em outro formato.

---

## 5. Compatibilidade com Codex, Claude Code e Antigravity

Esta skill deve ser escrita em Markdown com frontmatter simples para ser lida como uma skill por agentes modernos.

### 5.1 Estrutura recomendada

```text
software-premium-params/
├── SKILL.md
├── references/
│   ├── api-integrations.md
│   ├── db-schema-premium.sql
│   ├── prompt-contracts.md
│   └── artifact-formats.md
├── scripts/
│   ├── validate-env.example.ts
│   ├── estimate-cost.example.ts
│   └── generate-app-manifest.example.ts
└── assets/
    ├── prd-template.md
    ├── app-config-template.yaml
    └── agent-handoff-template.md
```

### 5.2 Uso em Codex

Quando usada em Codex, esta skill deve orientar o agente a:

- Ler o repositório antes de propor mudanças.
- Identificar stack, rotas, banco, autenticação, design system e padrões existentes.
- Criar plano de implementação por etapas.
- Gerar ou atualizar PRD, schema, rotas server-side, componentes UI, testes e documentação.
- Rodar lint, typecheck, testes e build quando disponíveis.
- Nunca modificar arquivos sensíveis sem explicitar o motivo.
- Criar mudanças pequenas e revisáveis.

### 5.3 Uso em Claude Code

Quando usada em Claude Code, esta skill deve orientar o agente a:

- Usar leitura ampla de contexto quando o mini-app afetar múltiplos arquivos.
- Criar subagentes lógicos quando o trabalho for complexo: `architecture`, `backend`, `frontend`, `db`, `security`, `qa`.
- Usar hooks ou comandos de verificação quando existirem.
- Atualizar documentação do projeto.
- Explicar riscos de custo, segurança e UX antes de implementar integrações pagas.
- Nunca expor chaves reais em prompts, commits ou logs.

### 5.4 Uso em Antigravity

Quando usada em Antigravity, esta skill deve orientar o agente a:

- Planejar, executar e verificar tarefas com evidências.
- Usar navegador, terminal e editor apenas dentro do workspace autorizado.
- Produzir artifacts de verificação: plano, checklist, screenshots, logs de testes e resumo de arquivos alterados.
- Trabalhar com agentes paralelos somente quando houver separação clara de tarefas.
- Confirmar comandos destrutivos antes de executar.
- Isolar ambiente de desenvolvimento quando houver risco de apagar arquivos, rodar migrations ou consumir APIs pagas.

### 5.5 Regra de interoperabilidade

O conteúdo principal desta skill deve evitar dependência exclusiva de uma ferramenta. Sempre que houver instrução específica de Codex, Claude Code ou Antigravity, também deve existir uma versão genérica aplicável a qualquer agente de desenvolvimento.

---

## 6. Arquitetura funcional Premium

Todo mini-app Premium deve seguir esta arquitetura mínima:

```text
Suite Premium
└── Mini-app Premium
    ├── Auth guard
    ├── App manifest
    ├── Formulário guiado mobile-first
    ├── Configuração de artefato
    ├── Validação server-side
    ├── Orquestrador de execução
    │   ├── Roteador de modelos
    │   ├── Prompt builder
    │   ├── Tool/API calls
    │   ├── Fallback de modelo
    │   ├── Cost tracker
    │   └── Safety checks
    ├── Geração de artefato
    ├── Pós-processamento
    ├── Exportação
    ├── Salvamento de histórico
    ├── Versionamento
    └── Tela de resultado
```

### 6.1 Fases de execução

Cada execução Premium deve ser dividida em fases:

1. `input_validation`
2. `planning`
3. `generation`
4. `tool_enrichment`
5. `review`
6. `post_processing`
7. `artifact_export`
8. `history_save`
9. `cost_recording`
10. `user_delivery`

Cada fase deve poder ser logada separadamente.

---

## 7. Configuração de múltiplas LLMs

### 7.1 Conceito

O mini-app Premium deve ter um arquivo de configuração de modelos por app.

Exemplo:

```yaml
app_slug: viral-video-generator
llm_mode: premium_multi_model
routing_strategy: quality_first
fallback_strategy: same_modality_lower_cost
models:
  planner:
    provider: openai
    model: gpt-5.1
    purpose: planejamento, estrutura e decomposição
    temperature: 0.4
    max_output_tokens: 3000
  writer:
    provider: anthropic
    model: claude-sonnet-latest
    purpose: copywriting, roteiro e revisão editorial
    temperature: 0.7
    max_output_tokens: 5000
  visual:
    provider: openai
    model: image-generation-model
    purpose: geração de imagens e thumbnails
  video:
    provider: runway
    model: video-generation-model
    purpose: geração ou composição de vídeo
  voice:
    provider: elevenlabs
    model: multilingual-voice-model
    purpose: narração multilíngue
  reviewer:
    provider: google
    model: gemini-pro-latest
    purpose: revisão multimodal, checagem e adequação
```

### 7.2 Provedores suportados

A arquitetura deve permitir configuração, por ambiente, de provedores como:

- OpenAI.
- Anthropic.
- Google Gemini.
- OpenRouter.
- Mistral.
- Cohere.
- Perplexity.
- xAI.
- Groq.
- Together AI.
- Replicate.
- Stability AI.
- Runway.
- ElevenLabs.
- Fal.ai.
- Ideogram.
- Canva.

A lista é extensível. Não hardcodar provedores como única fonte de verdade.

### 7.3 Perfis de roteamento

Cada mini-app deve escolher uma estratégia:

```yaml
routing_profiles:
  cost_saver:
    description: Usa o modelo mais barato que atende à qualidade mínima.
  balanced:
    description: Equilibra custo, velocidade e qualidade.
  quality_first:
    description: Prioriza melhor resultado, mesmo com custo maior.
  speed_first:
    description: Prioriza baixa latência.
  multimodal_first:
    description: Prioriza modelos que aceitam texto, imagem, áudio ou vídeo.
  legal_safe:
    description: Usa revisão adicional, avisos e logs reforçados para documentos sensíveis.
```

### 7.4 Seleção por tarefa

Nunca selecionar modelo apenas pelo nome. Selecionar por capacidades:

```yaml
capabilities:
  text_generation: true
  long_context: true
  json_schema: true
  function_calling: true
  vision: false
  image_generation: false
  audio_generation: false
  video_generation: false
  embeddings: false
  web_search: false
  citations: false
  code_execution: false
```

### 7.5 Fallback Premium

Se o modelo principal falhar:

1. Registrar erro técnico.
2. Tentar modelo equivalente do mesmo provedor.
3. Tentar provedor alternativo com mesma modalidade.
4. Reduzir complexidade se necessário.
5. Avisar o usuário apenas se a qualidade ou formato final forem afetados.
6. Salvar todas as tentativas em `premium_llm_calls`.

---

## 8. Agentes de desenvolvimento e agentes operacionais

### 8.1 Diferença obrigatória

Separar sempre:

- **Agentes de desenvolvimento:** Codex, Claude Code, Antigravity ou outros agentes usados por desenvolvedores para construir, revisar, testar e manter o mini-app.
- **Agentes operacionais do produto:** agentes internos do próprio mini-app, executados via APIs, filas e rotas server-side.

Codex, Claude Code e Antigravity não devem ser tratados como dependências obrigatórias do usuário final do mini-app.

### 8.2 Agentes de desenvolvimento recomendados

```yaml
dev_agents:
  product_architect:
    responsibilities:
      - transformar ideia em PRD
      - definir arquitetura
      - mapear riscos
      - sugerir APIs pagas
  backend_builder:
    responsibilities:
      - criar rotas server-side
      - integrar provedores LLM
      - criar schemas DB
      - implementar cost tracker
  frontend_builder:
    responsibilities:
      - criar UI mobile-first
      - usar design system
      - criar estados de loading, erro e resultado
  prompt_engineer:
    responsibilities:
      - criar prompt contracts
      - validar JSON schemas
      - criar prompts por etapa
  qa_reviewer:
    responsibilities:
      - rodar testes
      - validar fluxos
      - revisar segurança
      - verificar exportações
  cost_guardian:
    responsibilities:
      - estimar custo por geração
      - definir limites por plano
      - criar alertas de abuso
```

### 8.3 Agentes operacionais do produto

Mini-apps Premium podem usar agentes internos como:

```yaml
runtime_agents:
  planner_agent:
    function: cria plano do artefato
  creator_agent:
    function: gera conteúdo principal
  visual_agent:
    function: cria ou seleciona elementos visuais
  compliance_agent:
    function: revisa riscos, claims e restrições
  translation_agent:
    function: adapta idioma, cultura e tom
  export_agent:
    function: monta arquivo final
  quality_agent:
    function: faz checklist de qualidade antes de entregar
```

### 8.4 Regras para agentes operacionais

- Todo agente deve ter papel claro.
- Todo agente deve ter entrada e saída estruturadas.
- Todo agente deve registrar custo e status.
- Nenhum agente deve acessar APIs sem permissão explícita da configuração do app.
- Nenhum agente deve executar comandos de sistema no runtime do produto final.
- Se usar filas, cada etapa deve ser idempotente.

---

## 9. APIs externas pagas como potencializadores

### 9.1 Categorias de APIs

Sempre que criar um mini-app Premium, avaliar APIs nestas categorias:

| Categoria       | Uso                                        | Exemplos de provedores                                   |
| --------------- | ------------------------------------------ | -------------------------------------------------------- |
| LLM texto       | Planejamento, copy, análise, revisão       | OpenAI, Anthropic, Gemini, Mistral, OpenRouter           |
| Imagem          | Thumbnails, posts, banners, mockups        | OpenAI Images, Stability AI, Ideogram, Replicate, Fal.ai |
| Vídeo           | Reels, Shorts, cenas, motion               | Runway, Pika, Luma, Kling, Replicate                     |
| Voz             | Narração, locução, dublagem                | ElevenLabs, OpenAI Audio, Google TTS                     |
| Speech-to-text  | Transcrição e reaproveitamento de conteúdo | OpenAI Audio, AssemblyAI, Deepgram                       |
| Pesquisa web    | Dados atuais, referências, tendências      | Perplexity, Tavily, SerpAPI, Firecrawl                   |
| E-mail          | Disparo e templates                        | SendGrid, Mailchimp, Postmark, Resend                    |
| Documentos      | PDF, DOCX, contratos, apresentações        | DocRaptor, PDFShift, CloudConvert, Canva API             |
| Assinatura      | Contratos e aceite                         | DocuSign, Dropbox Sign, PandaDoc                         |
| Pagamento       | Créditos, planos e cobrança                | Stripe, Paddle                                           |
| Armazenamento   | Arquivos gerados                           | Supabase Storage, Cloudflare R2, S3                      |
| Analytics       | Métricas e funil                           | PostHog, Mixpanel, GA4                                   |
| Observabilidade | Erros, traces e logs                       | Sentry, Axiom, Logtail                                   |
| CRM             | Exportação de leads e contatos             | HubSpot, Pipedrive, Salesforce                           |
| Automação       | Workflows externos                         | N8N, Make, Zapier                                        |
| Design          | Templates e artes editáveis                | Canva, Figma                                             |
| YouTube         | SEO, calendário, metadata                  | YouTube Data API                                         |
| Redes sociais   | Publicação e métricas                      | Meta Graph API, TikTok API, LinkedIn API                 |

### 9.2 Regra de escolha de API

Antes de recomendar uma API paga, responder:

```text
Esta API melhora diretamente o artefato final?
Reduz trabalho manual real?
É compatível com o orçamento do plano Premium?
Permite controle de custo por execução?
Tem fallback se falhar?
Exige consentimento do usuário?
Lida com dados sensíveis?
Possui limites de uso claros?
```

Se a resposta for fraca, não adicionar a API ao MVP.

### 9.3 Potencializadores por tipo de app

```yaml
viral_video_generator:
  recommended_apis:
    - OpenAI ou Anthropic para roteiro
    - Runway, Luma, Pika ou Replicate para vídeo
    - ElevenLabs para narração
    - OpenAI Audio ou AssemblyAI para transcrição
    - YouTube Data API ou TikTok trends provider para insights

viral_image_generator:
  recommended_apis:
    - OpenAI Images, Ideogram, Stability AI ou Fal.ai
    - Canva API para templates editáveis
    - Cloudinary para resize e otimização

email_marketing_generator:
  recommended_apis:
    - OpenAI ou Claude para copy
    - SendGrid, Mailchimp, Postmark ou Resend para templates e envio
    - ZeroBounce ou NeverBounce para validação de listas

social_media_manager:
  recommended_apis:
    - OpenAI/Claude para calendário e copy
    - Canva/Figma para templates
    - Meta Graph API, LinkedIn API e TikTok API para publicação ou análise

contract_generator:
  recommended_apis:
    - Claude/OpenAI para geração multilíngue
    - DeepL ou Google Translate para tradução assistida
    - DocuSign/Dropbox Sign para assinatura
    - PDFShift/DocRaptor para PDF final

presentation_generator:
  recommended_apis:
    - OpenAI/Claude/Gemini para narrativa
    - Canva API ou Google Slides API para montagem
    - Image API para capas e gráficos

ebook_generator:
  recommended_apis:
    - LLM longo contexto para estrutura e capítulos
    - Image API para capa
    - PDF/ePub generator
    - Plagiarism/similarity checker se necessário

infographic_generator:
  recommended_apis:
    - LLM para síntese
    - Image/chart API para visual
    - Canva/Figma para templates
    - Datawrapper/QuickChart para gráficos
```

---

## 10. Prompt contracts Premium

### 10.1 Regras gerais

Todo mini-app Premium deve usar prompt contracts por etapa.

Evitar prompt único gigante.

Preferir:

```text
input → planner → creator → reviewer → exporter
```

### 10.2 System prompt padrão

```text
Você é um agente da SextouTools PRO executando um mini-app Premium.
Sua função é produzir artefatos comerciais profissionais para empreendedores brasileiros nos EUA.
Siga exatamente o contrato de saída solicitado.
Não exponha raciocínio interno.
Não invente dados factuais sensíveis.
Quando houver risco jurídico, financeiro, médico, imigratório, regulatório ou de compliance, inclua aviso de revisão profissional.
Responda no idioma solicitado pelo usuário.
Se o idioma não for informado, use pt-BR.
```

### 10.3 Saída JSON obrigatória

Sempre que possível, exigir JSON validável.

Exemplo:

```json
{
  "artifact_title": "",
  "artifact_type": "",
  "language": "pt-BR",
  "summary": "",
  "sections": [],
  "copy_blocks": [],
  "visual_brief": {},
  "export_formats": [],
  "quality_checklist": [],
  "warnings": [],
  "next_actions": []
}
```

### 10.4 Revisão automática

Todo artefato Premium deve passar por pelo menos uma revisão:

- Clareza.
- Adequação ao público.
- Tom de marca.
- Consistência de idioma.
- Risco de promessa exagerada.
- Campos obrigatórios preenchidos.
- Exportabilidade.

Para apps sensíveis, adicionar revisão extra:

- Contratos: revisão legal humana recomendada.
- Saúde: revisão profissional recomendada.
- Finanças: não prometer resultado.
- Imigração: não substituir advogado.
- Ads: cuidado com claims proibidos.

---

## 11. Banco de dados Premium

Além das tabelas base `mini_apps` e `mini_app_runs`, mini-apps Premium devem considerar as tabelas abaixo.

### 11.1 `premium_model_providers`

```sql
create table premium_model_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  base_url text,
  is_active boolean default true,
  supports_text boolean default false,
  supports_vision boolean default false,
  supports_image boolean default false,
  supports_audio boolean default false,
  supports_video boolean default false,
  supports_embeddings boolean default false,
  supports_tool_calls boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.2 `premium_model_configs`

```sql
create table premium_model_configs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id),
  provider_id uuid not null references premium_model_providers(id),
  role text not null,
  model_id text not null,
  routing_profile text default 'balanced',
  temperature numeric,
  max_output_tokens integer,
  input_modalities text[],
  output_modalities text[],
  cost_priority integer default 5,
  quality_priority integer default 5,
  latency_priority integer default 5,
  is_default boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.3 `premium_api_integrations`

```sql
create table premium_api_integrations (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id),
  provider_slug text not null,
  provider_name text not null,
  integration_type text not null,
  purpose text,
  required_for_mvp boolean default false,
  requires_user_consent boolean default false,
  estimated_cost_per_run numeric,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.4 `premium_app_runs`

```sql
create table premium_app_runs (
  id uuid primary key default gen_random_uuid(),
  mini_app_run_id uuid references mini_app_runs(id),
  user_id uuid not null,
  app_id uuid not null references mini_apps(id),
  execution_mode text default 'standard',
  routing_profile text default 'balanced',
  artifact_type text not null,
  artifact_status text default 'pending',
  total_estimated_cost numeric default 0,
  total_actual_cost numeric default 0,
  total_latency_ms integer,
  total_llm_calls integer default 0,
  total_api_calls integer default 0,
  total_files_generated integer default 0,
  safety_level text default 'normal',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.5 `premium_llm_calls`

```sql
create table premium_llm_calls (
  id uuid primary key default gen_random_uuid(),
  premium_run_id uuid not null references premium_app_runs(id),
  user_id uuid not null,
  app_id uuid not null references mini_apps(id),
  phase text not null,
  provider_slug text not null,
  model_id text not null,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  actual_cost numeric,
  latency_ms integer,
  status text not null,
  error_message text,
  request_hash text,
  created_at timestamptz default now()
);
```

### 11.6 `premium_tool_calls`

```sql
create table premium_tool_calls (
  id uuid primary key default gen_random_uuid(),
  premium_run_id uuid not null references premium_app_runs(id),
  user_id uuid not null,
  app_id uuid not null references mini_apps(id),
  phase text not null,
  provider_slug text not null,
  tool_name text not null,
  input_payload jsonb,
  output_payload jsonb,
  estimated_cost numeric,
  actual_cost numeric,
  latency_ms integer,
  status text not null,
  error_message text,
  created_at timestamptz default now()
);
```

### 11.7 `generated_artifacts`

```sql
create table generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  premium_run_id uuid not null references premium_app_runs(id),
  user_id uuid not null,
  app_id uuid not null references mini_apps(id),
  artifact_type text not null,
  title text,
  description text,
  file_url text,
  file_path text,
  mime_type text,
  file_size_bytes bigint,
  export_format text,
  version integer default 1,
  metadata jsonb,
  is_favorite boolean default false,
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 11.8 `artifact_versions`

```sql
create table artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references generated_artifacts(id),
  premium_run_id uuid references premium_app_runs(id),
  version integer not null,
  change_summary text,
  file_url text,
  content_payload jsonb,
  created_by uuid,
  created_at timestamptz default now()
);
```

### 11.9 `premium_cost_ledger`

```sql
create table premium_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  app_id uuid not null references mini_apps(id),
  premium_run_id uuid references premium_app_runs(id),
  cost_type text not null,
  provider_slug text,
  amount numeric not null default 0,
  currency text default 'USD',
  units numeric,
  unit_label text,
  metadata jsonb,
  created_at timestamptz default now()
);
```

### 11.10 `user_premium_limits`

```sql
create table user_premium_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_slug text not null,
  monthly_credit_limit numeric,
  monthly_run_limit integer,
  max_file_storage_mb integer,
  max_artifact_versions integer,
  reset_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## 12. Segurança, privacidade e governança

### 12.1 Credenciais

- Guardar API keys somente em secrets do servidor.
- Nunca persistir API key em `input_payload`, `output_payload`, logs, arquivos exportados ou prompts.
- Usar referências como `provider_slug` e `secret_ref`, não valores reais.
- Separar chaves por ambiente: `development`, `staging`, `production`.

### 12.2 Dados sensíveis

O mini-app deve identificar quando o usuário enviar:

- Documentos pessoais.
- Informações financeiras.
- Informações médicas.
- Dados de imigração.
- Contratos.
- Dados de menores.
- Segredos comerciais.

Nesses casos:

- Reduzir retenção quando possível.
- Permitir apagar histórico.
- Mostrar aviso de privacidade.
- Evitar enviar dados para provedores desnecessários.
- Registrar consentimento se a API externa exigir.

### 12.3 Logs

Logs técnicos devem conter:

- IDs.
- Status.
- Provedor.
- Modelo.
- Fase.
- Latência.
- Custo.
- Erro sanitizado.

Logs não devem conter:

- API keys.
- Prompt completo com PII quando não necessário.
- Documentos integrais.
- Conteúdo sensível exportável.

### 12.4 Rate limit e abuso

Cada mini-app Premium deve ter:

```yaml
premium_usage_limits:
  per_user_daily_runs: configurable
  per_user_monthly_credits: configurable
  max_input_chars: configurable
  max_file_upload_mb: configurable
  max_files_per_run: configurable
  max_parallel_runs: configurable
  suspicious_activity_captcha: true
  admin_cost_alerts: true
```

---

## 13. Exportação de artefatos

### 13.1 Formatos suportados

Escolher formatos conforme o app:

| Artefato     | Formatos                               |
| ------------ | -------------------------------------- |
| Texto longo  | Markdown, DOCX, PDF, HTML              |
| E-book       | PDF, EPUB, DOCX, Markdown              |
| Apresentação | PPTX, PDF, Google Slides, Canva design |
| Imagem       | PNG, JPG, WebP, SVG quando aplicável   |
| Vídeo        | MP4, MOV, WebM                         |
| Áudio        | MP3, WAV, M4A                          |
| Tabela       | CSV, XLSX, JSON                        |
| Campanha     | ZIP, CSV, HTML, JSON, Markdown         |
| Contrato     | DOCX, PDF, assinatura externa          |

### 13.2 Regras de exportação

- Gerar preview antes de download quando o artefato for visual.
- Salvar arquivo no storage da suite.
- Salvar metadados do arquivo em `generated_artifacts`.
- Permitir regenerar apenas uma etapa quando possível.
- Gerar nome de arquivo limpo e previsível.

Exemplo:

```text
{{app_slug}}/{{user_id}}/{{yyyy}}/{{mm}}/{{run_id}}/{{artifact_slug}}.pdf
```

---

## 14. Estrutura padrão de PRD Premium

Quando esta skill for usada para criar um mini-app Premium, responder neste formato:

```markdown
# Mini-App Premium PRD: {{APP_NAME}}

## 1. Visão geral

- Suite:
- Slug:
- Categoria:
- Usuário-alvo:
- Dor principal:
- Promessa:
- Artefato principal:

## 2. Resultado esperado

- Artefatos gerados:
- Formatos de exportação:
- Tempo esperado de geração:
- Ações pós-resultado:

## 3. Fluxo mobile-first

1. Entrada
2. Seleção de objetivo
3. Upload ou contexto
4. Configuração guiada
5. Revisão antes de gerar
6. Geração Premium
7. Preview
8. Exportação
9. Histórico e versões

## 4. Campos do formulário

| Campo | Tipo | Obrigatório | Opções | Observação |
| ----- | ---- | ----------- | ------ | ---------- |

## 5. Configuração de LLMs

| Fase | Provedor sugerido | Modelo/Capacidade | Motivo | Fallback |
| ---- | ----------------- | ----------------- | ------ | -------- |

## 6. Agentes operacionais

| Agente | Função | Entrada | Saída | Ferramentas/APIs |
| ------ | ------ | ------- | ----- | ---------------- |

## 7. APIs externas potencializadoras

| API | Uso | Obrigatória no MVP? | Custo/Risco | Fallback |
| --- | --- | ------------------- | ----------- | -------- |

## 8. Banco de dados

- Tabelas base:
- Tabelas Premium:
- Campos específicos do app:
- Índices recomendados:
- RLS/segurança:

## 9. Prompt contracts

- Planner:
- Creator:
- Reviewer:
- Exporter:
- JSON schema esperado:

## 10. Controle de custo

- Custo estimado por execução:
- Limites por plano:
- Alertas:
- Estratégia de fallback:

## 11. Segurança e compliance

- Dados sensíveis:
- Avisos necessários:
- Revisão humana:
- Retenção:

## 12. Critérios de aceite

- [ ] Exige login.
- [ ] Usa design system.
- [ ] Funciona mobile-first.
- [ ] Usa roteamento Premium de modelos.
- [ ] Registra LLM calls.
- [ ] Registra tool calls.
- [ ] Calcula custo.
- [ ] Salva histórico.
- [ ] Gera artefato exportável.
- [ ] Permite reabrir e versionar.
- [ ] Protege API keys.
- [ ] Tem fallback.
- [ ] Tem erro amigável.
```

---

## 15. App manifest Premium

Cada mini-app Premium deve ter um manifest semelhante a este:

```yaml
app:
  name: "Gerador de Vídeos Virais"
  slug: "viral-video-generator"
  suite: "SextouTools Premium"
  category: "Marketing"
  artifact_types:
    - video_script
    - short_video
    - thumbnail
    - captions
  requires_auth: true
  requires_premium_plan: true
  mobile_first: true

llm:
  mode: premium_multi_model
  routing_profile: balanced
  default_language: pt-BR
  supported_languages:
    - pt-BR
    - en-US
    - es

agents:
  runtime:
    - planner_agent
    - creator_agent
    - reviewer_agent
    - export_agent

integrations:
  required:
    - llm_text_provider
  optional:
    - image_generation_provider
    - video_generation_provider
    - voice_provider
    - storage_provider
    - analytics_provider

storage:
  save_inputs: true
  save_outputs: true
  save_files: true
  version_artifacts: true

cost_control:
  estimate_before_run: true
  record_actual_cost: true
  block_when_user_limit_reached: true

safety:
  pii_detection: true
  human_review_required: false
  sensitive_category: false
```

---

## 16. Checklist obrigatório para implementação

### Produto

- [ ] App pertence a uma suite Premium.
- [ ] App gera artefato utilizável.
- [ ] App não é chat genérico.
- [ ] App tem promessa clara.
- [ ] App tem público-alvo definido.

### UX/UI

- [ ] Mobile-first.
- [ ] Usa Design System v2.
- [ ] Usa dropdowns, presets e exemplos.
- [ ] Tem preview do resultado.
- [ ] Tem exportação clara.
- [ ] Tem histórico e versões.

### LLM e agentes

- [ ] Suporta múltiplos provedores.
- [ ] Tem roteamento por tarefa.
- [ ] Tem fallback.
- [ ] Tem prompt contracts separados.
- [ ] Tem revisão automática.
- [ ] Registra tokens, custo, latência e modelo.

### APIs externas

- [ ] APIs pagas têm finalidade clara.
- [ ] APIs têm fallback.
- [ ] Custos são estimados.
- [ ] Consentimentos são tratados.
- [ ] Chaves ficam no servidor.

### Banco e histórico

- [ ] Salva execução base.
- [ ] Salva execução Premium.
- [ ] Salva LLM calls.
- [ ] Salva tool calls.
- [ ] Salva artefatos.
- [ ] Salva versões.
- [ ] Aplica RLS por usuário.

### Segurança

- [ ] Nenhuma API key no client.
- [ ] Logs sanitizados.
- [ ] PII tratada.
- [ ] Rate limit ativo.
- [ ] Alertas de custo ativos.
- [ ] Comandos destrutivos exigem aprovação no ambiente de agente.

### Compatibilidade com agentes

- [ ] Codex consegue ler e aplicar a skill.
- [ ] Claude Code consegue ler e aplicar a skill.
- [ ] Antigravity consegue ler e aplicar a skill.
- [ ] A skill não depende de uma ferramenta específica.
- [ ] As tarefas são quebradas em passos verificáveis.

---

## 17. Como responder ao usar esta skill

Ao usar esta skill para um novo mini-app Premium, a resposta deve seguir esta ordem:

1. Confirmar nome do app, suite e artefato principal.
2. Definir promessa e público-alvo.
3. Criar PRD Premium simplificado.
4. Definir campos mobile-first e dropdowns.
5. Definir LLMs por etapa.
6. Definir agentes operacionais.
7. Sugerir APIs externas pagas e seus fallbacks.
8. Sugerir tabelas DB base e Premium.
9. Definir exportações.
10. Definir controle de custo.
11. Definir riscos de segurança/compliance.
12. Gerar checklist de implementação para Codex, Claude Code e Antigravity.

A resposta deve ser prática, estruturada e pronta para virar tarefa de desenvolvimento.

---

## 18. Comando mental da skill

Sempre que um mini-app Premium for pedido, pense:

```text
Este app gera um artefato real?
Ele pertence a uma suite Premium?
Está protegido por login?
Usa design system e mobile-first?
Tem histórico e versionamento?
Quais LLMs são necessárias por etapa?
Quais APIs externas realmente melhoram o resultado?
Qual é o custo por execução?
Existe fallback?
Existe risco jurídico, financeiro, médico, imigratório ou de privacidade?
As chaves estão protegidas?
O resultado é exportável?
Codex, Claude Code e Antigravity conseguem implementar isso com passos claros?
```

Se qualquer resposta crítica for “não”, ajustar o plano antes de aprovar o desenvolvimento.

---

## 19. Regras finais

- Mini-app Premium deve parecer produto profissional, não experimento de IA.
- Não adicionar API paga sem justificar valor, custo e fallback.
- Não usar LLM para tarefas que podem ser resolvidas por código determinístico.
- Não enviar dados sensíveis para múltiplos provedores sem necessidade.
- Não gerar contrato, conselho legal, médico, financeiro ou imigratório como verdade final sem aviso de revisão profissional.
- Não esconder custos do administrador da suite.
- Não quebrar compatibilidade mobile-first.
- Não transformar o app em chat aberto quando o objetivo é gerar artefato.
