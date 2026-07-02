"use server";

import { createClient } from "@/lib/supabase/server";
import { runAntibanRules, type AntibanResult } from "@/lib/executor/antiban";
import { getLatestFunnel } from "@/app/app/executor/funnel/actions";

/**
 * Blindagem anti-ban (Story 8.3 — AC1, AC3, AC6). Roda as regras determinísticas em
 * todos os templates do funil mais recente e persiste em `compliance_checks`. RLS.
 */
export type TemplateCompliance = {
  templateId: string;
  name: string;
  result: AntibanResult;
};

export type AntibanRunResult =
  | { ok: true; checks: TemplateCompliance[]; passRate: number }
  | { ok: false; error: string };

export async function runAntibanChecks(): Promise<AntibanRunResult> {
  const supabase = await createClient();
  const latest = await getLatestFunnel();
  const botDisclosure = latest.ok && latest.structure ? latest.structure.botDisclosure : undefined;

  const { data: templates, error } = await supabase
    .from("whatsapp_templates")
    .select("id, name, body_text, header_text, business_id")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: error.message };

  const rows = (templates ?? []) as {
    id: string;
    name: string;
    body_text: string;
    header_text: string | null;
    business_id: string;
  }[];

  const checks: TemplateCompliance[] = [];
  for (const t of rows) {
    const result = runAntibanRules(
      { name: t.name, bodyText: t.body_text, headerText: t.header_text ?? undefined },
      botDisclosure
    );
    await supabase.from("compliance_checks").insert({
      template_id: t.id,
      business_id: t.business_id,
      check_type: "anti-ban",
      status: result.status,
      flag_level: result.flagLevel,
      issues: result.issues as unknown as object,
    });
    checks.push({ templateId: t.id, name: t.name, result });
  }

  const total = checks.length;
  const noRed = checks.filter((c) => c.result.flagLevel !== "red").length;
  const passRate = total > 0 ? noRed / total : 1; // AC6 — métrica de Blindagem (§10)
  return { ok: true, checks, passRate };
}

export async function getCompliance(): Promise<{
  ok: boolean;
  checks: TemplateCompliance[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compliance_checks")
    .select("template_id, flag_level, status, issues, whatsapp_templates ( name )")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, checks: [], error: error.message };

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  return {
    ok: true,
    checks: rows.map((r) => {
      const wt = r.whatsapp_templates;
      const nameObj = Array.isArray(wt) ? wt[0] : wt;
      const issues = (r.issues as AntibanResult["issues"]) ?? [];
      return {
        templateId: String(r.template_id ?? ""),
        name:
          nameObj && typeof nameObj === "object" && "name" in nameObj
            ? String((nameObj as { name: unknown }).name ?? r.template_id)
            : String(r.template_id ?? ""),
        result: {
          status: (r.status as AntibanResult["status"]) ?? "passed",
          flagLevel: (r.flag_level as AntibanResult["flagLevel"]) ?? "green",
          issues,
        },
      };
    }),
  };
}
