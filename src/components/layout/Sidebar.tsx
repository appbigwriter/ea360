"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  Menu,
  PieChart,
  Lightbulb,
  PlaySquare,
  Settings,
  User,
} from "lucide-react";

const navigation = [
  { name: "Painel 360", href: "/app/panel", icon: LayoutDashboard },
  { name: "Diagnóstico", href: "/app/interview", icon: ClipboardList },
  { name: "Menu de Canais", href: "/app/menu", icon: Menu },
  { name: "Alocação", href: "/app/allocation", icon: PieChart },
  { name: "Recomendações", href: "/app/recommendation", icon: Lightbulb },
  { name: "Executor CTWA", href: "/app/executor/funnel", icon: PlaySquare },
  { name: "Configurações", href: "/app/settings/integrations", icon: Settings },
  { name: "Perfil", href: "/app/profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative flex h-full w-64 flex-col overflow-y-auto border-r border-zinc-200/50 bg-white/70 backdrop-blur-xl dark:border-zinc-800/50 dark:bg-black/40">
      <div className="flex h-16 shrink-0 items-center px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            EA360
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col px-3 py-4 space-y-1">
        {navigation.map((item) => {
          // Precisamos ser um pouco mais flexíveis se a rota for um subset, mas pro painel exato:
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute inset-0 rounded-lg bg-zinc-100 dark:bg-white/10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                />
              )}

              {/* Hover background for non-active items */}
              {!isActive && (
                <div className="absolute inset-0 rounded-lg bg-zinc-100/0 transition-colors group-hover:bg-zinc-100/50 dark:group-hover:bg-white/5" />
              )}

              <item.icon
                className={cn(
                  "relative z-10 h-5 w-5 shrink-0 transition-colors",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300"
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "relative z-10 transition-colors",
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                    : "text-zinc-600 group-hover:text-zinc-900 dark:text-zinc-400 dark:group-hover:text-zinc-200"
                )}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User Area Footer Placeholder */}
      <div className="p-4 mt-auto">
        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm shadow-inner">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-none">Admin User</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Plano Enterprise</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
