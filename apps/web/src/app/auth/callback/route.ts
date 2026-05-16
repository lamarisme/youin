import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_AFTER_AUTH = "/dashboard";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const oauthError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  let next = requestUrl.searchParams.get("next") ?? DEFAULT_AFTER_AUTH;

  if (!next.startsWith("/")) {
    next = DEFAULT_AFTER_AUTH;
  }

  function redirectAuthError(reason: "oauth" | "exchange" | "otp" | "incomplete") {
    const errorUrl = new URL("/auth/error", requestUrl.origin);
    errorUrl.searchParams.set("next", next);
    errorUrl.searchParams.set("reason", reason);
    return NextResponse.redirect(errorUrl);
  }

  if (oauthError || errorDescription) {
    return redirectAuthError("oauth");
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
    return redirectAuthError("exchange");
  }

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
    return redirectAuthError("otp");
  }

  if (tokenHash || otpType) {
    return redirectAuthError("otp");
  }

  return redirectAuthError("incomplete");
}
