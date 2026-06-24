import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/utils";

export function markDescriptionExtensions({
  openLinksOnClick,
}: {
  openLinksOnClick: boolean;
}): Extensions {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: {
        openOnClick: openLinksOnClick,
        HTMLAttributes: {
          class: "text-mark underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      },
    }),
  ];
}

export function markDescriptionContentClass(className?: string) {
  return cn(
    "max-w-none outline-none",
    "[&_a]:text-mark [&_a]:underline [&_a]:underline-offset-2",
    "[&_blockquote]:my-2 [&_blockquote]:border-l [&_blockquote]:border-rule [&_blockquote]:pl-3",
    "[&_code]:rounded-md [&_code]:bg-paper-3 [&_code]:px-1.5 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:text-ink",
    "[&_em]:italic [&_i]:italic",
    "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-title-md [&_h1]:font-semibold [&_h1]:leading-snug [&_h1]:text-ink",
    "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-title-sm [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-ink",
    "[&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-ui-md [&_h3]:font-semibold [&_h3]:leading-snug [&_h3]:text-ink",
    "[&_hr]:my-3 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-rule",
    "[&_li]:my-0.5",
    "[&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:pl-1",
    "[&_p]:mb-2 [&_p:last-child]:mb-0",
    "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-paper-3 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-ui-xs [&_pre]:leading-relaxed [&_pre]:text-ink",
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[inherit]",
    "[&_s]:line-through [&_strike]:line-through [&_del]:line-through",
    "[&_strong]:font-semibold [&_b]:font-semibold",
    "[&_u]:underline",
    "[&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:pl-1",
    className,
  );
}
