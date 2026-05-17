import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type NoticeTone = "danger" | "success" | "info";

const TONE_CLASS: Record<NoticeTone, string> = {
  danger: "border-mark/30 bg-mark-soft text-mark",
  success: "border-ok/25 bg-ok-soft text-ok",
  info: "border-rule bg-paper text-ink-2",
};

interface NoticeProps {
  children: ReactNode;
  tone?: NoticeTone;
  className?: string;
  id?: string;
  role?: "alert" | "status";
}

export function Notice({ children, tone = "info", className, id, role }: NoticeProps) {
  return (
    <p
      id={id}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn(
        "rounded-md border px-3 py-2 text-[0.75rem] leading-snug",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}
