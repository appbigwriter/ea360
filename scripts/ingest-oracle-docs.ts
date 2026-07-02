import { ingestDocument } from "../src/lib/oracle/ingest";
import { config } from "dotenv";

// Carrega as variáveis de ambiente locais (.env.local) para o script Node
config({ path: ".env.local" });

const mockDocuments = [
  {
    title: "Meta WhatsApp Business - Política de Comércio",
    url: "https://business.whatsapp.com/policy",
    source_type: "meta_policy" as const,
    content:
      "O WhatsApp proíbe a venda de certos bens e serviços. Negócios não podem realizar transações com produtos de saúde, armas, drogas ilícitas, ou produtos e serviços adultos. O envio de catálogos e a utilização de botões de compra estão restritos às contas que passam pela validação do Commerce Policy.",
  },
  {
    title: "Meta WhatsApp Business - Modelos de Mensagem (Templates)",
    url: "https://developers.facebook.com/docs/whatsapp/message-templates",
    source_type: "meta_policy" as const,
    content:
      "Templates de mensagens (modelos) devem ser aprovados antes do envio. Categorias incluem UTILITY, MARKETING e AUTHENTICATION. Qualquer template que infrinja as políticas ou use clickbait agressivo pode ser rejeitado. Você deve usar variáveis apenas para dados dinâmicos.",
  },
  {
    title: "Meta WhatsApp Business - Boas Práticas Anti-ban",
    url: "https://business.whatsapp.com/best-practices",
    source_type: "meta_policy" as const,
    content:
      "Para evitar o banimento da WABA, mantenha a qualidade do seu número de telefone em alta (Verde). Se muitos clientes bloquearem ou denunciarem seu negócio, seu número cairá para qualidade média (Amarela) ou baixa (Vermelha), e eventualmente será banido. Recomenda-se um escape claro para humano.",
  },
  {
    title: "Meta API de Marketing - Limites de Taxa",
    url: "https://developers.facebook.com/docs/graph-api/overview/rate-limiting",
    source_type: "api_docs" as const,
    content:
      "O Graph API usa rate limiting para prevenir abusos. As chamadas de envio de mensagem são limitadas com base no nível da conta (Tiers 1, 2, 3 e 4). Ultrapassar esses limites resultará em erros 429 Too Many Requests.",
  },
  {
    title: "Como verificar sua conta empresarial",
    url: "https://www.facebook.com/business/help",
    source_type: "help_center" as const,
    content:
      "A verificação da empresa garante a autenticidade da sua WABA. Acesse o Gerenciador de Negócios (Business Manager), vá em Centro de Segurança e inicie a Verificação. Envie documentos fiscais atualizados. Aprovações ocorrem geralmente em 2 a 5 dias úteis.",
  },
];

async function run() {
  console.log("Iniciando ingestão de 5 documentos de exemplo...");

  if (!process.env.OPENAI_API_KEY) {
    console.warn("Aviso: OPENAI_API_KEY não definida. O script pode falhar.");
  }

  for (const doc of mockDocuments) {
    try {
      await ingestDocument(doc);
    } catch (e) {
      console.error(`Falha ao ingerir documento: ${doc.title}`, e);
    }
  }

  console.log("Ingestão finalizada.");
}

run();
