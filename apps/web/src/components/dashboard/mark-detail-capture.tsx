"use client";

import type { ReactNode } from "react";
import {
  CalendarClock,
  Code2,
  Globe2,
  Laptop,
  Monitor,
  PanelTop,
} from "lucide-react";

import type { PinItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";

import { shortMarkLabel } from "./format-mark-event";
import { formatMarkPageOrigin } from "./mark-page-label";

interface MarkDetailCaptureProps {
  pin: PinItem;
}

export function MarkDetailCapture({ pin }: MarkDetailCaptureProps) {
  const cap = pin.capture;
  const pageOrigin = formatMarkPageOrigin(pin.page);

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-lg border border-rule bg-paper">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
          <span className="pin-dot !size-5 !text-[8px]">
            {shortMarkLabel(pin.displayKey)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium text-ink-2">
            Capture
          </span>
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
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.6875rem] text-ink-3">
          {pageOrigin ? (
            <MetaCell
              label="Origin"
              value={pageOrigin}
              icon={<Globe2 className="size-3" aria-hidden />}
            />
          ) : null}
          <MetaCell
            label="Selector"
            value={cap.selector ?? "None"}
            icon={<Code2 className="size-3" aria-hidden />}
            mono
          />
          <MetaCell
            label="Viewport"
            value={cap.viewport ?? "Unknown"}
            icon={<Monitor className="size-3" aria-hidden />}
          />
          <MetaCell
            label="Browser"
            value={cap.browser ?? "Unknown"}
            icon={<PanelTop className="size-3" aria-hidden />}
          />
          {cap.os ? (
            <MetaCell
              label="OS"
              value={cap.os}
              icon={<Laptop className="size-3" aria-hidden />}
            />
          ) : null}
          {cap.capturedAt ? (
            <MetaCell
              label="Captured"
              value={formatDateTime(cap.capturedAt)}
              icon={<CalendarClock className="size-3" aria-hidden />}
            />
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
  icon,
  mono,
}: {
  label: string;
  value: string;
  title?: string;
  icon: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <dt
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-ink-3"
        title={label}
      >
        <span className="sr-only">{label}</span>
        {icon}
      </dt>
      <dd
        title={title ?? value}
        className={
          mono
            ? "max-w-[18rem] truncate font-mono text-[0.6875rem] text-ink-2"
            : "max-w-[18rem] truncate text-ink-2"
        }
      >
        {value}
      </dd>
    </div>
  );
}
