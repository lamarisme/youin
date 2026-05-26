"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LandingPrimaryButton } from "@/components/landing-buttons";
import { cn } from "@/lib/utils";

type LandingAuthStatus = "loading" | "authenticated" | "unauthenticated";

type LandingAuthContextValue = {
  status: LandingAuthStatus;
};

const LandingAuthContext = createContext<LandingAuthContextValue | null>(null);

function useLandingAuth() {
  const context = useContext(LandingAuthContext);
  if (!context) {
    throw new Error("useLandingAuth must be used within LandingAuthProvider");
  }
  return context;
}

export function LandingAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LandingAuthStatus>("loading");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        setStatus(session ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (active) setStatus("unauthenticated");
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "authenticated" : "unauthenticated");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <LandingAuthContext.Provider value={{ status }}>{children}</LandingAuthContext.Provider>
  );
}

function AuthActionsSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact ? "shrink-0" : "justify-end",
      )}
      aria-hidden
    >
      <span
        className={cn(
          "rounded-md bg-paper-3 motion-safe:animate-pulse",
          compact ? "hidden h-9 w-16 sm:inline-block" : "h-9 w-24",
        )}
      />
      <span
        className={cn(
          "rounded-md bg-paper-3 motion-safe:animate-pulse",
          compact ? "h-9 w-28" : "h-11 w-32",
        )}
      />
    </div>
  );
}

export function LandingHeaderAuth() {
  const t = useTranslations("landingHeader");
  const { status } = useLandingAuth();

  if (status === "loading") {
    return <AuthActionsSkeleton />;
  }

  if (status === "authenticated") {
    return (
      <Button asChild size="sm" className="h-9 shrink-0 px-3.5 text-ui-sm">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5">
          {t("openDashboard")}
          <ArrowRight className="size-3.5 shrink-0" aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <Link
        href="/login"
        className="-mx-1 hidden h-9 items-center px-2 text-ui-sm font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:inline-flex"
      >
        {t("signIn")}
      </Link>
      <LandingPrimaryButton href="/signup" compact>
        {t("startTrial")}
      </LandingPrimaryButton>
    </div>
  );
}

export function LandingMobileSignIn() {
  const t = useTranslations("landingHeader");
  const { status } = useLandingAuth();

  if (status === "loading") {
    return (
      <span
        className="inline-flex h-11 w-16 shrink-0 rounded-md bg-paper-3 motion-safe:animate-pulse"
        aria-hidden
      />
    );
  }

  if (status === "authenticated") {
    return (
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-rule px-3 text-ui-sm font-medium text-ink transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {t("openDashboard")}
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-ui-sm font-medium text-ink transition-colors hover:bg-paper-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {t("signIn")}
    </Link>
  );
}
