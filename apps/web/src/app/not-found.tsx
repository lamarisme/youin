import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";

import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This youin page does not exist. Return to the product overview or your workspace.",
};

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col bg-paper bg-paper-grain text-ink">
      <header className="border-b border-rule bg-paper/95">
        <div className="shell flex h-14 items-center justify-between">
          <Link href="/" aria-label="youin home" className="flex h-10 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
            <BrandLockup />
          </Link>
          <nav className="flex items-center gap-2 md:gap-3">
            <Button variant="ghost" size="sm" asChild className="h-10 text-ui-sm text-ink-2 hover:text-ink">
              <Link href="/login">{t("signIn")}</Link>
            </Button>
            <Button variant="mark" size="sm" asChild className="h-10">
              <Link href="/signup" className="inline-flex items-center gap-1.5">
                {t("createAccount")}
                <ArrowRight className="size-3 opacity-90" aria-hidden />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="shell grid flex-1 gap-[var(--space-3xl)] py-[var(--page-y-loose)] pb-[var(--space-4xl)] lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-center lg:gap-[var(--space-4xl)]">
        <div className="section-block lg:justify-self-start">
          <p className="text-eyebrow">{t("sectionRouting")}</p>
          <p className="font-mono text-ui-xs text-ink-2">{t("status404")}</p>
          <div className="mt-[var(--space-lg)] hidden max-w-[12rem] font-mono text-ui-2xs leading-relaxed text-ink-3 lg:block">
            {t("asideNote")}
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-4 -z-[1] rounded-2xl border border-dashed border-rule/70 bg-paper-2/50 md:-inset-6"
            aria-hidden
          />

          <div className="section-block max-w-[48ch]">
            <p className="text-eyebrow text-mark">{t("eyebrow")}</p>
            <h1 className="text-editorial-md text-ink">{t("title")}</h1>
            <p className="text-ui-lg leading-relaxed text-ink-2 md:text-ui-md">{t("body")}</p>

            <div className="flex flex-wrap items-center gap-[var(--space-sm)] pt-[var(--space-md)]">
              <Button variant="mark" size="lg" asChild className="h-10 px-5 font-semibold">
                <Link href="/" className="inline-flex items-center gap-2">
                  <ArrowLeft className="size-[1.05rem]" aria-hidden />
                  {t("backHome")}
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-10 border-rule bg-paper px-5 text-ui-md">
                <Link href="/dashboard">{t("openTriage")}</Link>
              </Button>
            </div>

            <div className="border-t border-rule pt-[var(--space-lg)]">
              <p className="text-ui-sm font-medium text-ink">{t("shortcutsTitle")}</p>
              <ul className="mt-[var(--space-sm)] grid gap-[var(--space-xs)] font-mono text-ui-xs text-ink-3 sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <span className="text-mark">/</span>
                  <Link href="/" className="inline-flex min-h-10 items-center rounded-md px-1 text-ink-2 underline-offset-[3px] transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                    {t("productOverview")}
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-mark">/</span>
                  <Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-md px-1 text-ink-2 underline-offset-[3px] transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                    {t("dashboardLink")}
                  </Link>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-mark">/</span>
                  <Link href="/account" className="inline-flex min-h-10 items-center rounded-md px-1 text-ink-2 underline-offset-[3px] transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                    {t("accountSettingsLink")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-rule bg-paper-2/40">
        <div className="shell flex flex-wrap items-center justify-between gap-[var(--space-sm)] py-[var(--space-md)] font-mono text-ui-xs text-ink-3">
          <p>{t("footer")}</p>
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center rounded-md px-2 text-ink-2 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {t("signInInstead")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
