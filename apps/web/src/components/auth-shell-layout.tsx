import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function AuthShellLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("authShell");

  return (
    <div className="min-h-screen bg-paper">
      <div className="shell flex min-h-screen flex-col page-y">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="pin-dot">Y</span>
            <span className="font-display text-lg font-semibold text-ink">youin</span>
          </Link>
          <p className="font-mono text-[0.6875rem] text-ink-3">{t("workspaceAccess")}</p>
        </header>

        <div className="h-px bg-rule" />

        <main className="grid flex-1 items-center gap-12 py-8 md:grid-cols-[1.12fr_1fr] md:gap-16 md:py-12">
          <section className="section-block order-2 md:order-1">
            <div>
              <p className="text-eyebrow mb-2">{t("eyebrow")}</p>
              <h1 className="text-editorial-md text-ink">{t("headline")}</h1>
            </div>

            <p className="max-w-[46ch] text-[0.9375rem] leading-relaxed text-ink-2">{t("lead")}</p>

            <div className="max-w-[32rem] overflow-hidden rounded-lg border border-rule">
              <div className="grid grid-cols-3 gap-px bg-rule">
                <Stat label={t("statTeams")} value="236" />
                <Stat label={t("statMarksPerDay")} value="12.4k" />
                <Stat label={t("statMedianTriage")} value="11m" />
              </div>
            </div>

            <ul className="space-y-1.5 text-[0.8125rem] leading-relaxed text-ink-2">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-2 px-4 py-3.5">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
