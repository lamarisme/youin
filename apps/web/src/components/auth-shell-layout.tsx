import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import Link from "next/link";
import { Check } from "lucide-react";

import { BrandLockup } from "@/components/brand-lockup";

export async function AuthShellLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("authShell");

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95">
        <div className="shell flex h-14 items-center justify-between">
          <Link href="/" aria-label="youin home" className="flex h-10 items-center">
            <BrandLockup />
          </Link>
          <p className="hidden h-10 items-center font-mono text-ui-xs text-ink-3 sm:inline-flex">
            {t("workspaceAccess")}
          </p>
        </div>
      </header>

      <main className="shell grid min-h-[calc(100vh-3.5rem)] min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-6 overflow-hidden py-4 md:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] md:gap-12 md:py-6">
        <section className="section-block order-2 min-w-0 md:order-1">
          <div className="min-w-0">
            <p className="text-eyebrow mb-2">{t("eyebrow")}</p>
            <p className="text-editorial-md max-w-[12ch] text-wrap text-ink sm:max-w-[15ch]">
              {t("headline")}
            </p>
          </div>

          <p className="max-w-[46ch] text-ui-lg leading-relaxed text-ink-2">{t("lead")}</p>

          <div className="w-full max-w-[34rem] rounded-lg bg-paper-2 p-2.5">
            <div className="grid gap-2 sm:grid-cols-3">
              <BetaPoint label={t("betaFree")} />
              <BetaPoint label={t("betaNoCard")} />
              <BetaPoint label={t("betaSetup")} />
            </div>
          </div>

          <ul className="space-y-1 text-ui-sm leading-relaxed text-ink-2">
            <li>{t("bullet1")}</li>
            <li>{t("bullet2")}</li>
            <li>{t("bullet3")}</li>
          </ul>
        </section>

        <section className="order-1 min-w-0 w-full md:order-2 md:max-w-[480px] md:justify-self-end">
          {children}
        </section>
      </main>
    </div>
  );
}

function BetaPoint({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-paper-elevated px-3 py-2 text-ui-sm font-medium text-ink shadow-[var(--shadow-hairline)]">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Check className="size-3" aria-hidden />
      </span>
      <span className="min-w-0">{label}</span>
    </div>
  );
}
