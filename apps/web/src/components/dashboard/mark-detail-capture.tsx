"use client";

import type { ReactNode } from "react";
import {
  CalendarClock,
  ChevronDown,
  Code2,
  Globe2,
  Laptop,
  Monitor,
  PanelTop,
} from "lucide-react";

import type { MarkItem } from "@/lib/collab-types";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { markImageSrc } from "@/lib/workspace/mark-image-url";

import { MarkPin } from "@/components/mark-pin";

import { shortMarkLabel } from "./format-mark-event";
import { FullImagePreview } from "./full-image-preview";
import { formatMarkPageOrigin } from "./mark-page-label";
import { MarkPageOpenButton } from "./mark-page-open";

interface MarkDetailCaptureProps {
  mark: MarkItem;
  variant?: "compact" | "hero";
  spacing?: "normal" | "none";
}

export function MarkDetailCapture({
  mark,
  variant = "compact",
  spacing = "normal",
}: MarkDetailCaptureProps) {
  const cap = mark.capture;
  const hasPage = Boolean(mark.page.trim());
  const pageOrigin = formatMarkPageOrigin(mark.page);
  const domContext = getDomSnapshotContext(cap?.domSnapshot);
  const isHero = variant === "hero";
  const screenshotSrc = markImageSrc(cap?.screenshotUrl);
  const captureSignals = [
    hasPage,
    Boolean(cap?.selector?.trim()),
    Boolean(cap?.screenshotUrl?.trim()),
    Boolean(domContext),
    Boolean(cap?.viewport?.trim()),
  ];
  const capturedContextCount = captureSignals.filter(Boolean).length;

  if (!cap) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-md bg-paper-2/55 px-3 py-3 text-ui-sm text-ink-3 ring-1 ring-rule/45 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between",
          spacing === "normal" && (isHero ? "mt-4" : "mt-5"),
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <MarkPin label={shortMarkLabel(mark.displayKey)} size="sm" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-ink-2">
              {hasPage ? "Open source page" : "No capture saved"}
            </p>
            <p className="max-w-prose text-ui-xs leading-relaxed text-ink-3">
              {hasPage
                ? "No capture is saved yet. Inspect this mark where it lives."
                : "Add a page URL to inspect this mark in context."}
            </p>
          </div>
        </div>
        {hasPage ? (
          <MarkPageOpenButton
            page={mark.page}
            markTitle={mark.title}
            appearance="labeled"
            className="h-9 shrink-0 justify-self-start px-2.5 text-ui-xs sm:justify-self-end"
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-md bg-paper-2 ring-1 ring-rule/45",
          spacing === "normal" && (isHero ? "mt-4" : "mt-5"),
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <MarkPin label={shortMarkLabel(mark.displayKey)} size="sm" />
          <span className="min-w-0 flex-1 truncate text-ui-xs font-medium text-ink-2">
            Capture
          </span>
          {isHero && hasPage ? (
            <MarkPageOpenButton
              page={mark.page}
              markTitle={mark.title}
              appearance="icon"
              className="size-7 border-transparent bg-transparent hover:bg-paper-3"
            />
          ) : null}
        </div>
        <div className="px-3 pb-3">
          {screenshotSrc ? (
            <div
              className={cn(
                "mx-auto overflow-hidden rounded-md bg-paper-3",
                isHero ? "max-w-4xl" : "max-w-2xl",
              )}
            >
              <FullImagePreview
                src={screenshotSrc}
                alt={`Captured element for ${mark.displayKey}`}
              >
                {/* Arbitrary capture URLs can be signed, external, or data-backed, so keep a native image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshotSrc}
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
              {hasPage ? (
                <MarkPageOpenButton
                  page={mark.page}
                  markTitle={mark.title}
                  appearance="labeled"
                  className="mx-auto h-8"
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <details className="group mt-2 border-y border-rule/55">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-ui-xs outline-none transition-colors hover:bg-paper-2 focus-visible:ring-2 focus-visible:ring-mark/20 [&::-webkit-details-marker]:hidden">
          <Code2 className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1 font-medium text-ink-2">
            Technical details
          </span>
          <span className="text-ink-3">
            {capturedContextCount} of {captureSignals.length} captured
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="pb-3 pt-2">
          <dl className="grid gap-x-6 gap-y-3 text-ui-xs sm:grid-cols-2 lg:grid-cols-3">
            {pageOrigin ? (
              <MetaCell
                label="Origin"
                value={pageOrigin}
                icon={<Globe2 className="size-3.5" aria-hidden />}
              />
            ) : null}
            <MetaCell
              label="Selector"
              value={cap.selector ?? "Not captured"}
              icon={<Code2 className="size-3.5" aria-hidden />}
              mono
            />
            <MetaCell
              label="Viewport"
              value={cap.viewport ?? "Not captured"}
              icon={<Monitor className="size-3.5" aria-hidden />}
            />
            <MetaCell
              label="Browser"
              value={cap.browser ?? "Not captured"}
              icon={<PanelTop className="size-3.5" aria-hidden />}
            />
            {cap.os ? (
              <MetaCell
                label="OS"
                value={cap.os}
                icon={<Laptop className="size-3.5" aria-hidden />}
              />
            ) : null}
            {cap.capturedAt ? (
              <MetaCell
                label="Captured"
                value={formatDateTime(cap.capturedAt)}
                icon={<CalendarClock className="size-3.5" aria-hidden />}
              />
            ) : null}
          </dl>

          {domContext ? (
            <div className="mt-4 border-t border-rule/55 pt-3">
              <div className="flex items-center gap-2 text-ui-xs font-medium text-ink-2">
                <Code2 className="size-3.5 text-ink-3" aria-hidden />
                <span>DOM context</span>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-paper-2 px-3 py-2 font-mono text-ui-xs leading-relaxed text-ink-2 [overflow-wrap:anywhere] whitespace-pre-wrap">
                {domContext.outerHTML}
              </pre>
              {domContext.nearbyText ? (
                <p className="mt-2 text-ui-xs leading-relaxed text-ink-3">
                  {domContext.nearbyText}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
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
    <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
      <span className="row-span-2 mt-0.5 text-ink-3" aria-hidden>
        {icon}
      </span>
      <dt className="text-ink-3">{label}</dt>
      <dd
        title={title ?? value}
        className={cn(
          "truncate text-ink-2",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
