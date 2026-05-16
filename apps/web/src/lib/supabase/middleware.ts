import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/supabase/env";
import { accountHref, isAccountSection, markHref } from "@/lib/workspace/routes";

function cleanWorkspacePath(path: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());

  if (path === "/dashboard") {
    const mark = params.get("mark");
    if (mark) return markHref(mark, params);
  }

  if (path === "/account") {
    const tab = params.get("tab");
    if (isAccountSection(tab)) return accountHref(tab);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const cleanPathWithSearch = cleanWorkspacePath(path, request.nextUrl.searchParams);
  const isAuthRoute =
    path === "/login" || path === "/signup" || path.startsWith("/auth");
  const allowSignedInAuthFlow =
    path.startsWith("/auth/callback") ||
    path.startsWith("/auth/reset-password") ||
    path.startsWith("/auth/error") ||
    path.startsWith("/auth/forgot-password");
  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/inbox") ||
    path.startsWith("/spaces") ||
    path.startsWith("/analytics") ||
    path.startsWith("/account") ||
    path.startsWith("/profile");

  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", cleanPathWithSearch);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute && !allowSignedInAuthFlow) {
    const redirectUrl = request.nextUrl.clone();
    const nextParam = request.nextUrl.searchParams.get("next");
    if (nextParam && nextParam.startsWith("/")) {
      const nextUrl = new URL(nextParam, request.url);
      const cleanNext = cleanWorkspacePath(nextUrl.pathname, nextUrl.searchParams);
      return NextResponse.redirect(new URL(cleanNext, request.url));
    }
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
