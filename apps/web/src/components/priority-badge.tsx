import { Flag } from "lucide-react";

import { Pill } from "@/components/pill";
import type { MarkPriority } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

const PRIORITY_CLASS: Record<MarkPriority, string> = {
  critical: "border-destructive-token/25 bg-destructive-soft text-destructive-token",
  high: "bg-paper-3 text-ink",
  medium: "bg-paper-3 text-ink-2",
  low: "bg-paper-3 text-ink-3",
};

const PRIORITY_LABEL: Record<MarkPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface PriorityBadgeProps {
  priority: MarkPriority;
  size?: "sm" | "md";
  className?: string;
}

export function PriorityBadge({ priority, size = "md", className }: PriorityBadgeProps) {
  return (
    <Pill
      size={size}
      icon={<Flag className={size === "sm" ? "size-2.5" : "size-3"} />}
      className={cn(PRIORITY_CLASS[priority], className)}
    >
      {PRIORITY_LABEL[priority]}
    </Pill>
  );
}
