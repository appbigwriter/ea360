import type { GomChannel } from "@/app/gom/queries";
import { ChannelCard } from "./ChannelCard";

/**
 * Lista de canais agrupada por pilar (AC1). Recebe canais já filtrados/ordenados
 * pelo GomBrowser e os agrupa preservando a ordem de inserção.
 */
export function ChannelList({
  channels,
  highlightedId = null,
}: {
  channels: GomChannel[];
  highlightedId?: string | null;
}) {
  if (channels.length === 0) {
    return (
      <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        Nenhum canal encontrado para os filtros atuais.
      </p>
    );
  }

  // Agrupa por pilar preservando a ordem em que aparecem.
  const groups: { pillarId: string; pillarName: string; items: GomChannel[] }[] = [];
  const indexByPillar = new Map<string, number>();

  for (const channel of channels) {
    let idx = indexByPillar.get(channel.pillar_id);
    if (idx === undefined) {
      idx = groups.length;
      indexByPillar.set(channel.pillar_id, idx);
      groups.push({
        pillarId: channel.pillar_id,
        pillarName: channel.pillar_name,
        items: [],
      });
    }
    groups[idx].items.push(channel);
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.pillarId} aria-labelledby={`pillar-${group.pillarId}`}>
          <h2
            id={`pillar-${group.pillarId}`}
            className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {group.pillarName}{" "}
            <span className="text-sm font-normal text-zinc-500">({group.items.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                highlighted={channel.id === highlightedId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
