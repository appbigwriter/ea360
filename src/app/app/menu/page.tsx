import Link from "next/link";
import { fetchMenu } from "./queries";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { GenerateAllocationButton } from "@/components/allocation/GenerateAllocationButton";

export const metadata = {
  title: "Meu Menu | EA360",
  description:
    "Seu menu personalizado de canais de monetização: opções rankeadas com gasto estimado, retorno, payback e nota de risco.",
};

// Rota autenticada (AC1): a proteção é feita no middleware (/app/*).
// Dinâmica porque o menu lê dados por usuário via RLS.
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const menu = await fetchMenu();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Meu Menu
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Suas opções de monetização rankeadas para o momento do seu negócio, com gasto estimado,
          faixa de retorno, payback e nota de risco.
        </p>
      </header>

      {menu.generating ? (
        <GeneratingState />
      ) : menu.channels.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-8">
          {menu.recommendationId ? (
            <GenerateAllocationButton recommendationId={menu.recommendationId} />
          ) : null}
          <MenuBrowser channels={menu.channels} />
        </div>
      )}
    </main>
  );
}

/** Estado "gerando menu..." enquanto o matchmaking processa (AC5). */
function GeneratingState() {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700"
      aria-live="polite"
    >
      <span
        className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"
        aria-hidden="true"
      />
      <p className="font-medium text-zinc-900 dark:text-zinc-50">Gerando seu menu...</p>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Estamos cruzando seu perfil com os canais de monetização. Isso leva alguns instantes.
      </p>
    </div>
  );
}

/** CTA para completar a Entrevista 360 quando não há recomendação (AC6). */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-50">
        Você ainda não tem um menu personalizado.
      </p>
      <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Complete a Entrevista 360 para que possamos mapear seu negócio e recomendar os canais mais
        adequados ao seu momento.
      </p>
      <Link
        href="/app/interview"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Fazer a Entrevista 360
      </Link>
    </div>
  );
}
