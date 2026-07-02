import { createClient } from "@/lib/supabase/server";

export async function trackEvent(name: string, props: Record<string, unknown>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user && !props.userId) return;

    const userId = props.userId || user?.id;
    let businessId = props.businessId;

    if (!businessId && userId) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle();
      businessId = biz?.id;
    }

    await supabase.from("analytics_events").insert({
      user_id: userId,
      business_id: businessId || null,
      event_name: name,
      properties: props,
      session_id: props.sessionId || "server-action",
    });
  } catch (err) {
    console.error("Failed to track analytics event:", err);
  }
}

export async function trackInterviewCompleted(
  businessId: string,
  userId: string,
  sessionId: string
) {
  return trackEvent("interview_completed", { businessId, userId, sessionId });
}

export async function trackMenuGenerated(
  businessId: string,
  userId: string,
  sessionId: string,
  channelCount: number
) {
  return trackEvent("menu_generated", { businessId, userId, sessionId, channelCount });
}

export async function trackAllocationSaved(
  businessId: string,
  userId: string,
  allocationId: string,
  totalBudget: number
) {
  return trackEvent("allocation_saved", { businessId, userId, allocationId, totalBudget });
}

export async function trackOracleQueried(businessId: string, userId: string, queryLength: number) {
  return trackEvent("oracle_queried", { businessId, userId, queryLength });
}
