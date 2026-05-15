import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import Link from "next/link";
import { Check } from "lucide-react";

export async function AuthShellLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("authShell");

  return (
    <div className="min-h-screen bg-paper">
      <div className="shell flex min-h-screen flex-col py-4">
        <header className="mb-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold text-ink">youin</span>
          </Link>
          <p className="font-mono text-[0.6875rem] text-ink-3">{t("workspaceAccess")}</p>
        </header>

        <div className="h-px bg-rule" />

        <main className="grid flex-1 items-center gap-6 py-4 md:grid-cols-[1.12fr_1fr] md:gap-12 md:py-6">
          <section className="section-block order-2 md:order-1">
            <div>
              <p className="text-eyebrow mb-2">{t("eyebrow")}</p>
              <h1 className="text-editorial-md text-ink">{t("headline")}</h1>
            </div>

            <p className="max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-2">{t("lead")}</p>

            <div className="max-w-[34rem] rounded-lg border border-rule bg-paper-2 p-2.5">
              <div className="grid gap-2 sm:grid-cols-3">
                <BetaPoint label={t("betaFree")} />
                <BetaPoint label={t("betaNoCard")} />
                <BetaPoint label={t("betaSetup")} />
              </div>
            </div>

            <ul className="space-y-1 text-[0.8125rem] leading-relaxed text-ink-2">
              <li>{t("bullet1")}</li>
              <li>{t("bullet2")}</li>
              <li>{t("bullet3")}</li>
            </ul>
          </section>

          <section className="order-1 md:order-2 w-full md:justify-self-end md:max-w-[480px]">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}

function BetaPoint({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-paper px-3 py-2 text-[0.8125rem] font-medium text-ink">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Check className="size-3" aria-hidden />
      </span>
      <span>{label}</span>
    </div>
  );
}
