import { createClient } from "@/lib/supabase/server";

/**
 * Gera um objeto JSON que representa um workflow importável no n8n.
 * Baseado na estrutura e escape config do funil (Story 8.9).
 */
export async function generateN8nWorkflow(funnelId: string) {
  const supabase = await createClient();

  // 1. Busca os dados do funil e do negócio
  const { data: funnel, error } = await supabase
    .from("funnels")
    .select(
      "objective, bot_disclosure, human_escape_config, structure, business_id, businesses (name)"
    )
    .eq("id", funnelId)
    .single();

  if (error || !funnel) {
    throw new Error("Funnel not found");
  }

  const bizName = (funnel.businesses as unknown as { name?: string })?.name || "Empresa";
  const workflowName = `Funil EA360 - ${bizName} - ${funnel.objective}`;
  const escapeConfig = funnel.human_escape_config as {
    keyword: string;
    handoffMessage: string;
  } | null;

  // 2. Monta os nós do n8n (representação simplificada de MVP)
  const nodes = [
    {
      parameters: {
        httpMethod: "POST",
        path: "whatsapp-webhook",
        options: {},
      },
      name: "WhatsApp Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [100, 300],
    },
    {
      parameters: {
        conditions: {
          string: [
            {
              value1: "={{$json.body.message.text}}",
              operation: "contains",
              value2: escapeConfig ? escapeConfig.keyword : "falar com humano",
            },
          ],
        },
      },
      name: "Human Escape Check",
      type: "n8n-nodes-base.if",
      typeVersion: 1,
      position: [350, 300],
    },
    {
      parameters: {
        message: escapeConfig
          ? escapeConfig.handoffMessage
          : "Transferindo para um atendente humano...",
      },
      name: "Handoff to Human",
      type: "n8n-nodes-base.code",
      typeVersion: 1,
      position: [600, 200],
    },
    {
      parameters: {
        botDisclosure: funnel.bot_disclosure,
        message: "Continuando fluxo automatizado...",
      },
      name: "Bot Flow",
      type: "n8n-nodes-base.code",
      typeVersion: 1,
      position: [600, 400],
    },
  ];

  const connections = {
    "WhatsApp Webhook": {
      main: [[{ node: "Human Escape Check", type: "main", index: 0 }]],
    },
    "Human Escape Check": {
      main: [
        [{ node: "Handoff to Human", type: "main", index: 0 }],
        [{ node: "Bot Flow", type: "main", index: 0 }],
      ],
    },
  };

  const workflow = {
    name: workflowName,
    nodes,
    connections,
    active: false,
    settings: {
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "none",
      saveManualExecutions: false,
      callerPolicy: "workflowsFromSameOwner",
    },
    tags: [],
  };

  return {
    workflow,
    filename: `funnel-${bizName.replace(/\s+/g, "-").toLowerCase()}-${new Date().getTime()}.json`,
  };
}
