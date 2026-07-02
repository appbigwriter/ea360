"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSavedInterviewState, type SavedInterviewState } from "./queries";
import { getAnthropicApiKey } from "@/lib/env.server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseFollowUps,
  MAX_FOLLOW_UPS,
  type QAContextItem,
} from "@/lib/interview/prompt";

/**
 * Server Action de início da Entrevista 360 (Story 3.2, AC8).
 *
 * Cria (ou reaproveita) um registro em `interviews` com status `em_andamento`
 * — o valor do enum `interview_status` que corresponde ao "in_progress" do AC8
 * (Story 3.1 manteve os valores PT: rascunho/em_andamento/concluida).
 *
 * Toda a lógica roda no servidor; nenhum segredo é exposto ao client.
 */

export type StartInterviewResult = { ok: true; interviewId: string } | { ok: false; error: string };

/**
 * Garante que o usuário autenticado tenha um `business`, retornando seu id.
 * `interviews` exige `business_id` (FK), e o RLS isola por dono via
 * `owns_business()`. Para o MVP da entrevista, criamos um negócio mínimo se o
 * usuário ainda não tiver nenhum.
 */
async function getOrCreateBusinessId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(`[interview] Falha ao buscar negócio: ${selectError.message}`);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("businesses")
    .insert({ owner_id: userId, name: "Meu negócio" })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    throw new Error(
      `[interview] Falha ao criar negócio: ${insertError?.message ?? "desconhecido"}`
    );
  }

  return created.id;
}

/**
 * Inicia uma nova entrevista (AC8): cria registro em `interviews` com
 * `status = 'em_andamento'`, `current_layer = 1` e `started_at = now()`.
 * Reaproveita uma entrevista já em andamento do mesmo negócio, se existir,
 * para não acumular registros órfãos a cada montagem da UI.
 */
export async function startInterview(): Promise<StartInterviewResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  try {
    const businessId = await getOrCreateBusinessId(supabase, user.id);

    const { data: ongoing, error: ongoingError } = await supabase
      .from("interviews")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "em_andamento")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ongoingError) {
      return { ok: false, error: ongoingError.message };
    }

    if (ongoing?.id) {
      return { ok: true, interviewId: ongoing.id };
    }

    const { data: created, error: insertError } = await supabase
      .from("interviews")
      .insert({
        business_id: businessId,
        status: "em_andamento",
        current_layer: 1,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !created?.id) {
      return {
        ok: false,
        error: insertError?.message ?? "Não foi possível iniciar a entrevista.",
      };
    }

    return { ok: true, interviewId: created.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro inesperado ao iniciar.",
    };
  }
}

/**
 * Carrega o estado salvo da entrevista para retomada (Story 3.4, AC2/AC5).
 * Server Action fina sobre `fetchSavedInterviewState` (RLS isola por dono).
 */
export async function loadInterviewState(
  interviewId: string
): Promise<{ ok: true; state: SavedInterviewState } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  try {
    const state = await fetchSavedInterviewState(interviewId);
    return { ok: true, state };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro ao carregar estado.",
    };
  }
}

// ---------------------------------------------------------------------------
// Story 3.3 — Perguntas ramificadas via LLM (Anthropic SDK)
// ---------------------------------------------------------------------------

/** Modelo usado para gerar follow-ups — Haiku (custo menor, Dev Note). */
const FOLLOW_UP_MODEL = "claude-3-5-haiku-latest";

export type GeneratedQuestion = {
  id: string;
  questionText: string;
  layer: number;
  layerLabel: string;
};

export type SubmitAnswerResult = { ok: true; answerId: string } | { ok: false; error: string };

export type CompleteInterviewResult =
  | { ok: true; completedAt: string | null }
  | { ok: false; error: string };

export type GenerateFollowUpsResult =
  | { ok: true; questions: GeneratedQuestion[] }
  | { ok: false; error: string };

/** Mapeia o texto da camada (objetivos/...) para número 1..4. */
const LAYER_TO_NUMBER: Record<string, { number: number; label: string }> = {
  objetivos: { number: 1, label: "Objetivos & Metas" },
  filosofia: { number: 2, label: "Filosofia & Valores" },
  momento: { number: 3, label: "Momento" },
  recursos: { number: 4, label: "Recursos" },
};

