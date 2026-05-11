"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "needs-login" | "sending" | "ok" | "error";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: unknown,
          callback?: (response: unknown) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
}

function BridgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const extensionId = useMemo(() => searchParams.get("ext") ?? "", [searchParams]);
  const provider = useMemo(() => searchParams.get("provider"), [searchParams]);
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string>("");
  const triggeredOauth = useRef(false);

  useEffect(() => {
    if (!extensionId) {
      setStatus("error");
      setMessage("Missing extension id. Reopen this page from the youin extension popup.");
      return;
    }
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        // Not signed in. If the popup asked for Google OAuth, kick it off here so
        // the user lands back on /auth/callback with this same `next` URL.
        if (provider === "google" && !triggeredOauth.current) {
          triggeredOauth.current = true;
          const origin = window.location.origin;
          const next = new URL("/auth/extension-bridge", origin);
          next.searchParams.set("ext", extensionId);
          const redirectTo = new URL("/auth/callback", origin);
          redirectTo.searchParams.set("next", next.pathname + next.search);
          const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: redirectTo.toString() },
          });
          if (oauthError) {
            setStatus("error");
            setMessage(oauthError.message);
          }
          return;
        }
        setStatus("needs-login");
        return;
      }
      sendToExtension(extensionId, data.session.access_token, data.session.refresh_token, (err) => {
        if (cancelled) return;
        if (err) {
          setStatus("error");
          setMessage(err);
          return;
        }
        setStatus("ok");
        setMessage("Connected. You can close this tab.");
        // Best-effort auto-close after a beat.
        setTimeout(() => window.close(), 1200);
      });
      setStatus("sending");
    })();
    return () => {
      cancelled = true;
    };
  }, [extensionId, provider]);

  function handleLogin() {
    const next = `/auth/extension-bridge?ext=${encodeURIComponent(extensionId)}${
      provider ? `&provider=${encodeURIComponent(provider)}` : ""
    }`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="mx-auto w-full rounded-xl border border-rule bg-paper-2 p-6 sm:p-7">
      <h2 className="font-display text-xl font-semibold text-ink">
        Connect youin extension
      </h2>
      <p className="mt-1 text-[0.8125rem] text-ink-2">
        {status === "checking" && "Checking your session…"}
        {status === "needs-login" && "Sign in to your youin account to finish connecting the extension."}
        {status === "sending" && "Sending your session to the extension…"}
        {status === "ok" && "Extension connected."}
        {status === "error" && "Could not connect the extension."}
      </p>

      {message ? (
        <p
          role="alert"
          className={`mt-4 rounded-md border px-3 py-2 text-[0.75rem] ${
            status === "error"
              ? "border-mark/25 bg-mark-soft text-mark"
              : "border-rule bg-paper text-ink-2"
          }`}
        >
          {message}
        </p>
      ) : null}

      {status === "needs-login" ? (
        <Button className="mt-5 w-full bg-mark text-paper hover:bg-mark-bright" onClick={handleLogin}>
          Sign in to continue
        </Button>
      ) : null}

      {status === "error" ? (
        <Button
          variant="outline"
          className="mt-5 w-full"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}

function sendToExtension(
  extensionId: string,
  accessToken: string,
  refreshToken: string,
  done: (err: string | null) => void,
) {
  const chromeRuntime = window.chrome?.runtime;
  if (!chromeRuntime?.sendMessage) {
    done("This browser cannot talk to extensions. Use Chrome or another Chromium browser.");
    return;
  }
  try {
    chromeRuntime.sendMessage(
      extensionId,
      {
        type: "youin:set-session",
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      (response: unknown) => {
        const lastError = chromeRuntime.lastError?.message;
        if (lastError) {
          done(`Extension did not respond: ${lastError}`);
          return;
        }
        const ok =
          response && typeof response === "object" && "ok" in response
            ? Boolean((response as { ok: unknown }).ok)
            : false;
        if (!ok) {
          const errMsg =
            response && typeof response === "object" && "error" in response
              ? String((response as { error: unknown }).error)
              : "Extension rejected the session.";
          done(errMsg);
          return;
        }
        done(null);
      },
    );
  } catch (e) {
    done(e instanceof Error ? e.message : "Unexpected error talking to extension.");
  }
}

export default function ExtensionBridgePage() {
  return (
    <Suspense fallback={null}>
      <BridgeContent />
    </Suspense>
  );
}
