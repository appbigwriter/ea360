"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  startInterview,
  submitAnswer,
  generateFollowUpQuestions,
  completeInterview,
  loadInterviewState,
  listUserDiagnostics,
  resumeInterview,
  type DiagnosticSummary,
} from "@/app/app/interview/actions";
import { generateMonetizationProfile } from "@/app/app/profile/actions";
import { INTERVIEW_LAYERS, type InterviewQuestion } from "@/app/app/interview/types";

/**
 * UI conversacional da Entrevista 360 (Story 3.2).
 *
 * Client Component que apresenta uma pergunta por vez (AC2), aceita resposta
 * por texto livre (AC3), navega com Anterior/Próxima validando resposta
 * obrigatória (AC4), exibe a camada atual (AC5) e o progresso visual das quatro
 * camadas (AC2). É responsivo (AC6) e mostra estado de carregamento enquanto a
 * entrevista é iniciada no servidor (AC7, AC8).
 *
 * NOTA: A geração de perguntas ramificadas por LLM é da Story 3.3. Aqui as
 * perguntas chegam estáticas (do seed) via props.
 */

type Phase = "selecting" | "starting" | "ready" | "completed" | "error";

type ConversationalInterviewerProps = {
  questions: InterviewQuestion[];
};

export function ConversationalInterviewer({ questions }: ConversationalInterviewerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("selecting");
  const [startError, setStartError] = useState<string | null>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();

  const [diagnostics, setDiagnostics] = useState<DiagnosticSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [queue, setQueue] = useState<InterviewQuestion[]>(questions);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  // AC5: indicador de "pensando" enquanto o servidor gera as próximas perguntas.
  const [isThinking, setIsThinking] = useState(false);
  // Story 3.5: indicador enquanto o Perfil de Monetização é gerado/persistido.
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);

  const startedRef = useRef(false);
  const answerFieldId = useId();

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function loadList() {
      const result = await listUserDiagnostics();
      if (result.ok) {
        setDiagnostics(result.diagnostics);
      }
      setLoadingList(false);
    }
    loadList();
  }, []);

  async function resumeOrStart(id: string) {
    setInterviewId(id);
    const loaded = await loadInterviewState(id);
    if (loaded.ok) {
      if (loaded.state.completed) {
        setPhase("completed");
        void generateMonetizationProfile(id).finally(() => {
          router.push("/app/profile");
        });
        return;
      }
      const saved = loaded.state.answers;
      if (Object.keys(saved).length > 0) {
        setAnswers(saved);
        const firstUnanswered = questions.findIndex(
          (q) => !saved[q.id] || saved[q.id].trim().length === 0
        );
        setIndex(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
      }
    }
    setPhase("ready");
  }

  async function handleStartNew(businessName: string) {
    setStartError(null);
    setPhase("starting");
    startTransition(async () => {
      const result = await startInterview({ businessName });
      if (!result.ok) {
        setStartError(result.error);
        setPhase("error");
        return;
      }
      await resumeOrStart(result.interviewId);
    });
  }

  async function handleResume(id: string) {
    setStartError(null);
    setPhase("starting");
    startTransition(async () => {
      const result = await resumeInterview(id);
      if (!result.ok) {
        setStartError(result.error);
        setPhase("error");
        return;
      }
      await resumeOrStart(result.interviewId);
    });
  }

  if (phase === "error") {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <p className="font-medium">Não foi possível iniciar a entrevista.</p>
        <p className="mt-1">{startError}</p>
      </div>
    );
  }

  if (phase === "completed") {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="interview-completed"
        className="rounded-md border border-emerald-300 bg-emerald-50 p-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
      >
        <p className="text-lg font-semibold">Entrevista concluída 🎉</p>
        <p className="mt-2 text-sm">
          {isGeneratingProfile
            ? "Gerando seu Perfil de Monetização e levando você para a visualização..."
            : "Suas respostas foram salvas. Já mapeamos as quatro camadas do seu negócio."}
        </p>
      </div>
    );
  }

  if (phase === "selecting") {
    return (
      <SelectionScreen
        diagnostics={diagnostics}
        isLoading={loadingList}
        onStartNew={handleStartNew}
        onResume={handleResume}
      />
    );
  }

  if (phase === "starting" || isStarting || !interviewId) {
    return <StartingState />;
  }

  if (queue.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">Nenhuma pergunta disponível no momento.</p>
    );
  }

  const total = queue.length;
  const current = queue[index];
  const currentAnswer = answers[current.id] ?? "";
  const isFirst = index === 0;
  const isLast = index === total - 1;

  /** Texto da camada (objetivos/...) a partir do número, para contexto do LLM. */
  function layerKey(layerNumber: number): string | null {
    return INTERVIEW_LAYERS.find((l) => l.number === layerNumber)?.key ?? null;
  }

  function handleChange(value: string) {
    setAnswers((prev) => ({ ...prev, [current.id]: value }));
    if (validationError) setValidationError(null);
  }

  function goPrevious() {
    setValidationError(null);
    setIndex((i) => Math.max(0, i - 1));
  }

  async function goNext() {
    // AC4: resposta obrigatória antes de avançar.
    const answer = currentAnswer.trim();
    if (answer.length === 0) {
      setValidationError("Por favor, responda antes de avançar.");
      return;
    }
    setValidationError(null);

    if (!interviewId) return;

    let insertedCount = 0;
    // AC3: camada da próxima pergunta — usada para avançar current_layer
    // atomicamente junto com o salvamento da resposta (Story 3.4).
    const nextStatic = queue[index + 1];
    const nextLayer = nextStatic ? nextStatic.layer : current.layer;

    // AC5: indicador "pensando" enquanto persiste a resposta e o servidor gera
    // as próximas perguntas. Story 3.4 AC1/AC6: a resposta é persistida (de
    // forma atômica com o avanço de camada) ANTES de avançar.
    setIsThinking(true);
    try {
      const submitted = await submitAnswer({
        interviewId,
        questionId: current.id,
        answerText: answer,
        layer: layerKey(current.layer),
        nextLayer,
      });

      // AC1/AC6: se o salvamento falhar, não avança — evita perda de progresso.
      if (!submitted.ok) {
        setValidationError(submitted.error);
        setIsThinking(false);
        return;
      }

      if (submitted.ok) {
        // AC1/AC2/AC3: gera follow-ups com o contexto acumulado.
        const history = queue.slice(0, index).map((q) => ({
          question: q.questionText,
          answer: answers[q.id] ?? "",
          layer: layerKey(q.layer),
        }));

        const generated = await generateFollowUpQuestions({
          interviewId,
          parentQuestionId: current.id,
          currentLayer: layerKey(current.layer),
          latestQuestion: current.questionText,
          latestAnswer: answer,
          history,
        });

        // AC7: perguntas geradas (já persistidas) entram na fila logo após a
        // pergunta-mãe, sendo apresentadas na UI.
        if (generated.ok && generated.questions.length > 0) {
          const newOnes: InterviewQuestion[] = generated.questions.map((g) => ({
            id: g.id,
            slug: `gen-${g.id}`,
            layer: g.layer,
            layerLabel: g.layerLabel,
            questionText: g.questionText,
            questionType: "text",
            order: current.order,
          }));
          insertedCount = newOnes.length;
          setQueue((prev) => {
            const next = [...prev];
            next.splice(index + 1, 0, ...newOnes);
            return next;
          });
        }
      }
    } finally {
      setIsThinking(false);
    }

    // Avança apenas se houver próxima pergunta (estática ou recém-gerada).
    const hasNext = index + 1 < total + insertedCount;
    if (hasNext) {
      setIndex((i) => i + 1);
      return;
    }

    // AC4: não há próxima pergunta → concluiu todas as camadas. Marca a
    // entrevista como concluída (status + completed_at) e exibe o estado final.
    const finished = await completeInterview(interviewId);
    if (!finished.ok) {
      setValidationError(finished.error);
      return;
    }

    setPhase("completed");

    // Story 3.5, AC1: gera e persiste o Perfil de Monetização. AC5: redireciona
    // para /app/profile com a visualização resumida. O perfil é gerado no
    // servidor (LLM ou fallback) — qualquer erro não trava o redirect.
    setIsGeneratingProfile(true);
    try {
      await generateMonetizationProfile(interviewId);
    } finally {
      setIsGeneratingProfile(false);
      router.push("/app/profile");
    }
  }

  return (
    <div className="space-y-8" data-testid="interview-conversation">
      <LayerProgress currentLayer={current.layer} layerLabel={current.layerLabel} />

      <div>
        <p
          className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400"
          data-testid="question-counter"
        >
          Pergunta {index + 1} de {total}
        </p>
        <h2
          id={`${answerFieldId}-label`}
          className="mt-2 text-xl leading-snug font-semibold text-zinc-900 sm:text-2xl dark:text-zinc-50"
        >
          {current.questionText}
        </h2>
      </div>

      {/* AC3: resposta por texto livre */}
      <div>
        <label htmlFor={answerFieldId} className="sr-only">
          Sua resposta
        </label>
        <textarea
          id={answerFieldId}
          aria-labelledby={`${answerFieldId}-label`}
          aria-invalid={validationError ? true : undefined}
          value={currentAnswer}
          onChange={(e) => handleChange(e.target.value)}
          rows={5}
          placeholder="Digite sua resposta..."
          className="focus-visible:ring-ring w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {validationError && (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {validationError}
          </p>
        )}
      </div>

      {/* AC5: indicador visual de "pensando" (gerando próximas perguntas). */}
      {isThinking && (
        <div
          className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400"
          role="status"
          aria-live="polite"
          data-testid="interview-thinking"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
          />
          <span>Gerando próximas perguntas...</span>
        </div>
      )}

      {/* AC4: navegação Anterior / Próxima */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goPrevious}
          disabled={isFirst || isThinking}
        >
          Anterior
        </Button>
        <Button type="button" onClick={goNext} disabled={isThinking}>
          {isThinking ? "Processando..." : isLast ? "Concluído" : "Próxima"}
        </Button>
      </div>
    </div>
  );
}