/** Garante que a entrevista pertence ao usuário autenticado (defesa em profundidade). */
async function assertInterviewOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interviewId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("interviews")
    .select("id")
    .eq("id", interviewId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

/**
 * Persiste a resposta do usuário em `interview_answers` e — atomicamente —
 * avança `interviews.current_layer` quando o usuário muda de camada (Story 3.4,
 * AC1/AC3/AC6). Usa a função SQL `save_interview_answer` (plpgsql): o INSERT da
 * resposta e o UPDATE do estado correm numa única transação, então ou ambos
 * ocorrem ou nenhum — sem insert órfão (AC6). A função roda como SECURITY
 * INVOKER, preservando a RLS "do dono" (Story 3.1).
 *
 * Retorna o id da resposta criada (pergunta-mãe das ramificadas — Story 3.3).
 */
export async function submitAnswer(input: {
  interviewId: string;
  questionId: string;
  answerText: string;
  layer?: string | null;
  /** Número da camada (1..4) para a qual o usuário está avançando (AC3). */
  nextLayer?: number | null;
}): Promise<SubmitAnswerResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const answerText = input.answerText.trim();
  if (answerText.length === 0) {
    return { ok: false, error: "Resposta vazia." };
  }

  // AC6: salvamento atômico via RPC (INSERT resposta + UPDATE current_layer).
  const { data, error } = await supabase.rpc("save_interview_answer", {
    p_interview_id: input.interviewId,
    p_question_id: input.questionId,
    p_answer_text: answerText,
    p_layer: input.layer ?? null,
    p_next_layer: input.nextLayer ?? null,
  });

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Não foi possível salvar a resposta.",
    };
  }

  return { ok: true, answerId: data as string };
}

/**
 * Conclui a entrevista (Story 3.4, AC4): marca `status = 'concluida'`
 * (= "completed") e preenche `completed_at` de forma idempotente, via RPC
 * `complete_interview` (SECURITY INVOKER → RLS do dono preservada).
 */
export async function completeInterview(interviewId: string): Promise<CompleteInterviewResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { data, error } = await supabase.rpc("complete_interview", {
    p_interview_id: interviewId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, completedAt: (data as string | null) ?? null };
}

/**
 * Gera de 0 a 3 perguntas de aprofundamento via Anthropic (AC1) com base no
 * contexto acumulado da entrevista (AC3) e as persiste em `interview_questions`
 * com `parent_question_id` apontando para a pergunta-mãe (AC2).
 *
 * Tolerante a falhas (AC4): qualquer erro do LLM/persistência retorna lista
 * vazia (ok:true, questions:[]) e é logado, sem bloquear o usuário — a UI
 * avança com as perguntas estáticas seguintes.
 */
export async function generateFollowUpQuestions(input: {
  interviewId: string;
  parentQuestionId: string;
  currentLayer?: string | null;
  latestQuestion: string;
  latestAnswer: string;
  history?: QAContextItem[];
}): Promise<GenerateFollowUpsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  try {
    const owned = await assertInterviewOwnership(supabase, input.interviewId);
    if (!owned) {
      // Não bloqueia o fluxo: sem dono válido, não há o que ramificar.
      return { ok: true, questions: [] };
    }

    // 1. Chamada ao LLM (AC1, AC3). Import dinâmico mantém o SDK fora de
    //    qualquer caminho de bundle do cliente.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: getAnthropicApiKey() });

    const message = await client.messages.create({
      model: FOLLOW_UP_MODEL,
      max_tokens: 512,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            currentLayer: input.currentLayer ?? null,
            history: input.history ?? [],
            latestQuestion: input.latestQuestion,
            latestAnswer: input.latestAnswer,
          }),
        },
      ],
    });

    const text = message.content
      .filter(
        (block): block is { type: "text"; text: string } & typeof block => block.type === "text"
      )
      .map((block) => block.text)
      .join("\n");

    const followUps = parseFollowUps(text);
    if (followUps.length === 0) {
      return { ok: true, questions: [] };
    }

    // 2. Persistência (AC2). interview_questions só tem policy de SELECT
    //    pública; a escrita é feita pelo servidor após validar a posse acima.
    const layerKey = input.currentLayer ?? null;
    const layerInfo = (layerKey && LAYER_TO_NUMBER[layerKey]) || { number: 1, label: "Geral" };

    const admin = createAdminClient();
    const baseSort = Date.now() % 1_000_000;
    const rows = followUps.slice(0, MAX_FOLLOW_UPS).map((f, i) => ({
      slug: `followup-${input.parentQuestionId}-${i}`,
      layer: layerKey ?? "objetivos",
      prompt: f.question,
      input_type: "text",
      sort: baseSort + i,
      interview_id: input.interviewId,
      parent_question_id: input.parentQuestionId,
    }));

    const { data: inserted, error: insertError } = await admin
      .from("interview_questions")
      .insert(rows)
      .select("id, prompt");

    if (insertError || !inserted) {
      console.error("[interview] Falha ao salvar perguntas geradas:", insertError);
      return { ok: true, questions: [] };
    }

    const questions: GeneratedQuestion[] = inserted.map((row) => ({
      id: row.id as string,
      questionText: row.prompt as string,
      layer: layerInfo.number,
      layerLabel: layerInfo.label,
    }));

    return { ok: true, questions };
  } catch (err) {
    // AC4: qualquer falha do LLM não bloqueia — loga e avança sem follow-ups.
    console.error("[interview] generateFollowUpQuestions falhou:", err);
    return { ok: true, questions: [] };
  }
}
