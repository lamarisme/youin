"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ChromeCtaButton } from "@/components/landing-buttons";

function useIsSignedIn() {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setIsSignedIn(Boolean(session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return isSignedIn;
}

export function LandingHeaderAuth() {
  const isSignedIn = useIsSignedIn();

  if (isSignedIn) {
    return (
      <Button asChild size="sm" className="h-9 px-3.5 text-[0.8125rem]">
        <Link href="/dashboard?space=all" className="inline-flex items-center gap-2">
          Open dashboard
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="-mx-1 -my-1.5 hidden px-1 py-1.5 text-[0.8125rem] font-medium text-ink-2 hover:text-ink sm:inline-flex sm:items-center"
      >
        Sign in
      </Link>
      <ChromeCtaButton href="#install" compact />
    </>
  );
}

export function LandingMobileSignIn() {
  const isSignedIn = useIsSignedIn();
  if (isSignedIn) return null;

  return (
    <Link
      href="/login"
      className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-[0.8125rem] font-medium text-ink"
    >
      Sign in
    </Link>
  );
}
