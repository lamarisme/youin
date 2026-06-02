import { getTranslations } from "next-intl/server";
import {
  CheckCircle2,
  CircleDashed,
  MessageSquare,
  MousePointer2,
  Plus,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { MarkPin } from "@/components/mark-pin";

type ProductRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  path: string;
};

export async function LandingProductStage() {
  const t = await getTranslations("landing.productStage");
  const messages = (await import("@youin/i18n/messages/en.json")).default;
  const rows = messages.landing.productStage.rows as ProductRow[];

  return (
    <div
      className="relative z-0 min-w-0"
      role="img"
      aria-label={t("ariaLabel")}
    >
      <div className="relative w-full overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule">
        <div className="flex h-10 items-center justify-between border-b border-rule bg-paper-2 px-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rule-strong" />
            <span className="size-2.5 rounded-full bg-rule" />
            <span className="size-2.5 rounded-full bg-rule" />
          </div>
          <div className="hidden rounded-md bg-paper px-3 py-1 font-mono text-ui-xs text-ink-3 sm:block">
            {t("urlBar")}
          </div>
        </div>

        <div className="bg-paper-2 p-2 sm:p-3 lg:p-4" aria-hidden>
          <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative min-h-[24rem] overflow-hidden rounded-md bg-paper ring-1 ring-rule">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-paper">
                    <BrandLogo className="size-4 text-paper" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-ui-sm font-semibold text-ink">
                      {t("liveSiteName")}
                    </p>
                    <p className="text-ui-xs text-ink-3">{t("liveSiteSection")}</p>
                  </div>
                </div>
                <div className="hidden items-center gap-4 text-ui-xs font-medium text-ink-3 sm:flex">
                  <span>{t("liveNavProduct")}</span>
                  <span>{t("liveNavPricing")}</span>
                  <span>{t("liveNavDocs")}</span>
                </div>
              </div>

              <div className="relative p-4 sm:p-5">
                <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,20rem)] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-eyebrow">{t("livePageEyebrow")}</p>
                    <h2 className="mt-2 max-w-[12ch] font-display text-[2.125rem] font-semibold leading-[0.98] text-ink sm:text-[2.5rem]">
                      {t("livePageTitle")}
                    </h2>
                    <p className="mt-3 max-w-[34ch] text-ui-sm leading-relaxed text-ink-2 sm:text-ui-md">
                      {t("livePageSubtitle")}
                    </p>
                    <p className="pd-anim-comment mt-4 max-w-[13rem] rounded-md bg-paper-elevated px-3 py-2 text-ui-xs leading-snug text-ink-2 ring-1 ring-rule">
                      {t("commentPreview")}
                    </p>
                  </div>

                  <div className="relative min-w-0 rounded-md border border-mark/50 bg-mark-soft p-3 ring-2 ring-mark/25">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-ui-xs font-semibold text-mark">{t("planPro")}</p>
                      <span className="rounded bg-paper px-1.5 py-0.5 text-ui-2xs font-medium text-mark">
                        {t("planBadge")}
                      </span>
                    </div>
                    <p className="mt-2 font-display text-xl font-semibold text-ink">
                      {t("planProPrice")}
                    </p>
                    <div className="relative mt-4">
                      <div className="flex h-8 items-center justify-center rounded-md bg-mark px-2 text-ui-xs font-semibold text-paper">
                        {t("livePageCta")}
                      </div>
                      <MarkPin label="1" size="lg" pulse className="pd-anim-pin absolute -right-2 -top-3" />
                      <MousePointer2 className="pd-anim-cursor absolute -bottom-7 right-4 size-6 rotate-[-18deg] fill-ink text-ink" />
                    </div>
                  </div>

                  <div className="hidden gap-2 sm:col-start-2 sm:grid sm:grid-cols-2">
                    <div className="min-w-0 rounded-md border border-rule bg-paper-elevated p-2.5">
                      <p className="text-ui-xs font-medium text-ink-3">{t("planStarter")}</p>
                      <p className="mt-1 font-display text-lg font-semibold text-ink">
                        {t("planStarterPrice")}
                      </p>
                    </div>
                    <div className="min-w-0 rounded-md border border-rule bg-paper-elevated p-2.5">
                      <p className="text-ui-xs font-medium text-ink-3">{t("planScale")}</p>
                      <p className="mt-1 font-display text-lg font-semibold text-ink">
                        {t("planScalePrice")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <aside className="min-w-0 rounded-md bg-paper-elevated ring-1 ring-rule">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-rule px-4">
                <div className="min-w-0">
                  <p className="font-mono text-ui-xs font-semibold text-mark">{t("detailId")}</p>
                  <p className="truncate text-ui-xs text-ink-3">{t("taskStatus")}</p>
                </div>
                <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-mark px-2.5 text-ui-sm font-medium text-paper">
                  <Plus className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{t("newMark")}</span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-title-sm font-semibold leading-snug text-ink">
                  {t("detailTitle")}
                </p>
                <p className="mt-2 text-ui-xs leading-5 text-ink-2">{t("detailBody")}</p>

                <dl className="mt-4 divide-y divide-rule rounded-md border border-rule bg-paper">
                  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 px-3 py-2">
                    <dt className="text-ui-xs text-ink-3">{t("selectorLabel")}</dt>
                    <dd className="min-w-0 truncate font-mono text-ui-xs text-ink">
                      {t("selectorValue")}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 px-3 py-2">
                    <dt className="text-ui-xs text-ink-3">{t("viewportLabel")}</dt>
                    <dd className="min-w-0 font-mono text-ui-xs text-ink">
                      {t("viewportValue")}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 px-3 py-2">
                    <dt className="text-ui-xs text-ink-3">{t("screenshotLabel")}</dt>
                    <dd className="min-w-0 text-ui-xs font-medium text-ink">
                      {t("screenshotValue")}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center gap-2 text-ui-xs text-ink-3">
                  <MessageSquare className="size-3.5" />
                  {t("detailComments")}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-3 grid min-w-0 gap-px overflow-hidden rounded-md bg-rule ring-1 ring-rule sm:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-paper-elevated px-3"
              >
                {row.status === "open" ? (
                  <CircleDashed className="size-3.5 text-mark" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-ok" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-ui-xs font-medium text-ink">{row.title}</p>
                  <p className="mt-0.5 truncate font-mono text-ui-2xs text-ink-3">
                    {row.id} · {row.path}
                  </p>
                </div>
                <span className="hidden rounded bg-paper-3 px-1.5 py-0.5 text-ui-2xs font-medium text-ink-2 sm:inline">
                  {row.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
