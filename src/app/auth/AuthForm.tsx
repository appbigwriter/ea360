"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AuthState } from "./actions";
import { signIn, signUp } from "./actions";

type AuthFormProps = {
  mode: "login" | "signup";
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Aguarde…" : label}
    </Button>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2";

/**
 * Formulário compartilhado de autenticação (Story 1.3, AC9).
 * Reutilizado pelas páginas /auth/login e /auth/signup com a Server Action
 * apropriada injetada via prop.
 */

export function AuthForm({ mode }: AuthFormProps) {
  const [loginState, loginAction] = useActionState<AuthState, FormData>(signIn, {});
  const [signupState, signupAction] = useActionState<AuthState, FormData>(signUp, {});

  const formAction = mode === "login" ? loginAction : signupAction;
  const state = mode === "login" ? loginState : signupState;

  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {isSignup && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fullName" className="text-sm font-medium">
            Nome
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            className={inputClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          className={inputClass}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <SubmitButton label={isSignup ? "Criar conta" : "Entrar"} />

      <p className="text-muted-foreground text-center text-sm">
        {isSignup ? (
          <>
            Já tem conta?{" "}
            <Link href="/auth/login" className="font-medium underline">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Não tem conta?{" "}
            <Link href="/auth/signup" className="font-medium underline">
              Cadastre-se
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
