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
  const navItems = messages.landing.productStage.navItems as string[];

  return (
    <div
      className="relative z-0 -mx-4 mt-2 pb-8 sm:mx-0 sm:mt-0 lg:-mt-8"
      role="img"
      aria-label={t("ariaLabel")}
    >
      <div className="relative mx-auto max-w-[72rem] overflow-hidden rounded-t-lg bg-paper-elevated">
        <div className="flex h-10 items-center justify-between bg-paper-2 px-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rule-strong" />
            <span className="size-2.5 rounded-full bg-rule" />
            <span className="size-2.5 rounded-full bg-rule" />
          </div>
          <div className="hidden rounded-md bg-paper px-3 py-1 font-mono text-ui-xs text-ink-3 sm:block">
            {t("urlBar")}
          </div>
          <div className="flex items-center gap-1 text-ui-xs text-ink-3">
            <span className="hidden sm:inline">{t("overlayLabel")}</span>
            <MarkPin label="4" size="sm" />
          </div>
        </div>

        <div className="grid min-h-[16rem] bg-paper sm:min-h-[18rem] lg:min-h-[22rem] lg:grid-cols-[15rem_minmax(0,1fr)_18rem]">
          <aside className="hidden bg-paper-2 p-3 lg:block" aria-hidden>
            <div className="mb-4 flex items-center gap-2">
              <BrandLogo className="size-7" />
              <div className="min-w-0">
                <p className="truncate text-ui-sm font-semibold text-ink">
                  {t("workspaceName")}
                </p>
                <p className="text-ui-xs text-ink-3">{t("workspaceSubtitle")}</p>
              </div>
            </div>
            {navItems.map((item, index) => (
              <div
                key={item}
                className={`mb-1 flex h-8 items-center rounded-md px-2 text-ui-sm ${
                  index === 1 ? "bg-paper-3 font-medium text-ink" : "text-ink-2"
                }`}
              >
                {item}
              </div>
            ))}
          </aside>

          <div className="min-w-0" aria-hidden>
            <div className="flex min-h-12 items-center justify-between px-4">
              <div>
                <p className="text-ui-xs font-medium uppercase text-ink-3">
                  {t("triageLabel")}
                </p>
                <p className="text-ui-md font-semibold text-ink">{t("triageTitle")}</p>
              </div>
              <div className="inline-flex h-8 items-center gap-1.5 rounded-md bg-mark px-2.5 text-ui-sm font-medium text-paper">
                <Plus className="size-3.5" />
                {t("newMark")}
              </div>
            </div>

            <div className="hidden sm:block">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4"
                >
                  {row.status === "open" ? (
                    <CircleDashed className="size-3.5 text-mark" />
                  ) : (
                    <CheckCircle2 className="size-3.5 text-ok" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-ui-sm font-medium text-ink">{row.title}</p>
                    <p className="mt-0.5 font-mono text-ui-xs text-ink-3">
                      {row.id} · {row.path}
                    </p>
                  </div>
                  <span className="rounded bg-paper-3 px-1.5 py-0.5 text-ui-2xs font-medium text-ink-2">
                    {row.priority}
                  </span>
                </div>
              ))}
            </div>

            <div className="sm:hidden">
              <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4">
                <CircleDashed className="size-3.5 text-mark" />
                <div className="min-w-0">
                  <p className="truncate text-ui-sm font-medium text-ink">
                    {t("mobileRowTitle")}
                  </p>
                  <p className="mt-0.5 font-mono text-ui-xs text-ink-3">
                    {t("mobileRowMeta")}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mx-4 my-4 overflow-hidden rounded-lg bg-paper-elevated sm:my-5">
              <div className="grid grid-cols-3 gap-px bg-rule">
                <div className="bg-paper-elevated p-2.5 sm:p-3">
                  <p className="text-ui-xs text-ink-3">{t("statsOpen")}</p>
                  <p className="mt-1.5 font-mono text-lg text-mark sm:mt-2 sm:text-xl">
                    {t("statsOpenValue")}
                  </p>
                </div>
                <div className="bg-paper-elevated p-2.5 sm:p-3">
                  <p className="text-ui-xs text-ink-3">{t("statsResolved")}</p>
                  <p className="mt-1.5 font-mono text-lg text-ink sm:mt-2 sm:text-xl">
                    {t("statsResolvedValue")}
                  </p>
                </div>
                <div className="bg-paper-elevated p-2.5 sm:p-3">
                  <p className="text-ui-xs text-ink-3">{t("statsSynced")}</p>
                  <p className="mt-1.5 font-mono text-lg text-ink sm:mt-2 sm:text-xl">
                    {t("statsSyncedValue")}
                  </p>
                </div>
              </div>
              <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-paper-3/80 to-transparent" />
              <MarkPin label="4" size="md" pulse className="pd-anim-pin absolute left-[58%] top-[42%]" />
              <p className="pd-anim-comment absolute left-[52%] top-[18%] max-w-[11rem] rounded-md bg-paper-elevated px-2 py-1 text-ui-2xs leading-snug text-ink-2 ring-1 ring-rule">
                {t("commentPreview")}
              </p>
              <MousePointer2 className="pd-anim-cursor absolute left-[60%] top-[48%] size-5 rotate-[-18deg] fill-ink text-ink sm:size-6" />
            </div>
          </div>

          <aside className="hidden bg-paper-elevated p-4 lg:block" aria-hidden>
            <p className="font-mono text-ui-xs font-semibold text-mark">{t("detailId")}</p>
            <p className="mt-1 text-title-sm font-semibold leading-snug text-ink">
              {t("detailTitle")}
            </p>
            <div className="mt-4 rounded-md bg-paper-2 p-3">
              <p className="text-ui-xs leading-5 text-ink-2">{t("detailBody")}</p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-ui-xs text-ink-3">
              <MessageSquare className="size-3.5" />
              {t("detailComments")}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
