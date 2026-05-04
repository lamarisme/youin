import { CheckCircle2, CircleDashed } from "lucide-react";

import { Pill } from "@/components/pill";
import type { PinStatus } from "@/lib/collab-types";

export function StatusPill({ status }: { status: PinStatus }) {
  if (status === "closed") {
    return (
      <Pill variant="ok" size="md" icon={<CheckCircle2 className="size-3.5" />}>
        Closed
      </Pill>
    );
  }
  return (
    <Pill variant="mark" size="md" icon={<CircleDashed className="size-3.5" />}>
      Open
    </Pill>
  );
}
