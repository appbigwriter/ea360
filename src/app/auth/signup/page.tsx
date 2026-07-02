import type { Metadata } from "next";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = {
  title: "Criar conta · EA360",
};

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-muted-foreground text-sm">Comece a usar o EA360 em poucos segundos.</p>
        </div>
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
