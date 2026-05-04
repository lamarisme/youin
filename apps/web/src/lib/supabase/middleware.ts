import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const pathWithSearch = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const isAuthRoute = path.startsWith("/auth");
  // Reset-password requires an active recovery session, so authed users must be
  // allowed to reach it. Callback handles its own session exchange + redirects.
  const isAuthRouteAllowedWhileSignedIn =
    path.startsWith("/auth/reset-password") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/auth/error");
  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/spaces") ||
    path.startsWith("/account") ||
    path.startsWith("/profile");

  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/sign-in";
    redirectUrl.searchParams.set("next", pathWithSearch);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute && !isAuthRouteAllowedWhileSignedIn) {
    const redirectUrl = request.nextUrl.clone();
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam && nextParam.startsWith("/")) {
      return NextResponse.redirect(new URL(nextParam, request.url));
    }
    redirectUrl.pathname = "/dashboard";
    redirectUrl.searchParams.set("space", "all");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
