"use client";

import { History } from "lucide-react";

import { Surface } from "@/components/surface";
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
      <div className="space-y-2">
        {events.length === 0 ? (
          <p className="text-ui-sm text-ink-3">No history yet.</p>
        ) : null}
        {events.map((event) => {
          const actor = membersById.get(event.actorId);
          const description = formatMarkEvent(
            event.type,
            event.fromValue,
            event.toValue,
            event.metadata,
          );
          const actorParts = actor ? memberDisplayParts(actor, namePref) : null;
          return (
            <Surface key={event.id} padding="sm">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className="text-ui-xs font-medium text-ink"
                  title={actor ? memberPickerLabel(actor, namePref) : undefined}
                >
                  {actorParts ? (
                    <span className="text-ink">{actorParts.primary}</span>
                  ) : (
                    "Unknown member"
                  )}
                </span>
                <time
                  dateTime={event.createdAt}
                  title={formatDateTime(event.createdAt)}
                  className="text-ui-2xs text-ink-3"
                >
                  {formatRelative(event.createdAt)}
                </time>
              </div>
              <p className="text-ui-xs leading-relaxed text-ink-2">{description}</p>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
