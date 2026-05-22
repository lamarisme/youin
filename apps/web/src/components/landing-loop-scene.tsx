import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Link2, MousePointer2 } from "lucide-react";

import { MarkPin } from "@/components/mark-pin";

type LoopSceneVariant = "capture" | "anchor" | "sync";

type LandingLoopSceneProps = {
  variant: LoopSceneVariant;
};

export async function LandingLoopScene({ variant }: LandingLoopSceneProps) {
  const t = await getTranslations(`landing.loopScenes.${variant}`);

  if (variant === "capture") {
    return (
      <div
        className="relative overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule"
        aria-hidden
      >
        <div className="flex h-8 items-center gap-1.5 border-b border-rule bg-paper-2 px-2.5">
          <span className="size-2 rounded-full bg-rule-strong" />
          <span className="size-2 rounded-full bg-rule" />
          <span className="size-2 rounded-full bg-rule" />
          <span className="ml-2 font-mono text-ui-2xs text-ink-3">{t("url")}</span>
        </div>
        <div className="relative min-h-[9rem] p-4">
          <div className="mx-auto max-w-[12rem] rounded-md bg-paper-2 p-3">
            <p className="text-ui-2xs font-medium uppercase text-ink-3">{t("elementLabel")}</p>
            <div className="relative mt-2 flex h-8 items-center justify-center rounded-md bg-mark/10 ring-2 ring-mark/40">
              <span className="text-ui-xs font-medium text-mark">Upgrade to Pro</span>
              <MarkPin label="1" size="sm" pulse className="absolute -right-2 -top-2" />
            </div>
          </div>
          <MousePointer2 className="absolute bottom-6 right-8 size-5 rotate-[-12deg] fill-ink text-ink opacity-70" />
        </div>
        <div className="border-t border-rule bg-paper-2 px-3 py-2 font-mono text-ui-2xs text-ink-3">
          {t("selector")}
        </div>
      </div>
    );
  }

  if (variant === "anchor") {
    return (
      <div
        className="overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule"
        aria-hidden
      >
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <span className="font-mono text-ui-2xs font-semibold text-mark">{t("status")}</span>
          <span className="rounded bg-ok-soft px-1.5 py-0.5 text-ui-2xs font-medium text-ok">
            {t("liveBadge")}
          </span>
        </div>
        <dl className="divide-y divide-rule text-ui-xs">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 px-3 py-2.5">
            <dt className="text-ink-3">Selector</dt>
            <dd className="truncate font-mono text-ink">{t("selector")}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 px-3 py-2.5">
            <dt className="text-ink-3">Viewport</dt>
            <dd className="font-mono text-ink">{t("viewport")}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 px-3 py-2.5">
            <dt className="text-ink-3">Fallback</dt>
            <dd className="text-ink-2">{t("fallback")}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-1.5 border-t border-rule bg-paper-2 px-3 py-2 text-ui-2xs text-ink-3">
          <Link2 className="size-3 shrink-0" />
          {t("footerNote")}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg bg-paper-elevated ring-1 ring-rule"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-rule px-3 py-2">
        <span className="font-mono text-ui-2xs font-semibold text-mark">{t("issueId")}</span>
        <ArrowUpRight className="size-3.5 text-ink-3" />
      </div>
      <div className="space-y-3 p-3">
        <p className="text-ui-sm font-semibold leading-snug text-ink">{t("title")}</p>
        <p className="font-mono text-ui-2xs text-ink-3">{t("meta")}</p>
        <div className="flex items-center justify-between rounded-md bg-paper-2 px-2.5 py-2">
          <span className="text-ui-xs text-ink-2">{t("destination")}</span>
          <span className="text-ui-xs font-medium text-ink">{t("status")}</span>
        </div>
      </div>
    </div>
  );
}
