"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  buildTemplatesSystemPrompt,
  buildTemplatesUserPrompt,
  buildFallbackTemplates,
  parseTemplates,
  type WhatsAppTemplate,
} from "@/lib/executor/copy";
import { getLatestFunnel } from "@/app/app/executor/funnel/actions";
import type { FunnelStructure } from "@/lib/executor/funnel";

/**
 * Forja de copy (Story 8.2 — AC1, AC4, AC6). Gera templates via LLM (Anthropic);
 * se a chave/LLM falhar, usa fallback determinístico (tolerante a falha). Persiste
 * em `whatsapp_templates`. RLS por business.
 */
const TEMPLATE_MODEL = "claude-3-5-sonnet-latest";

export type GenerateTemplatesResult =
  | { ok: true; templates: WhatsAppTemplate[]; source: "llm" | "fallback" }
  | { ok: false; error: string };

export async function generateWhatsAppTemplates(): Promise<GenerateTemplatesResult> {
  const latest = await getLatestFunnel();
  if (!latest.ok || !latest.structure) {
    return { ok: false, error: "Configure um funil primeiro (Story 8.1)." };
  }
  const funnel: FunnelStructure = latest.structure;

  const templates = await generateViaLlm(funnel).catch(() => []);
  const final = templates.length > 0 ? templates : buildFallbackTemplates(funnel);
  const source: "llm" | "fallback" = templates.length > 0 ? "llm" : "fallback";

  const supabase = await createClient();
  const { data: fn } = await supabase
    .from("funnels")
    .select("id, business_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; business_id: string }>();
  if (!fn) return { ok: false, error: "Funil não encontrado." };

  const { error } = await supabase.from("whatsapp_templates").insert(
    final.map((t) => ({
      funnel_id: fn.id,
      business_id: fn.business_id,
      name: t.name,
      category: t.category,
      language: t.language,
      stage: t.stage ?? null,
      body_text: t.bodyText,
      header_text: t.headerText ?? null,
      footer_text: t.footerText ?? null,
      buttons: (t.buttons ?? null) as unknown as object,
    }))
  );
  if (error) return { ok: false, error: error.message };

  return { ok: true, templates: final, source };
}

async function generateViaLlm(funnel: FunnelStructure): Promise<WhatsAppTemplate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") return [];
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: TEMPLATE_MODEL,
    max_tokens: 1500,
    system: buildTemplatesSystemPrompt(),
    messages: [{ role: "user", content: buildTemplatesUserPrompt(funnel) }],
  });
  const raw = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseTemplates(raw);
}

export async function getTemplates(): Promise<{
  ok: boolean;
  templates: (WhatsAppTemplate & { id: string })[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("id, name, category, language, stage, body_text, header_text, footer_text")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, templates: [], error: error.message };

  const rows = (data ?? []) as {
    id: string;
    name: string;
    category: WhatsAppTemplate["category"];
    language: string;
    stage: string | null;
    body_text: string;
    header_text: string | null;
    footer_text: string | null;
  }[];
  return {
    ok: true,
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      language: r.language,
      stage: r.stage ?? undefined,
      bodyText: r.body_text,
      headerText: r.header_text ?? undefined,
      footerText: r.footer_text ?? undefined,
    })),
  };
}
