"use client";

import { useEffect } from "react";
import { Command } from "cmdk";
import type { GomChannel } from "@/app/gom/queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: GomChannel[];
  /** Chamado ao selecionar um canal — foca/filtra a lista principal. */
  onSelectChannel: (channel: GomChannel) => void;
};

/**
 * Command palette (cmdk) para busca rápida de canal (AC5).
 * Aberto via Ctrl+K / Cmd+K (atalho global registrado aqui) ou externamente.
 */
export function GomCommandPalette({ open, onOpenChange, channels, onSelectChannel }: Props) {
  // Atalho global de teclado: Ctrl+K (Win/Linux) / Cmd+K (macOS).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <Command
        label="Busca rápida de canal"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Buscar canal..."
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400 dark:border-zinc-800 dark:text-zinc-50"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-sm text-zinc-500">
            Nenhum canal encontrado.
          </Command.Empty>
          {channels.map((channel) => (
            <Command.Item
              key={channel.id}
              value={`${channel.name} ${channel.pillar_name} ${channel.category_name}`}
              onSelect={() => {
                onSelectChannel(channel);
                onOpenChange(false);
              }}
              className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-700 data-[selected=true]:bg-zinc-100 dark:text-zinc-200 dark:data-[selected=true]:bg-zinc-800"
            >
              <span>{channel.name}</span>
              <span className="text-xs text-zinc-400">{channel.pillar_name}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
