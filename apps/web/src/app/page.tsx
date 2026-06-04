import { getTranslations } from "next-intl/server";

import {
  LandingPrimaryButton,
  SecondaryCtaButton,
} from "@/components/landing-buttons";
import {
  LandingAuthProvider,
  LandingHeaderAuth,
  LandingMobileSignIn,
} from "@/components/landing-header-auth";
import { BrandLockup } from "@/components/brand-lockup";
import Link from "next/link";

type LandingNavItem = { href: string; label: string };
type LoopStep = { title: string; body: string };
type LandingHero = { proof: string[] };

export default async function Home() {
  const t = await getTranslations("landing");
  const messages = (await import("@youin/i18n/messages/en.json")).default;
  const landing = messages.landing as {
    nav: LandingNavItem[];
    hero: LandingHero;
    loop: { steps: LoopStep[] };
  };

  const navItems = landing.nav;
  const heroProof = landing.hero.proof;
  const loopSteps = landing.loop.steps;

  return (
    <div className="landing-theme min-h-screen bg-paper bg-paper-grain text-ink">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-mark focus-visible:px-3 focus-visible:py-2 focus-visible:text-ui-sm focus-visible:font-medium focus-visible:text-paper"
      >
        {t("skipLink")}
      </a>
      <LandingAuthProvider>
        <header className="sticky top-0 z-20 border-b border-rule bg-paper/95">
          <div className="shell flex min-h-14 items-center justify-between gap-3 py-2">
            <Link
              href="/"
              aria-label="youin home"
              className="flex h-10 shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <BrandLockup />
            </Link>
            <nav
              aria-label="Primary"
              className="hidden min-w-0 items-center gap-4 text-ui-sm font-medium text-ink-2 md:flex lg:gap-5"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="-mx-2 inline-flex h-9 max-w-[12rem] items-center truncate px-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="hidden min-w-0 shrink-0 items-center justify-end sm:flex">
              <LandingHeaderAuth />
            </div>
          </div>
          <div className="shell pb-3 md:hidden">
            <nav
              aria-label="Mobile navigation"
              className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 max-w-[14rem] shrink-0 items-center truncate rounded-md border border-rule px-3 text-ui-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {item.label}
                </a>
              ))}
              <LandingMobileSignIn />
            </nav>
          </div>
        </header>

        <main id="main" className="section-stack pb-[var(--page-y-loose)]">
          <section className="section-reveal">
            <div className="shell landing-hero-shell">
              <div className="landing-hero-copy">
                <div className="landing-hero-lede">
                  <h1 className="text-editorial-hero text-ink">{t("hero.title")}</h1>
                </div>
                <div className="landing-hero-body">
                  <p className="text-pretty text-ui-md leading-7 text-ink-2 sm:text-ui-lg">
                    {t("hero.subtitle")}
                  </p>
                  <div className="landing-hero-actions">
                    <LandingPrimaryButton href="/signup">{t("hero.chromeCta")}</LandingPrimaryButton>
                  </div>
                  <ul className="landing-hero-proof" aria-label={t("hero.proofLabel")}>
                    {heroProof.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section id="problem" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="landing-section-head">
              <h2 className="text-editorial-md text-balance text-ink">{t("problem.title")}</h2>
            </div>
            <div className="grid min-w-0 gap-[var(--block-gap)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start lg:gap-[var(--space-2xl)]">
              <p className="max-w-[52ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                {t("problem.p1")}
              </p>
              <div className="landing-compare min-w-0">
                <div className="rounded-lg bg-paper-2 px-4 py-4 sm:px-5 sm:py-5">
                  <p className="text-eyebrow mb-2">{t("problem.oldLoopLabel")}</p>
                  <p className="text-pretty text-ui-sm leading-relaxed text-ink-3">
                    {t("problem.oldLoopBody")}
                  </p>
                </div>
                <div className="rounded-lg bg-mark-soft px-4 py-4 sm:px-5 sm:py-5">
                  <p className="text-eyebrow mb-2">{t("problem.withLabel")}</p>
                  <p className="text-pretty text-ui-sm font-medium leading-relaxed text-ink">
                    {t("problem.withBody")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="loop" className="shell scroll-mt-32 md:scroll-mt-20">
            <div className="landing-section-head">
              <p className="text-eyebrow">{t("loop.eyebrow")}</p>
              <h2 className="text-editorial-md text-balance text-ink">{t("loop.title")}</h2>
            </div>

            <div className="divide-y divide-rule">
              {loopSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="grid gap-3 py-[clamp(1.5rem,4vw,2.75rem)] md:grid-cols-[4rem_minmax(0,1fr)] md:gap-[var(--space-2xl)]"
                >
                  <p className="text-eyebrow md:pt-1">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div className="max-w-[58ch] min-w-0">
                    <h3 className="font-display text-lg font-semibold text-balance text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-pretty text-ui-sm leading-relaxed text-ink-2">
                      {step.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="install"
            className="border-t border-rule bg-paper-2 scroll-mt-32 py-[var(--page-y-loose)] md:scroll-mt-20"
          >
            <div className="shell grid min-w-0 gap-[var(--space-2xl)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-[var(--space-3xl)]">
              <div className="min-w-0">
                <h2 className="text-editorial-md text-balance text-ink">{t("install.title")}</h2>
                <p className="mt-4 max-w-[48ch] text-pretty text-ui-lg leading-relaxed text-ink-2">
                  {t("install.subtitle")}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <LandingPrimaryButton href="/signup">{t("install.chromeCta")}</LandingPrimaryButton>
                  <SecondaryCtaButton href="/contact">{t("install.contactCta")}</SecondaryCtaButton>
                </div>
              </div>

              <div className="min-w-0 lg:pt-2">
                <p className="text-eyebrow mb-4">{t("install.glanceTitle")}</p>
                <dl className="divide-y divide-rule border-y border-rule text-ui-md">
                  <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                    <dt className="min-w-0 text-ink-2">{t("install.onboardingLabel")}</dt>
                    <dd className="font-medium text-ink sm:text-end">{t("install.onboardingValue")}</dd>
                  </div>
                  <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                    <dt className="min-w-0 text-ink-2">{t("install.tabsLabel")}</dt>
                    <dd className="font-medium text-ink sm:text-end">{t("install.tabsValue")}</dd>
                  </div>
                  <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-4">
                    <dt className="min-w-0 text-ink-2">{t("install.connectorsLabel")}</dt>
                    <dd className="font-medium text-ink sm:text-end">{t("install.connectorsValue")}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-rule bg-paper py-6">
          <div className="shell flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 font-mono text-ui-xs text-ink-3">{t("footer.copyright")}</p>
            <div className="-my-1.5 flex flex-wrap gap-1 text-ui-xs text-ink-3">
              <Link
                href="/terms"
                className="inline-flex min-h-11 items-center px-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t("footer.terms")}
              </Link>
              <Link
                href="/privacy"
                className="inline-flex min-h-11 items-center px-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {t("footer.privacy")}
              </Link>
            </div>
          </div>
        </footer>
      </LandingAuthProvider>
    </div>
  );
}
