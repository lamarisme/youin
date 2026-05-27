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

import type { MarkItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { MarkPin } from "@/components/mark-pin";

import { shortMarkLabel } from "./format-mark-event";
import { FullImagePreview } from "./full-image-preview";
import { formatMarkPageOrigin } from "./mark-page-label";
import { MarkPageOpenButton } from "./mark-page-open";

interface MarkDetailCaptureProps {
  mark: MarkItem;
  variant?: "compact" | "hero";
}

export function MarkDetailCapture({ mark, variant = "compact" }: MarkDetailCaptureProps) {
  const cap = mark.capture;
  const pageOrigin = formatMarkPageOrigin(mark.page);
  const domContext = getDomSnapshotContext(cap?.domSnapshot);
  const isHero = variant === "hero";

  return (
    <>
      <div className={cn("overflow-hidden rounded-lg bg-paper-2", isHero ? "mt-4" : "mt-5")}>
        <div className="flex items-center gap-2 px-3 py-2">
          <MarkPin label={shortMarkLabel(mark.displayKey)} size="sm" />
          <span className="min-w-0 flex-1 truncate text-ui-xs font-medium text-ink-2">
            Capture
          </span>
          {isHero && mark.page.trim() ? (
            <MarkPageOpenButton
              page={mark.page}
              appearance="icon"
              className="size-7 border-transparent bg-transparent hover:bg-paper-3"
            />
          ) : null}
        </div>
        <div className="relative px-3 pb-3">
          {cap?.screenshotUrl ? (
            <div className={cn("mx-auto overflow-hidden rounded-md bg-paper-3", isHero ? "max-w-4xl" : "max-w-2xl")}>
              <FullImagePreview
                src={cap.screenshotUrl}
                alt={`Captured element for ${mark.displayKey}`}
              >
                {/* Arbitrary capture URLs can be signed, external, or data-backed, so keep a native image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cap.screenshotUrl}
                  alt={`Captured element for ${mark.displayKey}`}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "w-full object-contain object-top",
                    isHero ? "max-h-[28rem]" : "max-h-[22rem]",
                  )}
                />
              </FullImagePreview>
            </div>
          ) : (
            <div className="grid gap-3 py-8 text-center">
              <p className="mx-auto max-w-sm text-ui-sm text-ink-3">
                No capture snapshot saved. Open the page to inspect this mark in context.
              </p>
              {mark.page.trim() ? (
                <MarkPageOpenButton page={mark.page} appearance="labeled" className="mx-auto h-8" />
              ) : null}
            </div>
          )}
          {cap?.selector ? (
            <div className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded bg-ink/85 px-2 py-0.5 font-mono text-ui-2xs text-paper">
              {cap.selector}
            </div>
          ) : null}
        </div>
      </div>

      {cap ? (
        <>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-ui-xs text-ink-3">
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

          {domContext ? (
            <div className="mt-3 overflow-hidden rounded-lg bg-paper-2">
              <div className="flex items-center gap-2 px-3 py-2 text-ui-xs font-medium text-ink-2">
                <Code2 className="size-3.5 text-ink-3" aria-hidden />
                <span>DOM context</span>
              </div>
              <pre className="max-h-56 overflow-auto bg-paper-2 px-3 py-2 font-mono text-ui-xs leading-relaxed text-ink-2 [overflow-wrap:anywhere] whitespace-pre-wrap">
                {domContext.outerHTML}
              </pre>
              {domContext.nearbyText ? (
                <p className="px-3 py-2 text-ui-xs leading-relaxed text-ink-3">
                  {domContext.nearbyText}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function getDomSnapshotContext(
  snapshot: Record<string, unknown> | undefined,
): { outerHTML: string; nearbyText?: string } | undefined {
  if (!snapshot) return undefined;
  const selected = snapshot.selectedElement;
  const context = snapshot.context;
  const outerHTML =
    selected && typeof selected === "object" && !Array.isArray(selected)
      ? (selected as Record<string, unknown>).outerHTML
      : undefined;
  const nearbyText =
    context && typeof context === "object" && !Array.isArray(context)
      ? (context as Record<string, unknown>).nearbyText
      : undefined;
  if (typeof outerHTML !== "string" || !outerHTML.trim()) return undefined;
  return {
    outerHTML: outerHTML.slice(0, 5000),
    nearbyText:
      typeof nearbyText === "string" && nearbyText.trim()
        ? nearbyText.slice(0, 1200)
        : undefined,
  };
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
            ? "max-w-[18rem] truncate font-mono text-ui-xs text-ink-2"
            : "max-w-[18rem] truncate text-ink-2"
        }
      >
        {value}
      </dd>
    </div>
  );
}
