"use client";

import { History } from "lucide-react";

import type { MarkEvent, TeamMember } from "@/lib/collab-types";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { useWorkspaceData } from "@/lib/queries/use-workspace";
import { memberDisplayParts, memberPickerLabel } from "@/lib/workspace/member-label";

import { formatMarkEvent } from "./format-mark-event";

interface MarkHistoryProps {
  events: MarkEvent[];
  membersById: Map<string, TeamMember>;
}

export function MarkHistory({ events, membersById }: MarkHistoryProps) {
  const namePref = useWorkspaceData((s) => s.profile.displayNamePreference);
  return (
    <div>
      <h2 className="mb-2.5 flex items-center gap-1.5 text-eyebrow">
        <History className="size-3.5" aria-hidden />
        Mark history{events.length > 0 ? ` (${events.length})` : ""}
      </h2>
      <div className="relative space-y-0">
        {events.length === 0 ? (
          <p className="text-ui-sm text-ink-3">No history yet.</p>
        ) : null}
        {events.map((event, index) => {
          const actor = membersById.get(event.actorId);
          const description = formatMarkEvent(
            event.type,
            event.fromValue,
            event.toValue,
            event.metadata,
          );
          const actorParts = actor ? memberDisplayParts(actor, namePref) : null;
          return (
            <div key={event.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 pb-3 last:pb-0">
              <div className="relative flex justify-center">
                <span className="mt-1.5 size-1.5 rounded-full bg-ink-3 ring-4 ring-paper" aria-hidden />
                {index < events.length - 1 ? (
                  <span className="absolute top-4 bottom-0 w-px bg-rule" aria-hidden />
                ) : null}
              </div>
              <div className="min-w-0 rounded-md px-1 pb-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-ui-xs font-medium text-ink"
                    title={actor ? memberPickerLabel(actor, namePref) : undefined}
                  >
                    {actorParts ? actorParts.primary : "Unknown member"}
                  </span>
                  <time
                    dateTime={event.createdAt}
                    title={formatDateTime(event.createdAt)}
                    className="shrink-0 text-ui-2xs text-ink-3"
                  >
                    {formatRelative(event.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-ui-xs leading-relaxed text-ink-2">{description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
