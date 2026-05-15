"use client";

import type { PinItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";

import { shortMarkLabel } from "./format-mark-event";
import { formatMarkPageLabel, formatMarkPageOrigin } from "./mark-page-label";
import { MarkPageOpenButton } from "./mark-page-open";

interface MarkDetailCaptureProps {
  pin: PinItem;
}

export function MarkDetailCapture({ pin }: MarkDetailCaptureProps) {
  const cap = pin.capture;
  const pageLabel = formatMarkPageLabel(pin.page);
  const pageOrigin = formatMarkPageOrigin(pin.page);

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-lg border border-rule bg-paper">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
          <span className="pin-dot !size-5 !text-[8px]">
            {shortMarkLabel(pin.displayKey)}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-ink-3" title={pin.page}>
            {pageLabel}
          </span>
          <MarkPageOpenButton
            page={pin.page}
            appearance="icon"
            className="size-8 shrink-0 border-transparent bg-transparent hover:bg-paper-3"
          />
        </div>
        <div className="relative bg-paper px-3 py-3">
          {cap?.screenshotUrl ? (
            <div className="mx-auto max-w-2xl overflow-hidden rounded-md border border-rule bg-paper-2">
              {/* Arbitrary capture URLs can be signed, external, or data-backed, so keep a native image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cap.screenshotUrl}
                alt={`Captured element for ${pin.displayKey}`}
                loading="lazy"
                decoding="async"
                className="max-h-[22rem] w-full object-contain object-top"
              />
            </div>
          ) : (
            <p className="py-6 text-center text-[0.8125rem] text-ink-3">
              No capture snapshot saved for this mark.
            </p>
          )}
          {cap?.selector ? (
            <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded bg-ink/85 px-2 py-0.5 font-mono text-[0.5625rem] text-paper">
              {cap.selector}
            </div>
          ) : null}
        </div>
      </div>

      {cap ? (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-ink-3">
          {pageOrigin ? <MetaCell label="Origin" value={pageOrigin} /> : null}
          <MetaCell label="Selector" value={cap.selector ?? "None"} mono />
          <MetaCell label="Viewport" value={cap.viewport ?? "Unknown"} />
          <MetaCell label="Browser" value={cap.browser ?? "Unknown"} />
          {cap.os ? <MetaCell label="OS" value={cap.os} /> : null}
          {cap.capturedAt ? (
            <MetaCell label="Captured" value={formatDateTime(cap.capturedAt)} />
          ) : null}
        </dl>
      ) : null}
    </>
  );
}

function MetaCell({
  label,
  value,
  title,
  mono,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div className="inline-flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 font-medium text-ink-3">{label}</dt>
      <dd
        title={title ?? value}
        className={mono ? "max-w-[18rem] truncate font-mono text-[0.6875rem] text-ink-2" : "max-w-[18rem] truncate text-ink-2"}
      >
        {value}
      </dd>
    </div>
  );
}
