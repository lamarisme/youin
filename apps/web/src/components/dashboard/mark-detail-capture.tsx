"use client";

import { Globe, Monitor, Mouse } from "lucide-react";

import type { PinItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { shortMarkLabel } from "./format-mark-event";
import { MarkPageOpenButton } from "./mark-page-open";

interface MarkDetailCaptureProps {
  pin: PinItem;
}

export function MarkDetailCapture({ pin }: MarkDetailCaptureProps) {
  const cap = pin.capture;
  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl border border-rule bg-paper shadow-[0_10px_30px_-20px_oklch(17%_0.01_50_/_0.45)] dark:shadow-[0_10px_30px_-20px_oklch(0%_0_0_/_0.55)]">
        <div className="flex items-center gap-1.5 border-b border-rule bg-paper-2 px-3 py-2.5">
          <span className="size-2 rounded-full bg-paper-3" />
          <span className="size-2 rounded-full bg-paper-3" />
          <span className="size-2 rounded-full bg-paper-3" />
          <span className="ml-2 min-w-0 flex-1 truncate rounded bg-paper px-2 py-0.5 font-mono text-[0.625rem] text-ink-3">
            {pin.page}
          </span>
          <MarkPageOpenButton
            page={pin.page}
            appearance="icon"
            className="size-8 shrink-0 border-transparent bg-paper hover:bg-paper-3"
          />
        </div>
        <div className="relative bg-paper-2 px-6 py-9">
          <div className="mx-auto max-w-sm space-y-3">
            <div className="h-4 w-3/4 rounded bg-paper-3" />
            <div className="h-3 w-full rounded bg-paper-3/60" />
            <div className="h-3 w-5/6 rounded bg-paper-3/60" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="h-16 rounded bg-paper-3/40" />
              <div className="relative h-16 rounded bg-paper-3/40">
                <span className="pin-dot absolute -right-2 -top-2 z-10 !size-5 !text-[8px]">
                  {shortMarkLabel(pin.displayKey)}
                </span>
              </div>
              <div className="h-16 rounded bg-paper-3/40" />
            </div>
            <div className="h-3 w-2/3 rounded bg-paper-3/60" />
          </div>
          {cap?.selector ? (
            <div className="absolute bottom-2 left-3 rounded bg-ink/80 px-2 py-0.5 font-mono text-[0.5625rem] text-paper">
              {cap.selector}
            </div>
          ) : null}
        </div>
      </div>

      {cap ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <MetaCell icon={Globe} label="Page" value={pin.page} />
          <MetaCell icon={Mouse} label="Selector" value={cap.selector ?? "—"} mono />
          <MetaCell icon={Monitor} label="Viewport" value={cap.viewport ?? "—"} />
          <MetaCell icon={Globe} label="Browser" value={cap.browser ?? "—"} />
          {cap.os ? <MetaCell icon={Monitor} label="OS" value={cap.os} /> : null}
          {cap.capturedAt ? (
            <MetaCell icon={Globe} label="Captured" value={formatDateTime(cap.capturedAt)} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-paper-2 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5 text-ink-3">
        <Icon className="size-3" />
        <span className="text-[0.625rem] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn("truncate text-[0.8125rem] text-ink", mono && "font-mono text-[0.75rem]")}>
        {value}
      </p>
    </div>
  );
}
