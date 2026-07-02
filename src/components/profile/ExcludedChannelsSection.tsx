"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addExcludedChannel, removeExcludedChannel } from "@/app/app/profile/exclusions";
import type { ExcludedChannelDetail } from "@/lib/monetization/profile";
import type { ChannelOption } from "@/app/app/profile/queries";

/**
 * Seção "Canais excluídos" do perfil (Story 3.6, AC4/AC5).
 *
 * Exibe cada canal excluído com seu motivo (AC4) e permite ao usuário remover
 * exclusões ou adicionar novas manualmente (AC5). As mutações usam Server
 * Actions (`addExcludedChannel`/`removeExcludedChannel`) que persistem em
 * `monetization_profiles.profile_data` e revalidam a página.
 */

type Props = {
  excluded: ExcludedChannelDetail[];
  /** Todos os canais do GOM, para o seletor de adição (AC5). */
  allChannels: ChannelOption[];
};

export function ExcludedChannelsSection({ excluded, allChannels }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");

  const excludedIds = useMemo(() => new Set(excluded.map((e) => e.channel_id)), [excluded]);

  // AC5: só oferece canais ainda não excluídos.
  const availableChannels = useMemo(
    () => allChannels.filter((c) => !excludedIds.has(c.id)),
    [allChannels, excludedIds]
  );

  function handleRemove(channelId: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeExcludedChannel(channelId);
      if (!res.ok) setError(res.error);
    });
  }

  function handleAdd() {
    if (!selectedId) return;
    setError(null);
    const id = selectedId;
    setSelectedId("");
    startTransition(async () => {
      const res = await addExcludedChannel(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <section data-testid="profile-excluded-channels">
      <h2 className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        Canais Excluídos
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Canais marcados como incompatíveis com seus valores. Eles não aparecem nas recomendações do
        menu personalizado.
      </p>

      {excluded.length > 0 ? (
        <ul className="mt-3 space-y-2" data-testid="excluded-channel-list">
          {excluded.map((item) => (
            <li
              key={item.channel_id}
              data-testid="excluded-channel-item"
              className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {item.channel_name || "Canal"}
                  {item.source === "user_manual" && (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-400">
                      manual
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{item.reason}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRemove(item.channel_id)}
                aria-label={`Remover ${item.channel_name} da lista de exclusão`}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Nenhum canal excluído. Todos os canais estão elegíveis nas suas recomendações.
        </p>
      )}

      {/* AC5: adicionar canal manualmente à lista de exclusão. */}
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label
            htmlFor="add-excluded-channel"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Excluir outro canal
          </label>
          <select
            id="add-excluded-channel"
            data-testid="add-excluded-select"
            value={selectedId}
            disabled={isPending || availableChannels.length === 0}
            onChange={(e) => setSelectedId(e.target.value)}
            className="focus-visible:ring-ring mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus-visible:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Selecione um canal...</option>
            {availableChannels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={handleAdd} disabled={isPending || !selectedId}>
          Adicionar
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
