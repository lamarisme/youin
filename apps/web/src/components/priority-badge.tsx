import { Flag } from "lucide-react";

import { Pill } from "@/components/pill";
import type { PinPriority } from "@/lib/collab-types";
import { cn } from "@/lib/utils";

const PRIORITY_CLASS: Record<PinPriority, string> = {
  critical: "bg-mark-soft text-mark",
  high: "bg-paper-3 text-ink",
  medium: "bg-paper-3 text-ink-2",
  low: "bg-paper-3 text-ink-3",
};

interface PriorityBadgeProps {
  priority: PinPriority;
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
      {priority}
    </Pill>
  );
}
