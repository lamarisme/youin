"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  markDescriptionPlainText,
  sanitizeMarkDescriptionHtml,
} from "@/lib/mark-description";

interface MarkDescriptionReadProps {
  html: string;
  className?: string;
}

export function MarkDescriptionRead({ html, className }: MarkDescriptionReadProps) {
  const safe = useMemo(() => sanitizeMarkDescriptionHtml(html), [html]);
  if (!markDescriptionPlainText(safe)) return null;

  return (
    <div
      className={cn(
        "mark-description-read max-w-[65ch] break-words text-[1rem] leading-relaxed text-ink-2",
        "[&_a]:text-mark [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-ink-2",
        "[&_code]:rounded-md [&_code]:bg-paper-3 [&_code]:px-1.5 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-ink",
        "[&_em]:italic [&_i]:italic",
        "[&_li]:my-0.5",
        "[&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:pl-1",
        "[&_p]:mb-2 [&_p:last-child]:mb-0",
        "[&_s]:line-through [&_strike]:line-through [&_del]:line-through",
        "[&_strong]:font-semibold [&_b]:font-semibold",
        "[&_u]:underline",
        "[&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:pl-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
