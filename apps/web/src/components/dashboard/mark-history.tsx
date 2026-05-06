"use client";

import { History } from "lucide-react";

import { Surface } from "@/components/surface";
import type { MarkEvent, TeamMember } from "@/lib/collab-types";
import { memberPickerLabel } from "@/lib/workspace/member-label";

import { formatMarkEvent } from "./format-mark-event";

interface MarkHistoryProps {
  events: MarkEvent[];
  membersById: Map<string, TeamMember>;
  dateTimeFormatter: Intl.DateTimeFormat;
}

export function MarkHistory({ events, membersById, dateTimeFormatter }: MarkHistoryProps) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-1.5 text-eyebrow">
        <History className="size-3.5" aria-hidden />
        Mark history{events.length > 0 ? ` (${events.length})` : ""}
      </h2>
      <div className="annotation-rail space-y-2.5">
        {events.length === 0 ? (
          <p className="text-[0.8125rem] text-ink-3">No history yet.</p>
        ) : null}
        {events.map((event) => {
          const actor = membersById.get(event.actorId);
          const description = formatMarkEvent(event.type, event.fromValue, event.toValue, event.metadata);
          return (
            <Surface key={event.id} padding="sm">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[0.75rem] font-medium text-ink" title={actor ? memberPickerLabel(actor) : undefined}>
                  {actor ? `${actor.username} · ${actor.name}` : "Unknown member"}
                </span>
                <span className="text-[0.625rem] text-ink-3">
                  {dateTimeFormatter.format(new Date(event.createdAt))}
                </span>
              </div>
              <p className="text-[0.75rem] leading-relaxed text-ink-2">{description}</p>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
