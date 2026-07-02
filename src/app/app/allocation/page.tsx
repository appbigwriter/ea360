import Link from "next/link";
import { fetchMenu } from "@/app/app/menu/queries";
import { createClient } from "@/lib/supabase/server";
import { getRiskFlags } from "@/app/app/allocation/risk-flags-actions";
import { CeilingConfigurator } from "@/components/allocation/CeilingConfigurator";
import { PillarMinimumConfigurator } from "@/components/allocation/PillarMinimumConfigurator";
import { RiskFlagsPanel } from "@/components/allocation/RiskFlagsPanel";

export const metadata = {
  title: "Teto por canal | EA360",
  description:
    "Defina um teto de investimento por canal (% do orçamento) para que nenhum canal único receba mais do que você considera seguro investir.",
};

// Rota autenticada (/app/*): proteção no middleware. Dinâmica porque lê dados
// por usuário via RLS para alimentar o configurador de teto.
export const dynamic = "force-dynamic";

/**
 * Página de configuração de teto por canal — guardrail (Story 5.4 — AC2).
 *
 * Carrega os canais da recomendação ativa do usuário (Story 4.5) e os entrega ao
 * `CeilingConfigurator`, que aplica os tetos (global e/ou individual) e recalcula
 * a alocação 70/20/10 client-side reutilizando a engine das Stories 5.2/5.4. Ao
 * confirmar, a Server Action `allocateBudget` persiste a carteira respeitando os
 * tetos (AC3) e redistribuindo o excedente entre canais da mesma faixa (AC4).
 */
export default async function AllocationCeilingPage() {
  const menu = await fetchMenu();

  const channels = menu.channels.map((c) => ({
    channelId: c.channelId,
    name: c.name,
    riskScore: c.riskScore,
    matchScore: c.matchScore,
  }));

  // Canais com pilar para o guardrail de mínimo entre pilares (Story 5.5).
  const pillarChannels = menu.channels.map((c) => ({
    channelId: c.channelId,
    name: c.name,
    riskScore: c.riskScore,
    matchScore: c.matchScore,
    pillarSlug: c.pillarSlug,
    pillarName: c.pillarName,
  }));

  // Story 6.4 — faróis da carteira mais recente (pré-carregados para a UI).
  const supabase = await createClient();
  const { data: latestAlloc } = await supabase
    .from("allocations")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  const allocationId = latestAlloc?.id ?? null;
  let initialPortfolio = null as Awaited<ReturnType<typeof getRiskFlags>>["portfolio"];
  let initialChannels = [] as Awaited<ReturnType<typeof getRiskFlags>>["channels"];
  if (allocationId) {
    const flags = await getRiskFlags(allocationId);
    if (flags.ok) {
      initialPortfolio = flags.portfolio;
      initialChannels = flags.channels;
    }
  }
  const channelNames = Object.fromEntries(menu.channels.map((c) => [c.channelId, c.name]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Teto por canal
            </h1>
            <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
              Defina quanto, no máximo, cada canal pode receber do seu orçamento. Use um teto global
              padrão ou ajuste canal a canal. O excedente que ultrapassa o teto é redistribuído
              entre os outros canais da mesma faixa de risco.
            </p>
          </div>
          <Link
            href="/app/allocation/settings"
            className="shrink-0 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Guardrails de risco
          </Link>
        </div>
      </header>

      {menu.recommendationId && channels.length > 0 ? (
        <div className="flex flex-col gap-12">
          <RiskFlagsPanel
            allocationId={allocationId}
            initialPortfolio={initialPortfolio}
            initialChannels={initialChannels}
            channelNames={channelNames}
          />

          <CeilingConfigurator recommendationId={menu.recommendationId} channels={channels} />

          <section>
            <header className="mb-6 border-t border-zinc-200 pt-10 dark:border-zinc-800">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Mínimo entre pilares
              </h2>
              <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
                Garanta diversificação definindo um investimento mínimo em cada pilar (Ads,
                Afiliações e Parcerias). A engine realoca verba para cumprir os mínimos, deduzindo
                de pilares acima do limite.
              </p>
            </header>
            <PillarMinimumConfigurator
              recommendationId={menu.recommendationId}
              channels={pillarChannels}
            />
          </section>
        </div>
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
          : "Você ainda não tem canais para configurar tetos."}
      </p>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {generating
          ? "Aguarde alguns instantes enquanto cruzamos seu perfil com os canais de monetização."
          : "Complete a Entrevista 360 e gere seu menu personalizado para definir tetos por canal."}
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
