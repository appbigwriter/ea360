import { createClient } from "@/lib/supabase/server";
import { layerLabel, layerNumber, type InterviewQuestion } from "./types";

export { INTERVIEW_LAYERS, type InterviewLayer, type InterviewQuestion } from "./types";

type QuestionRow = {
  id: string;
  slug: string;
  layer: string | null;
  prompt: string;
  input_type: string | null;
  sort: number | null;
};

/**
 * Carrega as perguntas iniciais (não-ramificadas) da Entrevista 360, ordenadas
 * por camada e ordem (AC2). As perguntas são públicas (policy "perguntas
 * públicas" = true), então não dependem do usuário. As perguntas ramificadas
 * (LLM-driven) ficam para a Story 3.3 — aqui só as estáticas do seed.
 */
export async function fetchInterviewQuestions(): Promise<InterviewQuestion[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("interview_questions")
    .select("id, slug, layer, prompt, input_type, sort")
    .is("parent_question_id", null)
    .order("sort", { ascending: true });

  if (error) {
    throw new Error(`[interview] Falha ao carregar perguntas: ${error.message}`);
  }

  const rows = (data ?? []) as QuestionRow[];

  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      layer: layerNumber(row.layer),
      layerLabel: layerLabel(row.layer),
      questionText: row.prompt,
      questionType: row.input_type ?? "text",
      order: row.sort ?? 0,
    }))
    .sort((a, b) => a.layer - b.layer || a.order - b.order);
}

/**
 * Estado salvo de uma entrevista em andamento (Story 3.4, AC2/AC5).
 *
 * Carrega as respostas já persistidas (por `question_id`) e a camada/estado
 * atual, permitindo que a UI retome da última pergunta não respondida e exiba
 * o progresso refletindo o que está salvo no banco.
 */
export type SavedInterviewState = {
  /** Respostas já salvas, indexadas por `question_id`. */
  answers: Record<string, string>;
  /** Camada atual salva em `interviews.current_layer` (1..4). */
  currentLayer: number;
  /** `true` se a entrevista já foi concluída. */
  completed: boolean;
};

/**
 * Carrega o estado salvo de uma entrevista (RLS isola por dono). Retorna
 * respostas por pergunta + camada/estado atual para retomada (AC2) e progresso
 * (AC5). Tolerante: na ausência de dados, devolve um estado vazio na camada 1.
 */
export async function fetchSavedInterviewState(interviewId: string): Promise<SavedInterviewState> {
  const supabase = await createClient();

  const [{ data: interview }, { data: answerRows }] = await Promise.all([
    supabase.from("interviews").select("current_layer, status").eq("id", interviewId).maybeSingle(),
    supabase
      .from("interview_answers")
      .select("question_id, answer_text, created_at")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true }),
  ]);

  const answers: Record<string, string> = {};
  for (const row of (answerRows ?? []) as Array<{
    question_id: string | null;
    answer_text: string | null;
  }>) {
    if (row.question_id && row.answer_text != null) {
      answers[row.question_id] = row.answer_text;
    }
  }

  const status = (interview?.status as string | undefined) ?? "em_andamento";

  return {
    answers,
    currentLayer: (interview?.current_layer as number | undefined) ?? 1,
    completed: status === "concluida",
  };
}
