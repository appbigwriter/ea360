"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions de autenticação (Story 1.3).
 * Usam o cliente Supabase SSR (Story 1.2) para signUp / signIn / signOut.
 * Nenhum segredo é exposto ao client — tudo roda no servidor.
 */

export type AuthState = {
  error?: string;
  success?: string;
};

const credentialsSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Informe seu nome."),
});

function fieldFromForm(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Cadastro por e-mail/senha (AC1). Em sucesso, redireciona para o app.
 */
export async function signUp(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: fieldFromForm(formData, "email"),
    password: fieldFromForm(formData, "password"),
    fullName: fieldFromForm(formData, "fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/app/panel");
}

/**
 * Login por e-mail/senha (AC2). Em sucesso, redireciona para o app.
 */
export async function signIn(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: fieldFromForm(formData, "email"),
    password: fieldFromForm(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  revalidatePath("/", "layout");
  redirect("/app/panel");
}

/**
 * Logout (AC3): limpa a sessão e redireciona para página pública.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
