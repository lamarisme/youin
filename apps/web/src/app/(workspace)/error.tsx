"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("workspace.routeError");

  useEffect(() => {
    // Surface to console in dev; production hooks (Sentry, etc.) can read error.digest server-side.
    console.error("Workspace route error", error);
  }, [error]);

  return (
    <div className="shell flex min-h-[60vh] flex-col items-start justify-center gap-5 py-[var(--page-y)]">
      <div className="flex items-center gap-2 text-eyebrow">
        <AlertTriangle className="size-3.5 text-mark" aria-hidden />
        <span>{t("eyebrow")}</span>
      </div>
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">{t("title")}</h1>
      <p className="max-w-[58ch] text-[0.875rem] leading-relaxed text-ink-2">{t("body")}</p>
      {error.digest ? (
        <p className="font-mono text-[0.6875rem] text-ink-3">
          {t("referenceLabel")}{" "}
          <span className="text-ink-2">{error.digest}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          onClick={reset}
          className="h-9 gap-2 bg-mark text-paper hover:bg-mark-bright"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          {t("tryAgain")}
        </Button>
        <Button asChild variant="outline" className="h-9">
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
