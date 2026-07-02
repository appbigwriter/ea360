import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-black overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background Decorators (Opcional para dar um glow de fundo na interface Premium) */}
      <div className="fixed inset-0 z-0 flex justify-center pointer-events-none overflow-hidden">
        <div className="absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute right-[10%] top-[20%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      {/* Main App Container */}
      <div className="relative z-10 flex h-full w-full">
        {/* Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
          <main className="relative flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-zinc-200/50 bg-white/50 backdrop-blur-sm shadow-sm dark:border-white/10 dark:bg-zinc-900/50">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
