import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Helper de middleware: faz o refresh da sessão Supabase a cada request
 * e mantém os cookies sincronizados entre request e response.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: não rode código entre createServerClient e getUser().
  // getUser() revalida o token e dispara o set de cookies no response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rotas protegidas: apenas a área autenticada do app (/app/*) exige sessão.
  // Demais rotas (landing, GOM público, /auth/*) permanecem públicas (AC8).
  const { pathname } = request.nextUrl;
  const isProtected = pathname === "/app" || pathname.startsWith("/app/");

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