/** Estado de carregamento enquanto a entrevista é iniciada (AC7). */
function StartingState() {
  return (
    <div
      className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400"
      role="status"
      aria-live="polite"
      data-testid="interview-starting"
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
      />
      <span>Preparando sua entrevista...</span>
    </div>
  );
}

/**
 * Indicador da camada atual + progresso visual das quatro camadas (AC2, AC5).
 */
function LayerProgress({ currentLayer, layerLabel }: { currentLayer: number; layerLabel: string }) {
  return (
    <div className="space-y-3">
      <p
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        data-testid="layer-indicator"
      >
        Camada {currentLayer} de {INTERVIEW_LAYERS.length}: {layerLabel}
      </p>
      <div
        className="grid grid-cols-4 gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={INTERVIEW_LAYERS.length}
        aria-valuenow={currentLayer}
        aria-label={`Camada ${currentLayer} de ${INTERVIEW_LAYERS.length}`}
      >
        {INTERVIEW_LAYERS.map((layer) => (
          <div
            key={layer.key}
            className={
              "h-2 rounded-full transition-colors " +
              (layer.number <= currentLayer ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-800")
            }
            title={`Camada ${layer.number}: ${layer.label}`}
          />
        ))}
      </div>
    </div>
  );
}

function SelectionScreen({
  diagnostics,
  isLoading,
  onStartNew,
  onResume,
}: {
  diagnostics: DiagnosticSummary[];
  isLoading: boolean;
  onStartNew: (name: string) => void;
  onResume: (id: string) => void;
}) {
  const [businessName, setBusinessName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (businessName.trim().length > 0) {
      onStartNew(businessName);
    }
  }

  return (
    <div className="space-y-8" data-testid="interview-selection">
      <div className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Iniciar Novo Diagnóstico
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Informe o nome da sua empresa ou projeto para começar.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ex: Minha Empresa"
            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 dark:border-zinc-700 dark:text-zinc-50"
          />
          <Button type="submit" disabled={businessName.trim().length === 0}>
            Iniciar →
          </Button>
        </form>
      </div>

      <div>
        <h3 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Diagnósticos Anteriores
        </h3>
        {isLoading ? (
          <div className="flex animate-pulse flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-md bg-zinc-100 dark:bg-zinc-800/50" />
            ))}
          </div>
        ) : diagnostics.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum diagnóstico encontrado. Inicie um novo acima.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {diagnostics.map((diag) => {
              const isCompleted = diag.status === "concluida";
              return (
                <div
                  key={diag.interviewId}
                  className="flex flex-col justify-between rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-zinc-900 dark:text-zinc-50 line-clamp-1">
                        {diag.businessName}
                      </h4>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(diag.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : diag.status === "em_andamento"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {isCompleted
                        ? "Concluído"
                        : diag.status === "em_andamento"
                        ? "Em andamento"
                        : "Rascunho"}
                    </span>
                  </div>
                  <Button
                    variant={isCompleted ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={() => onResume(diag.interviewId)}
                  >
                    {isCompleted ? "Ver resultado" : "Continuar (Camada " + diag.currentLayer + ")"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
