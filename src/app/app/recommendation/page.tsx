import { Lightbulb } from "lucide-react";

export const metadata = {
  title: "Recomendações | EA360",
};

export default function RecommendationPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-inner mb-6">
        <Lightbulb className="h-10 w-10" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
        Módulo de Recomendações
      </h1>
      <p className="max-w-lg text-lg text-zinc-600 dark:text-zinc-400">
        Esta tela receberá a inteligência artificial para otimização do seu funil e sugestões avançadas. (Ainda em desenvolvimento)
      </p>
    </div>
  );
}
