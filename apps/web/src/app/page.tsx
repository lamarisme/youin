import { getTranslations } from "next-intl/server";

import {
  LandingPrimaryButton,
  SecondaryCtaButton,
} from "@/components/landing-buttons";
import {
  LandingHeaderAuth,
  LandingMobileSignIn,
} from "@/components/landing-header-auth";
import { LandingLoopScene } from "@/components/landing-loop-scene";
import { LandingPinNote } from "@/components/landing-pin-note";
import { LandingProductStage } from "@/components/landing-product-stage";
import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";

type LandingNavItem = { href: string; label: string };
type LoopStep = { title: string; body: string };
type Persona = { role: string; detail: string; body: string };
type PinAnnotation = { pin: string; note: string };

const LOOP_SCENE_VARIANTS = ["capture", "anchor", "sync"] as const;

export default async function Home() {
  const t = await getTranslations("landing");
  const messages = (await import("@youin/i18n/messages/en.json")).default;
  const landing = messages.landing as {
    nav: LandingNavItem[];
    loop: { steps: LoopStep[] };
    who: { personas: Persona[] };
    annotations: PinAnnotation[];
  };

  const navItems = landing.nav;
  const loopSteps = landing.loop.steps;
  const personas = landing.who.personas;
  const annotations = landing.annotations;

  return (
    <div className="min-h-screen bg-paper bg-paper-grain text-ink">
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-ink focus-visible:px-3 focus-visible:py-2 focus-visible:text-ui-sm focus-visible:font-medium focus-visible:text-paper"
      >
        {t("skipLink")}
      </a>
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/95">
        <div className="shell flex items-center justify-between py-3.5">
          <Link href="/" aria-label="youin home" className="flex min-h-11 items-center gap-2.5">
            <BrandLogo />
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-5 text-ui-sm text-ink-2 md:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="-mx-2 inline-flex min-h-11 items-center px-2 transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <LandingHeaderAuth />
          </div>
        </div>
        <div className="shell pb-3 md:hidden">
          <nav aria-label="Mobile navigation" className="flex gap-2 overflow-x-auto">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-rule px-3 text-ui-sm text-ink-2"
              >
                {item.label}
              </a>
            ))}
            <LandingMobileSignIn />
          </nav>
        </div>
      </header>

      <main id="main" className="section-stack pb-[var(--page-y-loose)]">
        <section className="section-reveal overflow-hidden">
          <div className="shell relative pt-12 sm:pt-16 lg:pt-20">
            <LandingPinNote
              pin={annotations[0].pin}
              note={annotations[0].note}
              className="right-0 top-8 max-w-[14rem]"
            />
            <div className="relative z-10 max-w-[62rem] pb-8">
              <p className="text-eyebrow mb-4">{t("hero.eyebrow")}</p>
              <h1 className="text-editorial-hero max-w-[12ch] text-ink">{t("hero.title")}</h1>
              <p className="mt-6 max-w-[62ch] text-ui-md leading-7 text-ink-2 sm:text-ui-lg">
                {t("hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LandingPrimaryButton href="/signup">{t("hero.chromeCta")}</LandingPrimaryButton>
                <SecondaryCtaButton href="#loop">{t("hero.secondaryCta")}</SecondaryCtaButton>
              </div>
              <p className="mt-5 font-mono text-ui-xs text-ink-3">{t("hero.metaLine")}</p>
            </div>
            <LandingProductStage />
          </div>
        </section>

        <section
          id="problem"
          className="shell scroll-mt-32 pt-8 md:scroll-mt-20 md:pt-12"
        >
          <div className="relative grid gap-6 md:grid-cols-[1fr_1.4fr] md:gap-12">
            <LandingPinNote
              pin={annotations[1].pin}
              note={annotations[1].note}
              className="-right-2 top-0 md:right-0"
            />
            <div>
              <h2 className="text-editorial-md text-ink">{t("problem.title")}</h2>
            </div>
            <div className="space-y-4">
              <p className="text-ui-lg leading-relaxed text-ink-2">{t("problem.p1")}</p>
              <div className="rounded-lg bg-paper-2 px-4 py-3">
                <p className="text-eyebrow mb-2">{t("problem.oldLoopLabel")}</p>
                <p className="text-ui-sm leading-relaxed text-ink-3">
                  {t("problem.oldLoopBody")}
                </p>
              </div>
              <div className="rounded-lg bg-mark-soft px-4 py-3">
                <p className="text-eyebrow mb-2">{t("problem.withLabel")}</p>
                <p className="text-ui-sm font-medium leading-relaxed text-ink">
                  {t("problem.withBody")}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="loop" className="shell scroll-mt-32 md:scroll-mt-20">
          <div className="relative mb-10">
            <LandingPinNote
              pin={annotations[2].pin}
              note={annotations[2].note}
              className="right-0 top-0"
            />
            <p className="text-eyebrow mb-2">{t("loop.eyebrow")}</p>
            <h2 className="text-editorial-md text-ink">{t("loop.title")}</h2>
          </div>

          <div className="space-y-14 lg:space-y-16">
            {loopSteps.map((step, index) => (
              <div
                key={step.title}
                className={`grid gap-6 md:grid-cols-2 md:items-center md:gap-10 lg:gap-14 ${
                  index % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="max-w-[52ch]">
                  <p className="text-eyebrow mb-2">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="font-display text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-ui-sm leading-relaxed text-ink-2">{step.body}</p>
                </div>
                <LandingLoopScene variant={LOOP_SCENE_VARIANTS[index]} />
              </div>
            ))}
          </div>
        </section>

        <section id="who" className="shell scroll-mt-32 md:scroll-mt-20">
          <div className="mb-10">
            <p className="text-eyebrow mb-2">{t("who.eyebrow")}</p>
            <h2 className="text-editorial-md text-ink">{t("who.title")}</h2>
          </div>

          <div className="divide-y divide-rule border-y border-rule">
            {personas.map((p) => (
              <div
                key={p.role}
                className="grid gap-1 py-6 md:grid-cols-[180px_220px_1fr] md:items-baseline md:gap-10"
              >
                <p className="text-eyebrow">{p.detail}</p>
                <h3 className="font-display text-xl font-semibold text-ink">{p.role}</h3>
                <p className="max-w-[62ch] text-ui-md leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="install"
          className="border-t border-rule bg-paper-2 scroll-mt-32 md:scroll-mt-20"
        >
          <div className="shell page-y-loose grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="text-editorial-md text-ink">{t("install.title")}</h2>
              <p className="mt-4 max-w-[48ch] text-ui-lg leading-relaxed text-ink-2">
                {t("install.subtitle")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <LandingPrimaryButton href="/signup">{t("install.chromeCta")}</LandingPrimaryButton>
                <SecondaryCtaButton href="/contact">{t("install.contactCta")}</SecondaryCtaButton>
              </div>
            </div>

            <div>
              <p className="text-eyebrow mb-4">{t("install.glanceTitle")}</p>
              <dl className="divide-y divide-rule border-y border-rule text-ui-md">
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-ink-2">{t("install.onboardingLabel")}</dt>
                  <dd className="font-medium text-ink">{t("install.onboardingValue")}</dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-ink-2">{t("install.tabsLabel")}</dt>
                  <dd className="font-medium text-ink">{t("install.tabsValue")}</dd>
                </div>
                <div className="flex items-baseline justify-between py-3">
                  <dt className="text-ink-2">{t("install.connectorsLabel")}</dt>
                  <dd className="font-medium text-ink">{t("install.connectorsValue")}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-paper py-6">
        <div className="shell flex items-center justify-between gap-4">
          <p className="font-mono text-ui-xs text-ink-3">{t("footer.copyright")}</p>
          <div className="-my-1.5 flex gap-1 text-ui-xs text-ink-3">
            <Link href="/terms" className="inline-flex min-h-11 items-center px-2 hover:text-ink">
              {t("footer.terms")}
            </Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center px-2 hover:text-ink">
              {t("footer.privacy")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
