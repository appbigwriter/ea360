import Link from "next/link";
import {
  fetchLatestMonetizationProfile,
  fetchAllChannelOptions,
  type ChannelOption,
} from "./queries";
import type { MonetizationProfile } from "@/lib/monetization/profile";
import { ExcludedChannelsSection } from "@/components/profile/ExcludedChannelsSection";

export const metadata = {
  title: "Perfil de Monetização | EA360",
  description:
    "Resumo do seu Perfil de Monetização gerado a partir da Entrevista 360: objetivos, filosofia, momento e recursos.",
};

// Rota autenticada (/app/*) e dinâmica: lê dados por usuário sob RLS.
export const dynamic = "force-dynamic";

/** Story 3.5, AC5: visualização resumida do Perfil de Monetização. */
export default async function ProfilePage() {
  const view = await fetchLatestMonetizationProfile();
  // AC5: opções de canal para adicionar exclusões manualmente (só quando há perfil).
  const channelOptions: ChannelOption[] = view === null ? [] : await fetchAllChannelOptions();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Perfil de Monetização
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Este é o resumo do seu negócio que vamos usar para recomendar os canais de monetização
          mais adequados.
        </p>
      </header>

      {view === null ? (
        <EmptyState />
      ) : (
        <ProfileSummary view={profileView(view)} channelOptions={channelOptions} />
      )}
    </main>
  );
}

type ViewModel = {
  profile: MonetizationProfile;
  isLlmGenerated: boolean;
};

function profileView(v: { profile: MonetizationProfile; isLlmGenerated: boolean }): ViewModel {
  return { profile: v.profile, isLlmGenerated: v.isLlmGenerated };
}

function EmptyState() {
  return (
    <div
      role="status"
      className="rounded-md border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <p className="font-medium">Você ainda não tem um perfil.</p>
      <p className="mt-1">
        Conclua a{" "}
        <Link
          href="/app/interview"
          className="text-primary font-medium underline underline-offset-2"
        >
          Entrevista 360
        </Link>{" "}
        para gerarmos seu Perfil de Monetização.
      </p>
    </div>
  );
}

function ProfileSummary({
  view,
  channelOptions,
}: {
  view: ViewModel;
  channelOptions: ChannelOption[];
}) {
  const { profile, isLlmGenerated } = view;

  return (
    <div className="space-y-8" data-testid="profile-summary">
      {!isLlmGenerated && (
        <p
          role="note"
          data-testid="profile-fallback-note"
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Geramos uma versão preliminar com base nas suas respostas. Podemos refiná-la depois.
        </p>
      )}

      <ProfileList
        title="Objetivos & Metas"
        testId="profile-objectives"
        items={profile.objectives}
      />
      <ProfileList
        title="Filosofia & Valores"
        testId="profile-philosophy"
        items={profile.philosophy}
      />
      <ProfileText
        title="Momento do Negócio"
        testId="profile-current-stage"
        text={profile.current_stage}
      />
      <ProfileList title="Recursos" testId="profile-resources" items={profile.resources} />
      {/* Story 3.6, AC4/AC5: canais excluídos com motivo, editáveis. */}
      <ExcludedChannelsSection
        excluded={profile.excluded_channel_details}
        allChannels={channelOptions}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
      {children}
    </h2>
  );
}

function ProfileList({ title, items, testId }: { title: string; items: string[]; testId: string }) {
  return (
    <section data-testid={testId}>
      <SectionTitle>{title}</SectionTitle>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-800 dark:text-zinc-200">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Sem informações registradas.
        </p>
      )}
    </section>
  );
}

function ProfileText({ title, text, testId }: { title: string; text: string; testId: string }) {
  return (
    <section data-testid={testId}>
      <SectionTitle>{title}</SectionTitle>
      {text.trim().length > 0 ? (
        <p className="mt-2 whitespace-pre-line text-zinc-800 dark:text-zinc-200">{text}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Sem informações registradas.
        </p>
      )}
    </section>
  );
}
