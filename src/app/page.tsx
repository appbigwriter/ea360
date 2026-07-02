import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black">
      <main className="flex max-w-lg flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bem-vindo ao EA360
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Sua plataforma de orquestração e gestão de funis CTWA automatizados e blindados.
        </p>
        <div className="mt-4 flex gap-4">
          <Button asChild size="lg">
            <Link href="/auth/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/signup">Cadastre-se</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
