import { Suspense } from "react";
import { fetchInterviewQuestions } from "./queries";
import { ConversationalInterviewer } from "@/components/interview/ConversationalInterviewer";
import { InterviewSkeleton } from "@/components/interview/InterviewSkeleton";

export const metadata = {
  title: "Entrevista 360 | EA360",
  description:
    "Responda à Entrevista 360 passo a passo para mapear objetivos, filosofia, momento e recursos do seu negócio.",
};

// Rota autenticada (AC1): a proteção é feita no middleware (/app/*).
// Dinâmica porque a entrevista cria/lê dados por usuário (AC8).
export const dynamic = "force-dynamic";

async function InterviewContent() {
  const questions = await fetchInterviewQuestions();
  return <ConversationalInterviewer questions={questions} />;
}

export default function InterviewPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Entrevista 360
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Vamos conhecer seu negócio em quatro camadas: objetivos, filosofia, momento e recursos.
          Responda no seu ritmo — uma pergunta por vez.
        </p>
      </header>

      <Suspense fallback={<InterviewSkeleton />}>
        <InterviewContent />
      </Suspense>
    </main>
  );
}
