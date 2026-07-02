import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = {
  title: "Entrar · EA360",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-muted-foreground text-sm">Acesse sua conta do EA360.</p>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
