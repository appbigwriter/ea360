import Link from "next/link";
import { fetchMenu } from "@/app/app/menu/queries";
import { ScenarioSimulator } from "@/components/allocation/ScenarioSimulator";

export const metadata = {
  title: "Simulador de cenário | EA360",
  description:
    "Experimente diferentes orçamentos e distribuições 70/20/10 e veja a alocação por canal mudar em tempo real antes de confirmar sua carteira.",
};

// Rota autenticada (/app/*): proteção no middleware. Dinâmica porque lê dados
// por usuário via RLS para alimentar o simulador.
export const dynamic = "force-dynamic";

/**
 * Página do simulador de cenário (Story 5.3 — AC1).
 *
 * Carrega os canais da recomendação ativa do usuário (Story 4.5) e os entrega ao
 * `ScenarioSimulator`, que recalcula a alocação 70/20/10 client-side em tempo real
 * (AC2) e permite confirmar chamando a engine de alocação da Story 5.2 (AC5).
 */
export default async function SimulatePage() {
  const menu = await fetchMenu();

  const channels = menu.channels.map((c) => ({
    channelId: c.channelId,
    name: c.name,
    riskScore: c.riskScore,
    matchScore: c.matchScore,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Simulador de cenário
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Ajuste o orçamento total e os percentuais de cada faixa de risco e veja a distribuição por
          canal mudar instantaneamente. Confirme quando estiver satisfeito para gerar a carteira.
        </p>
      </header>

      {menu.recommendationId && channels.length > 0 ? (
        <ScenarioSimulator recommendationId={menu.recommendationId} channels={channels} />
      ) : (
        <EmptyState generating={menu.generating} />
      )}
    </main>
  );
}

/** Estado vazio: sem recomendação ou ainda gerando o menu. */
function EmptyState({ generating }: { generating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">
        {generating
          ? "Seu menu ainda está sendo gerado."
          : "Você ainda não tem canais para simular."}
      </p>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {generating
          ? "Aguarde alguns instantes enquanto cruzamos seu perfil com os canais de monetização."
          : "Complete a Entrevista 360 e gere seu menu personalizado para simular cenários de alocação."}
      </p>
      {!generating ? (
        <Link
          href="/app/menu"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ir para o meu menu
        </Link>
      ) : null}
    </div>
  );
}
